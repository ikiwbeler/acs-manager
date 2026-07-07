#!/usr/bin/env bash
# ============================================================================
# ACS Manager — one-shot installer untuk Ubuntu 20.04/22.04
# Install: Docker + Compose plugin, Node.js 18, nginx, git.
# Jalankan:  chmod +x setup.sh && ./setup.sh
# ============================================================================
set -euo pipefail

log() { echo -e "\n\033[1;34m[setup]\033[0m $*"; }
warn() { echo -e "\033[1;33m[warn]\033[0m $*"; }

if [ "$(id -u)" = "0" ]; then
  warn "Jalankan sebagai user biasa (bukan root). Script akan pakai sudo bila perlu."
  exit 1
fi

log "Update paket sistem..."
sudo apt update && sudo apt upgrade -y

log "Install prasyarat dasar..."
sudo apt install -y ca-certificates curl gnupg git nginx openssl ufw

# ---- Docker ----
if command -v docker >/dev/null 2>&1; then
  log "Docker sudah terpasang: $(docker --version)"
else
  log "Install Docker Engine + Compose plugin..."
  curl -fsSL https://get.docker.com | sudo sh
fi
sudo usermod -aG docker "$USER" || true

# ---- Node.js 18 ----
NODE_MAJOR="$(node -v 2>/dev/null | sed 's/v\([0-9]*\).*/\1/' || echo 0)"
if [ "${NODE_MAJOR:-0}" -ge 18 ]; then
  log "Node.js sudah memadai: $(node -v)"
else
  log "Install Node.js 18..."
  curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
  sudo apt install -y nodejs
fi

# ---- Firewall (opsional, tidak di-enable otomatis) ----
log "Menyiapkan aturan firewall (belum di-enable)..."
sudo ufw allow 22/tcp   >/dev/null 2>&1 || true
sudo ufw allow 7547/tcp >/dev/null 2>&1 || true   # CWMP
sudo ufw allow 7567/tcp >/dev/null 2>&1 || true   # FS
sudo ufw allow 80/tcp   >/dev/null 2>&1 || true
sudo ufw allow 443/tcp  >/dev/null 2>&1 || true
warn "Firewall belum aktif. Aktifkan manual bila perlu: sudo ufw enable"

log "Versi terpasang:"
echo "  docker : $(docker --version 2>/dev/null || echo 'perlu re-login')"
echo "  node   : $(node -v 2>/dev/null || echo '-')"
echo "  nginx  : $(nginx -v 2>&1 || echo '-')"

cat <<'NEXT'

============================================================
  SELESAI. Langkah berikutnya:
  1) LOGOUT lalu LOGIN lagi (agar grup 'docker' aktif).
  2) cp .env.example .env  &&  edit GENIEACS_UI_JWT_SECRET
        openssl rand -hex 24    # untuk isi secret
  3) cd docker && docker compose up -d --build
  4) Import provisions & virtual-parameters (lihat INSTALL.md)
  5) cd ../dashboard-antd && npm install && npm run build
  6) Sajikan dist/ via nginx (contoh di INSTALL.md)

  Panduan VirtualBox lengkap: docs/DEPLOY-VIRTUALBOX.md
============================================================
NEXT
