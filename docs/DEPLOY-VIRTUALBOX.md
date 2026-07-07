# Deploy ACS Manager di VirtualBox (Ubuntu 20.04)

Panduan memasang ACS Manager pada VM VirtualBox dengan Ubuntu Server 20.04 LTS
(Focal) — cocok untuk lab, demo, atau produksi ringan.

---

## 1. Spesifikasi VM

| Komponen | Demo / Lab (≤ 50 ONU) | Produksi ringan (ratusan ONU) |
|---|---|---|
| vCPU | 2 | 4 |
| RAM | 4 GB | 8 GB |
| Disk | 40 GB (dynamic VDI) | 60–80 GB |
| Network | Bridged Adapter | Bridged Adapter |

> **RAM minimal 4 GB.** MongoDB rakus memori; di bawah itu mudah OOM saat jumlah
> perangkat bertambah. Disk pilih **dynamically allocated**.

---

## 2. Pengaturan VirtualBox (sebelum install OS)

- **Network → Adapter 1 → Bridged Adapter**, pilih NIC fisik host yang terhubung
  ke LAN/OLT. Ini WAJIB agar VM mendapat IP di LAN yang **bisa dijangkau ONU**
  pada port `7547`/`7567`.
  - Alternatif hanya untuk demo dashboard (tanpa ONU nyata): NAT + Port Forwarding
    untuk `5173`/`80`.
- **System → Processor:** centang **Enable PAE/NX**, alokasikan CPU sesuai tabel.
- **System → Acceleration:** pastikan **VT-x/AMD-V** aktif (agar Docker mulus).

---

## 3. Instalasi OS & dependensi

Install Ubuntu Server 20.04 LTS (minimal, cukup OpenSSH). Setelah login:

### Opsi A — Otomatis (disarankan)
```bash
git clone https://github.com/<owner>/acs-manager.git
cd acs-manager
chmod +x setup.sh
./setup.sh              # install Docker, Node 18, nginx, git
# logout & login lagi agar grup docker aktif
```

### Opsi B — Manual
```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs nginx git
```

---

## 4. IP statik & jaringan

Cek IP VM:
```bash
ip a
```
Beri **IP statik** (via netplan atau reservasi DHCP di router) agar alamat ACS
konsisten. Contoh netplan `/etc/netplan/00-installer-config.yaml`:
```yaml
network:
  version: 2
  ethernets:
    enp0s3:
      dhcp4: no
      addresses: [192.168.1.50/24]
      gateway4: 192.168.1.1
      nameservers:
        addresses: [1.1.1.1, 8.8.8.8]
```
```bash
sudo netplan apply
```

---

## 5. Jalankan ACS Manager

Ikuti **[INSTALL.md](../INSTALL.md)**. Ringkas:
```bash
cd acs-manager
cp .env.example .env
# WAJIB ganti GENIEACS_UI_JWT_SECRET:
openssl rand -hex 24        # salin ke .env
nano .env

cd docker && docker compose up -d --build
docker compose ps          # genieacs & genieacs-mongo harus Up

# import provisions & virtual-parameters (lihat INSTALL.md bagian 2)

cd ../dashboard-antd && npm install && npm run build
# sajikan dist/ via nginx (contoh config di INSTALL.md)
```

---

## 6. Firewall (jika ufw aktif)

```bash
sudo ufw allow 22/tcp        # SSH
sudo ufw allow 7547/tcp      # CWMP — ONU connect
sudo ufw allow 7567/tcp      # FS — download firmware
sudo ufw allow 80,443/tcp    # dashboard
sudo ufw enable
```
Port **7557 (NBI)** & **3000 (UI bawaan)** sengaja TIDAK dibuka — tetap di localhost.

---

## 7. Arahkan ONU ke ACS

Agar ONU auto-daftar, set **ACS URL** = `http://<IP-VM>:7547` melalui:
- **DHCP Option 43** di router/OLT, atau
- Konfigurasi TR-069 di OLT/ONU secara manual.

---

## 8. Troubleshooting umum di VirtualBox

| Gejala | Sebab / Solusi |
|---|---|
| `mongo` gagal start setelah upgrade | Jangan naik ke MongoDB ≥ 5.0 — butuh instruksi CPU **AVX** yang sering tidak di-passthrough VirtualBox. Repo sudah pakai **mongo:4.4** yang aman. |
| ONU tidak muncul | Adapter bukan Bridged, atau ACS URL/Option 43 salah, atau firewall menutup 7547. |
| Dashboard tak bisa diakses dari PC lain | Pakai Bridged + IP statik; cek `ufw`; akses `http://<IP-VM>` bukan `localhost`. |
| `docker: permission denied` | Belum logout-login setelah `usermod -aG docker`. |
| VM lambat / mongo OOM | RAM < 4 GB. Naikkan RAM VM. |

---

## 9. Snapshot

Setelah semua jalan, ambil **Snapshot** di VirtualBox (menu Machine → Take
Snapshot) sebagai titik pulih cepat sebelum eksperimen/upgrade.
