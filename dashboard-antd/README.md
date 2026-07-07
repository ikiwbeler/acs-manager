# GenieACS Dashboard (React + Ant Design)

Frontend Ant Design yang membaca data dari NBI GenieACS (:7557).

## Jalankan (dev)
```
npm install
npm run dev        # http://<server>:5173  (proxy /nbi -> 127.0.0.1:7557)
```

## Build produksi
```
npm run build      # output ke dist/
```
Sajikan `dist/` via nginx, dan proxy-kan `/nbi/` ke `http://127.0.0.1:7557/` (NBI tidak ada CORS, jadi harus se-origin via proxy). Contoh nginx:
```
location /        { root /path/dist; try_files $uri /index.html; }
location /nbi/    { proxy_pass http://127.0.0.1:7557/; }
```

## Catatan
- Data per device dibaca dari VirtualParameters (Model, PONMode, WANIP, IPMgmt, WANMAC, PPPoEUsername, RXPower, RedamanStatus, Temperature, SuhuStatus, Uptime, ClientCount) yang sudah dibuat di GenieACS.
- Halaman: Overview (statistik + pie chart antd), Perangkat ONU (tabel antd + search + tombol Summon).
- Tema antd: primary #1677ff.
