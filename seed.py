#!/usr/bin/env python3
"""
ACS Manager — seeder VP / provision / ui-config.

Mengganti langkah "import manual" di INSTALL.md dengan satu perintah idempotent.
Dipakai juga oleh wizard setup di repo acs-manager-installer untuk menanam paket VP terpilih.

Dua mekanisme (otomatis per jenis resource, lihat packages.json):
  - virtual_parameters, provisions  -> NBI HTTP PUT  ({nbi}/<res>/<nama>)
  - config (ui-config/*.js)         -> mongo shell   (skrip db.config.*)

Contoh:
  python3 seed.py --list                      # tampilkan paket & isinya
  python3 seed.py                             # seed Core + paket default (Standard)
  python3 seed.py --packages core,standard,advanced
  python3 seed.py --all                       # semua paket
  python3 seed.py --dry-run                   # tampilkan rencana, tidak eksekusi
  python3 seed.py --check                     # read-only: bandingkan dgn yang ada di server

Env override:
  ACS_NBI         default http://127.0.0.1:7557
  ACS_MONGO_EXEC  default "docker exec -i genieacs-mongo mongo --quiet genieacs"
"""
import argparse, glob, json, os, shlex, subprocess, sys, time
import urllib.request, urllib.error, urllib.parse

ROOT = os.path.dirname(os.path.abspath(__file__))
NBI = os.environ.get("ACS_NBI", "http://127.0.0.1:7557").rstrip("/")
MONGO_EXEC = os.environ.get("ACS_MONGO_EXEC", "docker exec -i genieacs-mongo mongo --quiet genieacs")

C_OK, C_WARN, C_ERR, C_DIM, C_RST = "\033[32m", "\033[33m", "\033[31m", "\033[2m", "\033[0m"
if not sys.stdout.isatty():
    C_OK = C_WARN = C_ERR = C_DIM = C_RST = ""

def log(m=""): print(m)
def ok(m):   log(f"  {C_OK}OK{C_RST}    {m}")
def warn(m): log(f"  {C_WARN}WARN{C_RST}  {m}")
def err(m):  log(f"  {C_ERR}GAGAL{C_RST} {m}")


def load_manifest():
    with open(os.path.join(ROOT, "packages.json"), encoding="utf-8") as f:
        return json.load(f)


def resolve_file(res_dir, name):
    """Cari file resource: <dir>/<name>.js, kalau tak ada coba <dir>/<name>.*.js."""
    exact = os.path.join(ROOT, res_dir, name + ".js")
    if os.path.isfile(exact):
        return exact
    hits = sorted(glob.glob(os.path.join(ROOT, res_dir, glob.escape(name) + ".*.js")))
    return hits[0] if hits else None


def select_packages(manifest, want_ids, want_all):
    pkgs = manifest["packages"]
    chosen = []
    for p in pkgs:  # jaga urutan manifest (core dulu)
        pid = p["id"]
        take = (want_all or p.get("required")
                or (want_ids is not None and pid in want_ids)
                or (want_ids is None and p.get("default")))
        if take:
            chosen.append(p)
    return chosen


# ---- NBI (virtual_parameters, provisions) ----
def wait_nbi(timeout=None):
    """Tunggu NBI siap sebelum seeding — hindari race saat genieacs baru start."""
    if timeout is None:
        timeout = int(os.environ.get("ACS_NBI_WAIT", "90"))
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(f"{NBI}/devices/?projection=_id", timeout=5) as r:
                if r.status < 500:
                    return True
        except urllib.error.URLError:
            pass
        time.sleep(2)
    return False


def nbi_put(res, name, body_bytes, dry, retries=4):
    url = f"{NBI}/{res}/{urllib.parse.quote(name)}"
    if dry:
        log(f"  {C_DIM}[dry]{C_RST} PUT {url}")
        return True
    last = "?"
    for attempt in range(retries):
        req = urllib.request.Request(url, data=body_bytes, method="PUT",
                                     headers={"Content-Type": "application/x-www-form-urlencoded"})
        try:
            with urllib.request.urlopen(req, timeout=15) as r:
                if 200 <= r.status < 300:
                    ok(f"{res}/{name}")
                    return True
                last = f"HTTP {r.status}"
        except urllib.error.URLError as e:
            last = str(e)
        if attempt < retries - 1:
            time.sleep(2)
    err(f"{res}/{name} -> {last}")
    return False


def nbi_list(res):
    """Read-only: daftar _id resource yang ada di server (untuk --check)."""
    try:
        with urllib.request.urlopen(f"{NBI}/{res}/", timeout=15) as r:
            return {x["_id"] for x in json.load(r)}
    except urllib.error.URLError as e:
        err(f"tidak bisa baca {res}/ dari NBI: {e}")
        return None


# ---- mongo (config) ----
def mongo_apply(path, dry):
    if dry:
        log(f"  {C_DIM}[dry]{C_RST} mongo < {os.path.relpath(path, ROOT)}")
        return True
    try:
        with open(path, "rb") as f:
            p = subprocess.run(shlex.split(MONGO_EXEC), stdin=f,
                               capture_output=True, timeout=60)
        if p.returncode == 0:
            ok(f"config <- {os.path.basename(path)}")
            return True
        err(f"config {os.path.basename(path)} -> rc={p.returncode} {p.stderr.decode(errors='replace').strip()[:200]}")
        return False
    except (subprocess.SubprocessError, OSError) as e:
        err(f"config {os.path.basename(path)} -> {e}")
        return False


def cmd_list(manifest):
    log(f"Resource root : {ROOT}")
    log(f"NBI           : {NBI}")
    log(f"Mongo exec    : {MONGO_EXEC}\n")
    for p in manifest["packages"]:
        flags = []
        if p.get("required"): flags.append("wajib")
        if p.get("default"):  flags.append("default-on")
        tag = f" ({', '.join(flags)})" if flags else ""
        log(f"[{p['id']}] {p['label']}{tag}")
        log(f"    {C_DIM}{p.get('description','')}{C_RST}")
        for res in ("provisions", "virtual_parameters", "config"):
            names = p.get(res, [])
            if names:
                log(f"    {res}: {', '.join(names)}")
        log("")


def cmd_check(manifest, chosen):
    log("Mode --check (read-only): membandingkan paket terpilih dengan server.\n")
    rc = 0
    for res in ("provisions", "virtual_parameters"):
        existing = nbi_list(res)
        if existing is None:
            rc = 1
            continue
        want = []
        for p in chosen:
            want += p.get(res, [])
        log(f"{res}:")
        for name in want:
            mark = f"{C_OK}ada{C_RST}" if name in existing else f"{C_WARN}belum ada{C_RST}"
            log(f"    {name}: {mark}")
        log("")
    # config: tak bisa dicek via NBI, cukup validasi file ada
    want_cfg = []
    for p in chosen:
        want_cfg += p.get("config", [])
    if want_cfg:
        log("config (file lokal):")
        for name in want_cfg:
            path = resolve_file(manifest["resources"]["config"]["dir"], name)
            log(f"    {name}: {C_OK}file ada{C_RST}" if path else f"    {name}: {C_ERR}FILE HILANG{C_RST}")
    return rc


def cmd_seed(manifest, chosen, dry):
    res_dirs = manifest["resources"]
    if not dry:
        log(f"Menunggu NBI siap di {NBI} ...")
        if not wait_nbi():
            warn("NBI belum merespons — lanjut mencoba (tiap PUT punya retry sendiri).")
    total, fail = 0, 0
    for p in chosen:
        log(f"\n== paket [{p['id']}] {p['label']} ==")
        for res in ("provisions", "virtual_parameters"):
            for name in p.get(res, []):
                total += 1
                path = resolve_file(res_dirs[res]["dir"], name)
                if not path:
                    err(f"{res}/{name} -> file tidak ditemukan di {res_dirs[res]['dir']}/")
                    fail += 1
                    continue
                with open(path, "rb") as f:
                    body = f.read()
                if not nbi_put(res, name, body, dry):
                    fail += 1
        for name in p.get("config", []):
            total += 1
            path = resolve_file(res_dirs["config"]["dir"], name)
            if not path:
                err(f"config/{name} -> file tidak ditemukan")
                fail += 1
                continue
            if not mongo_apply(path, dry):
                fail += 1
    log(f"\n{'='*46}")
    status = f"{C_OK}SELESAI{C_RST}" if fail == 0 else f"{C_ERR}ADA GAGAL{C_RST}"
    log(f"{status}  {total-fail}/{total} resource {'(dry-run)' if dry else 'diterapkan'}")
    return 1 if fail else 0


def main():
    ap = argparse.ArgumentParser(description="Seeder ACS Manager (VP/provision/config).")
    ap.add_argument("--packages", help="daftar id paket dipisah koma (mis. core,standard). Core selalu ikut.")
    ap.add_argument("--all", action="store_true", help="seed semua paket")
    ap.add_argument("--dry-run", action="store_true", help="tampilkan rencana tanpa mengeksekusi")
    ap.add_argument("--check", action="store_true", help="read-only: bandingkan dengan server")
    ap.add_argument("--list", action="store_true", help="tampilkan daftar paket lalu keluar")
    args = ap.parse_args()

    manifest = load_manifest()

    if args.list:
        cmd_list(manifest)
        return 0

    want_ids = None
    if args.packages:
        want_ids = {s.strip() for s in args.packages.split(",") if s.strip()}
    chosen = select_packages(manifest, want_ids, args.all)
    log(f"Paket terpilih: {', '.join(p['id'] for p in chosen)}")

    if args.check:
        return cmd_check(manifest, chosen)
    return cmd_seed(manifest, chosen, args.dry_run)


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        sys.exit(130)
