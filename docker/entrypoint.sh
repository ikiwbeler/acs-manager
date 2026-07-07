#!/bin/bash
# Jalankan 4 service GenieACS dalam 1 container.
set -e

echo "[genieacs] menunggu MongoDB..."
until nc -z "$GENIEACS_MONGO_HOST" 27017 2>/dev/null; do
  sleep 2
done
echo "[genieacs] MongoDB siap. Start services..."

export GENIEACS_MONGODB_CONNECTION_URL="mongodb://${GENIEACS_MONGO_HOST}:27017/genieacs"
export GENIEACS_EXT_DIR=/opt/genieacs/ext

genieacs-cwmp &
genieacs-nbi &
genieacs-fs &
genieacs-ui &

# tunggu semua background job (dash-compatible: plain wait)
wait
echo "[genieacs] semua service berhenti, container exit."
exit 1
