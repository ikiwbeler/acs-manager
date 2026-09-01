# Instalasi ACS Manager dari Nol

Panduan langkah-demi-langkah dari **server kosong** sampai ONU pelanggan muncul di dashboard.
Ditulis untuk dijalankan berurutan — setiap langkah punya cara verifikasi sebelum lanjut.

- **Waktu:** ±30–45 menit (sebagian besar menunggu `docker build` & `npm install`).
- **Bekal:** bisa pakai terminal Linux & SSH. Tidak perlu paham TR-069 dulu.
- **Hasil akhir:** GenieACS core jalan di Docker, virtual parameter & provision tertanam, dashboard bisa login, ONU inform tiap 5 menit.

> Ringkasan referensi (bukan langkah demi langkah) ada di [`../INSTALL.md`](../INSTALL.md).
> Untuk deploy di VirtualBox, lihat [`DEPLOY-VIRTUALBOX.md`](DEPLOY-VIRTUALBOX.md).

---

## 0. Prasyarat

| Item | Nilai |
|---|---|
| OS | Ubuntu 22.04 / 20.04 atau Debian 12, instalasi bersih |
| Spek | 2 vCPU / 4 GB RAM / 20 GB disk (untuk ratusan ONU; naikkan sesuai armada) |
| Akses | user biasa dengan hak `sudo` (jangan jalankan semuanya sebagai root) |
| Jaringan | IP server harus bisa dijangkau ONU pelanggan, dan sebaliknya |

Port yang dipakai:

| Port | Untuk | Harus publik? |
|---|---|---|
| `7547` | CWMP — ONU connect ke ACS | **Ya** (dari arah ONU) |
| `7567` | File server — ONU unduh firmware | **Ya** (dari arah ONU) |
| `7557` | NBI (REST API GenieACS) | **Tidak** — dikunci `127.0.0.1` |
| `3000` | UI bawaan GenieACS | **Tidak** — dikunci `127.0.0.1` |
| `5173` | Dashboard ACS Manager | Lewat nginx/HTTPS, jangan diumbar langsung |

Siapkan juga **IP server** yang akan dipakai ONU. Di panduan ini ditulis `IP-SERVER` — ganti dengan IP asli (mis. `192.168.10.5`).

---

## 1. Pasang dependensi

**Cara cepat** — script bawaan repo (Docker + Compose plugin, Node.js 18, nginx, git, aturan ufw):

```bash
sudo apt update && sudo apt install -y git
git clone <URL-REPO> acs-manager && cd acs-manager
chmod +x setup.sh && ./setup.sh
```

**Cara manual** bila tidak mau pakai script:

```bash
sudo apt update && sudo apt install -y ca-certificates curl gnupg git nginx openssl python3
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - && sudo apt install -y nodejs
```

**Logout lalu login lagi** (atau `newgrp docker`) supaya keanggotaan grup `docker` aktif. Verifikasi:

```bash
docker --version && docker compose version   # Compose harus plugin v2
node -v                                      # v18 atau lebih baru
python3 --version                            # 3.8+ (stdlib saja, tanpa pip)
```

---

## 2. Ambil kode

```bash
git clone <URL-REPO> acs-manager
cd acs-manager
```

Isi yang penting: `docker/` (GenieACS core), `provisions/` + `virtual-parameters/` + `ui-config/` (yang di-seed), `dashboard-antd/` (dashboard), `seed.py` (penanam), `packages.json` (daftar paket).

---

## 3. Siapkan `.env`

```bash
cp .env.example docker/.env
openssl rand -hex 24          # salin hasilnya
nano docker/.env              # isikan ke GENIEACS_UI_JWT_SECRET
```

> ⚠️ **`.env` harus berada di `docker/`, bukan di root repo.** Docker Compose membaca `.env` dari
> folder tempat file compose berada. Kalau `.env` cuma ada di root, compose tetap jalan tapi
> secret-nya kosong dan Anda hanya melihat peringatan sekilas. Alternatif bila memang ingin
> menaruhnya di root: `docker compose --env-file ../.env up -d --build`.

Verifikasi nilainya benar-benar terbaca:

```bash
cd docker && docker compose config | grep JWT
# harus tampil secret Anda, BUKAN: GENIEACS_UI_JWT_SECRET: ""
```

---

## 4. Ganti password ConnectionRequest (lakukan SEKARANG)

`provisions/inform.js` memakai password bawaan `acsmanager` untuk ConnectionRequest — dipakai
GenieACS saat "menyapa" ONU (fitur Summon). Ganti sebelum ada ONU yang terhubung:

```bash
nano provisions/inform.js      # ubah:  const password = "acsmanager";
```

Kenapa sekarang: nilai ini ditanam ke ONU **sekali** saat inform pertama. Kalau diganti setelah
armada terlanjur besar, semua ONU baru mengadopsi nilai baru pada inform berikutnya (≤ 5 menit) —
selama masa transisi Summon bisa gagal 401.

---

## 5. Nyalakan GenieACS core

```bash
cd docker
docker compose up -d --build       # build pertama beberapa menit
docker compose ps                  # genieacs & genieacs-mongo harus Up
```

Verifikasi:

```bash
ss -tlnp | grep -E '7547|7557|7567|3000'
# 7547 & 7567 di 0.0.0.0 ; 7557 & 3000 hanya di 127.0.0.1

curl -s -o /dev/null -w '%{http_code}\n' 'http://127.0.0.1:7557/devices/?projection=_id'
# 200 = NBI hidup (isi masih kosong, wajar)
```

---

## 6. Tanam virtual parameter, provision & konfigurasi UI

`seed.py` idempotent — aman diulang. Ia menunggu NBI siap dulu (`ACS_NBI_WAIT`, default 90 detik)
dan mengulang tiap PUT yang gagal, jadi tahan kalau container baru saja start.

```bash
cd ..                    # kembali ke root repo
python3 seed.py --list   # lihat paket Core / Standard / Advanced beserta isinya
python3 seed.py --dry-run
python3 seed.py          # Core + Standard (default)
python3 seed.py --check  # bandingkan hasil dgn yang ada di server
```

Paket: **Core** (wajib — provision + VP identitas/jaringan/optik + tampilan UI), **Standard**
(suhu transceiver), **Advanced** (alias `gettemp` legacy). Tambah `--all` bila ingin ketiganya.

Kalau NBI/Mongo Anda tidak standar:

```bash
ACS_NBI=http://127.0.0.1:7557 \
ACS_MONGO_EXEC="docker exec -i genieacs-mongo mongo --quiet genieacs" \
python3 seed.py
```

---

## 7. Buat user admin pertama

**GenieACS tidak punya user bawaan**, dan UI-nya sendiri butuh login — jadi user pertama harus
ditulis langsung ke MongoDB. Dashboard membaca koleksi `users` di database `genieacs`, dengan
password ter-hash **pbkdf2-sha512, 10.000 iterasi, 128 byte** (sama persis dengan cara GenieACS
sendiri, sehingga user yang sama juga berlaku untuk UI bawaan `:3000`).

```bash
read -rsp 'Password admin baru: ' PASSWORD; echo
USERNAME=admin
ROLE=admin                       # pilihan: admin | noc | cs

CRED=$(node -e '
const { pbkdf2Sync, randomBytes } = require("node:crypto");
const salt = randomBytes(64).toString("hex");
const hash = pbkdf2Sync(process.argv[1], salt, 10000, 128, "sha512").toString("hex");
console.log(salt + " " + hash);
' "$PASSWORD")
SALT=${CRED% *}; HASH=${CRED#* }

docker exec -i genieacs-mongo mongo genieacs --quiet --eval '
db.users.updateOne(
  { _id: "'"$USERNAME"'" },
  { $set: { password: "'"$HASH"'", salt: "'"$SALT"'", roles: "'"$ROLE"'" } },
  { upsert: true }
)'

unset PASSWORD CRED SALT HASH
```

Verifikasi (jangan pernah menampilkan kolom `password`/`salt`):

```bash
docker exec -i genieacs-mongo mongo genieacs --quiet --eval \
  'db.users.find({}, {roles: 1}).forEach(u => print(u._id + " -> " + u.roles))'
```

Role dashboard: **`admin`** (penuh), **`noc`** (operasional: view/summon/reboot/WiFi/WAN/param/tags/faults),
**`cs`** (terbatas). Setelah bisa login, user berikutnya cukup dibuat lewat menu **Admin → Users**.

> **Untuk UI bawaan GenieACS (`:3000`)** user di atas sudah sah, tapi UI itu juga butuh entri di
> koleksi `permissions` per role — tanpa itu halamannya kosong. Contoh untuk role `admin`:
> ```bash
> docker exec -i genieacs-mongo mongo genieacs --quiet --eval '
> ["devices","faults","files","presets","provisions","virtualParameters","config","permissions","users"]
>   .forEach(r => db.permissions.updateOne({_id:"admin:"+r+":3"},
>     {$set:{role:"admin", resource:r, access:3, validate:"true"}}, {upsert:true}))'
> ```
> Dashboard ACS Manager tidak memakai `permissions` ini — RBAC-nya sendiri berbasis kolom `roles`.

---

## 8. Jalankan dashboard

```bash
cd dashboard-antd
npm install
npm run dev            # http://IP-SERVER:5173
```

Login dengan user dari langkah 7. Kalau sudah tampil, jadikan layanan permanen:

```ini
# /etc/systemd/system/acs-dashboard.service
[Unit]
Description=ACS Manager Dashboard
After=network.target docker.service

[Service]
WorkingDirectory=/home/USER/acs-manager/dashboard-antd
ExecStart=/usr/bin/npm run dev -- --host --port 5173
Restart=always
User=USER

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload && sudo systemctl enable --now acs-dashboard
```

> **Kenapa mode `dev`, bukan `npm run build` + folder statis?** Fitur login, `/api` (admin),
> `/api/v1` (mesin), audit log, WiFi/WAN CRUD, dan Akses ONT dijalankan oleh plugin server di
> `vite.config.js` + `ext-api.js` — plugin itu hanya aktif saat Vite menjalankan server (`dev`/`preview`).
> Build statis hanya menghasilkan tampilan tanpa backend tersebut. Pola yang terbukti dipakai di
> produksi: service `dev` di balik nginx + HTTPS.

Contoh nginx (tambahkan HTTPS via `certbot --nginx`):

```nginx
server {
    listen 80;
    server_name acs.example.com;
    location / {
        proxy_pass http://127.0.0.1:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;      # HMR/websocket
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

---

## 9. Arahkan ONU ke ACS

Isi di sisi ONU/OLT: **ACS URL = `http://IP-SERVER:7547`**, `PeriodicInformEnable = true`,
`PeriodicInformInterval = 300`.

Tiga cara, pilih sesuai skala:

1. **Manual per-ONU** — menu Management/Network → TR-069 di web ONU. Cocok untuk uji coba.
2. **Profil OLT** — dorong ke banyak ONU sekaligus dari OLT.
3. **DHCP Option 43** (sub-option 1 = ACS URL) di DHCP server jaringan manajemen ONU — paling rapi
   untuk produksi. Perhatikan: DHCP untuk VLAN manajemen ONU biasanya ada di OLT/core, bukan di server ACS.

Agar **Summon** (refresh paksa dari dashboard) bekerja, server ACS harus bisa membuka koneksi
balik ke ONU di port ConnectionRequest (umumnya **58000**). Kalau ONU berada di subnet manajemen
terpisah, pastikan rutenya dua arah.

---

## 10. Verifikasi akhir

```bash
curl -s 'http://127.0.0.1:7557/devices/?projection=_id' | head -c 300   # ONU mulai terdaftar
```

Di dashboard, dalam ≤ 5 menit setelah ONU diarahkan:

- **Overview** — jumlah perangkat naik, grafik model/redaman/suhu terisi.
- **Perangkat ONU** — kolom Serial, IP, PPPoE, RX/redaman, suhu terisi (bukan semua `N/A`).
- Buka satu perangkat → tombol **Summon** memberi respons 200 (202 = CPE sedang sibuk, normal).

Refresh massal (sekuensial + jeda, jangan paralel di armada besar):

```bash
python3 summon-all.py 1.5      # jeda 1,5 detik antar perangkat
```

---

## Troubleshooting

| Gejala | Kemungkinan sebab | Tindakan |
|---|---|---|
| `docker compose config` menampilkan `GENIEACS_UI_JWT_SECRET: ""` | `.env` ada di root, bukan di `docker/` | Pindahkan ke `docker/.env`, atau pakai `--env-file ../.env`, lalu `docker compose up -d` |
| Semua PUT `seed.py` gagal | NBI belum hidup / port lain | `docker compose ps`, cek `curl 127.0.0.1:7557`, atau set `ACS_NBI` |
| `seed.py` bagian `config` gagal | nama container Mongo berbeda | Set `ACS_MONGO_EXEC="docker exec -i <container> mongo --quiet genieacs"` |
| ONU tidak muncul sama sekali | 7547 terblokir firewall/NAT, ACS URL salah, atau ONU beda VLAN manajemen | Uji dari sisi ONU: `telnet IP-SERVER 7547`; cek `docker compose logs genieacs` |
| ONU muncul lalu hilang / "Disconnected" | inform interval > ambang online dashboard (10 menit) | Pastikan `PeriodicInformInterval = 300` tertanam (provision `inform`) |
| Summon balas **401** | password ConnectionRequest di ONU ≠ di provision | Samakan `provisions/inform.js`, `python3 seed.py`, tunggu inform berikutnya (≤ 5 menit) |
| Summon balas **202** | CPE sedang sibuk sesi lain | Normal, ulangi beberapa saat lagi |
| RX/suhu `N/A` di sebagian merek | path parameter merek itu belum terdaftar, atau modul optik memang tak melapor | Tambah kandidat path di `virtual-parameters/RXPower.multimodel.js` / `Temperature.js` lalu seed ulang. Nilai lantai (RX `-40 dBm`, suhu `0`) memang sengaja jadi `N/A`, bukan angka palsu |
| Login ditolak terus | user belum ada, atau ditulis ke Mongo yang salah | Ulangi langkah 7, pastikan container `genieacs-mongo` & database `genieacs` |
| Dashboard blank / tak bisa diakses | `npm install` belum selesai, atau port 5173 diblok | `systemctl status acs-dashboard`, cek log `journalctl -u acs-dashboard -n 50` |

---

## Checklist keamanan

- [ ] `GENIEACS_UI_JWT_SECRET` diisi string acak, dan terbukti terbaca (`docker compose config`).
- [ ] Password ConnectionRequest di `provisions/inform.js` sudah diganti dari `acsmanager`.
- [ ] `.env` tidak ikut ter-commit (sudah masuk `.gitignore`).
- [ ] NBI `:7557` & UI `:3000` tetap terkunci `127.0.0.1`.
- [ ] Dashboard di balik nginx + HTTPS; port 5173 tidak dibuka langsung ke internet.
- [ ] Firewall: publik hanya `7547`, `7567`, `80/443`, dan SSH.
- [ ] User admin awal memakai password kuat; user operasional dibuat dengan role `noc`/`cs`, bukan `admin`.

---

## Perawatan

**Backup** (semua data GenieACS + user + audit ada di Mongo):

```bash
docker exec genieacs-mongo mongodump --db genieacs --archive > acs-backup-$(date +%F).archive
# pulihkan:
docker exec -i genieacs-mongo mongorestore --archive --drop < acs-backup-YYYY-MM-DD.archive
```

**Update**:

```bash
git pull
cd docker && docker compose up -d --build && cd ..
python3 seed.py            # tanam ulang VP/provision versi baru (idempotent)
sudo systemctl restart acs-dashboard
```

**Ganti merek (whitelabel)** — lihat bagian Rebranding di [`../README.md`](../README.md).
