# Panduan Instalasi — ACS Manager

Panduan deploy ACS Manager (GenieACS core + dashboard) di server Linux (Ubuntu/Debian).

## Prasyarat

- Linux server (disarankan 2 vCPU / 4 GB RAM untuk ratusan perangkat; skala naik sesuai jumlah ONU).
- **Docker** + **Docker Compose plugin**.
- **Node.js 18+** & npm (untuk build dashboard).
- **nginx** (untuk menyajikan dashboard produksi) — opsional saat dev.
- Port publik yang harus terbuka ke arah perangkat: **7547 (CWMP)**, **7567 (FS)**.

---

## 1. GenieACS Core (Docker)

```bash
cp .env.example .env
# Edit .env — WAJIB ganti GENIEACS_UI_JWT_SECRET:
#   openssl rand -hex 24
nano .env

cd docker
docker compose up -d --build
docker compose ps        # pastikan genieacs & genieacs-mongo Up
```

Port yang diekspos:
- `7547` CWMP — perangkat ONU connect ke sini (publik).
- `7567` FS — perangkat download firmware (publik).
- `7557` NBI & `3000` UI bawaan — **dikunci ke `127.0.0.1`** (aman). Akses UI bawaan bila perlu via SSH tunnel: `ssh -L 3000:localhost:3000 user@server`.

---

## 2. Import Provisions & Virtual Parameters

Provisions & virtual parameters ada di folder `provisions/` dan `virtual-parameters/`.
Import ke GenieACS lewat NBI (dari server, karena NBI di localhost). Contoh untuk satu virtual parameter:

```bash
# Virtual parameter (ulangi untuk tiap file di virtual-parameters/)
curl -i 'http://127.0.0.1:7557/provisions/RXPower' \
  -X PUT --data-binary @virtual-parameters/RXPower.multimodel.js

# Provision (default & inform)
curl -i 'http://127.0.0.1:7557/provisions/default' -X PUT --data-binary @provisions/default.js
curl -i 'http://127.0.0.1:7557/provisions/inform'  -X PUT --data-binary @provisions/inform.js
```

> Atau import lewat UI bawaan (`:3000`, via SSH tunnel) menu Admin → Provisions / Virtual Parameters.
> Pastikan setiap Virtual Parameter juga terdaftar di provision `default` (sudah tercantum di `provisions/default.js`).

Arahkan perangkat ke ACS via **DHCP Option 43** atau konfigurasi OLT: ACS URL = `http://IP-SERVER:7547`.

---

## 3. Dashboard (React + Ant Design)

### Mode Dev (cepat, untuk uji)
```bash
cd dashboard-antd
npm install
npm run dev        # http://IP-SERVER:5173
```

### Mode Produksi
```bash
cd dashboard-antd
npm install
npm run build      # output ke dist/
```

Sajikan `dist/` via nginx dan proxy-kan `/nbi/` ke NBI (NBI tanpa CORS, harus se-origin):

```nginx
server {
    listen 80;
    server_name acs.example.com;
    root /path/to/dashboard-antd/dist;

    location /       { try_files $uri /index.html; }
    location /nbi/   { proxy_pass http://127.0.0.1:7557/; }
}
```

> Catatan: fitur `/api` (admin), `/api/v1` (mesin), login, WiFi/WAN CRUD di-handle oleh plugin server pada `vite.config.js` + `ext-api.js`. Untuk produksi penuh dengan fitur ini, jalankan dashboard sebagai service (mis. `npm run dev`/preview di balik nginx) atau adaptasi plugin ke server Node sesuai kebutuhan. Cara paling sederhana yang sudah terbukti: jalankan `npm run dev --host` via **systemd** dan proxy nginx ke port `5173`.

Contoh unit systemd:
```ini
# /etc/systemd/system/acs-dashboard.service
[Unit]
Description=ACS Manager Dashboard
After=network.target docker.service

[Service]
WorkingDirectory=/path/to/dashboard-antd
ExecStart=/usr/bin/npm run dev -- --host --port 5173
Restart=always
User=youruser

[Install]
WantedBy=multi-user.target
```
```bash
sudo systemctl enable --now acs-dashboard
```

---

## 4. Login Pertama

Akun mengikuti akun GenieACS (dibuat via UI bawaan `:3000` atau NBI). Buat user admin pertama, lalu login ke dashboard. Selanjutnya kelola user & role (CS/NOC/Admin) dari menu **Admin → Users**.

---

## 5. Operasi Massal (Penting)

Untuk refresh banyak ONU sekaligus, gunakan **sekuensial + jeda** agar server tidak overload:

```bash
python3 summon-all.py 1.5      # 1.5 detik jeda antar perangkat
```

> Jangan menjalankan operasi massal secara paralel pada armada besar.

---

## Keamanan (Checklist)

- [ ] `GENIEACS_UI_JWT_SECRET` diganti string acak (jangan pakai default).
- [ ] `.env` tidak di-commit ke git (sudah di `.gitignore`).
- [ ] NBI `:7557` & UI `:3000` tetap terkunci ke `127.0.0.1`.
- [ ] Dashboard di balik nginx + HTTPS (Let's Encrypt) untuk akses publik.
- [ ] Firewall: hanya `7547`, `7567`, dan `443/80` (dashboard) yang publik.
