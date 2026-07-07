// ============================================================================
// ext-api.js — API mesin /api/v1/* untuk GenieACS dashboard
// Dipasang sebagai plugin Vite kedua: plugins: [react(), adminApi(), extApi()]
// Auth: API key (multi-key + scope) disimpan di db.api_keys.
//   - Manajemen key (bikin/list/cabut) di /api/admin/apikeys-* -> sudah diproteksi
//     guard admin existing di vite.config.js (butuh login admin).
//   - Pemakaian API di /api/v1/* -> auth via header API key (bukan login manusia).
// FASE 1: auth multi-key + manajemen key + /api/v1/ping (uji auth end-to-end).
// (Endpoint baca/kontrol/stats/webhook menyusul di fase berikutnya.)
// ============================================================================
import { spawnSync } from 'node:child_process';
import { randomBytes, createHash, createHmac } from 'node:crypto';

// --- helper mini (self-contained, tidak bergantung vite.config.js) ---
function mongoEval(evalStr) {
  const r = spawnSync('docker', ['exec', 'genieacs-mongo', 'mongo', 'genieacs', '--quiet', '--eval', evalStr], { encoding: 'utf8', timeout: 15000 });
  if (r.status !== 0) throw new Error((r.stderr || r.stdout || 'mongo error').trim());
  return r.stdout;
}
// Ambil baris JSON terakhir dari output mongo (sama pola dgn vite.config.js).
function lastJson(out, fallback) {
  const lines = String(out).split('\n').map((s) => s.trim()).filter(Boolean);
  const line = lines[lines.length - 1];
  if (!line) return fallback;
  try { return JSON.parse(line); } catch (e) { return fallback; }
}
function readBody(req) { return new Promise((res) => { let d = ''; req.on('data', (c) => (d += c)); req.on('end', () => res(d)); }); }
function send(res, code, obj) { res.statusCode = code; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(obj)); }

// --- API key ---
const VALID_SCOPES = ['read', 'write', 'stats', 'webhook'];
function genRawKey() { return 'atl_live_' + randomBytes(24).toString('hex'); }
function hashKey(raw) { return createHash('sha256').update(String(raw)).digest('hex'); }
function extractKey(req) {
  const h = req.headers['authorization'] || '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (m) return m[1].trim();
  const x = req.headers['x-api-key'];
  if (x) return String(x).trim();
  return '';
}
// Cari key valid + sekalian update lastUsedAt (1x docker exec). Return {id,name,scopes} | null.
function lookupKey(raw) {
  if (!raw) return null;
  const kh = hashKey(raw);
  const out = mongoEval(
    'var d=db.api_keys.findOneAndUpdate(' +
    '{keyHash:' + JSON.stringify(kh) + ',disabled:{$ne:true}},' +
    '{$set:{lastUsedAt:new Date()}}); ' +
    'print(d?JSON.stringify({id:d._id,name:d.name,scopes:d.scopes||[]}):"")'
  );
  return lastJson(out, null);
}
function hasScope(keyInfo, scope) {
  return !!(keyInfo && Array.isArray(keyInfo.scopes) && keyInfo.scopes.indexOf(scope) !== -1);
}

// --- akses GenieACS NBI (read) ---
const NBI = 'http://127.0.0.1:7557';
const ONLINE_MS = 5 * 60 * 1000; // sama dgn dashboard: online jika inform < 5 menit
// Projection ringkas vendor-netral (mirror LIST_PROJ di src/api.js).
const DEV_PROJ = [
  '_lastInform', '_tags',
  'VirtualParameters.Model', 'VirtualParameters.PONMode', 'VirtualParameters.WANIP', 'VirtualParameters.IPMgmt',
  'VirtualParameters.WANMAC', 'VirtualParameters.PPPoEUsername', 'VirtualParameters.RXPower', 'VirtualParameters.RedamanStatus',
  'VirtualParameters.Temperature', 'VirtualParameters.SuhuStatus', 'VirtualParameters.Uptime', 'VirtualParameters.ClientCount',
  'InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID',
].join(',');
async function nbiGet(path) {
  const r = await fetch(NBI + path, { signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error('NBI ' + r.status);
  return r.json();
}
async function nbiPost(path, body) {
  const r = await fetch(NBI + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(20000) });
  const text = await r.text();
  if (!r.ok) throw new Error('NBI ' + r.status + ' ' + text.slice(0, 200));
  return text;
}
// Kirim task ke device (+connection_request agar ONU langsung dipicu, sama dgn dashboard).
function postTask(id, body) { return nbiPost('/devices/' + encodeURIComponent(id) + '/tasks?connection_request', body); }
// Tebak tipe xsd dari nilai JS (utk endpoint /set yg fleksibel).
function guessType(v) { return typeof v === 'boolean' ? 'xsd:boolean' : typeof v === 'number' ? (Number.isInteger(v) ? 'xsd:int' : 'xsd:string') : 'xsd:string'; }

// ====================== WEBHOOK keluar (online/offline/fault) ======================
const VALID_EVENTS = ['online', 'offline', 'fault'];
const POLL_MS = 3 * 60 * 1000; // poll ringan tiap 3 menit (1x query NBI, sekuensial)
function getWebhooks(onlyEnabled) {
  const filter = onlyEnabled ? '{disabled:{$ne:true}}' : '{}';
  const out = mongoEval('print(JSON.stringify(db.webhooks.find(' + filter + ').toArray().map(function(w){return {id:w._id,url:w.url,events:w.events||[],secret:w.secret||"",disabled:!!w.disabled,createdAt:w.createdAt}})))');
  return lastJson(out, []);
}
// Kirim 1 event ke 1 webhook (+HMAC signature). Tidak melempar; catat gagal ke audit.
async function deliverToHook(w, event, payload) {
  const bodyObj = Object.assign({ event, at: new Date().toISOString() }, payload || {});
  const raw = JSON.stringify(bodyObj);
  const sig = createHmac('sha256', String(w.secret || '')).update(raw).digest('hex');
  try {
    const r = await fetch(w.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-ACS-Event': event, 'X-ACS-Signature': sig },
      body: raw, signal: AbortSignal.timeout(8000),
    });
    return { ok: r.ok, status: r.status };
  } catch (e) {
    audit({ action: 'webhook.fail', target: w.id, summary: 'Gagal kirim webhook ' + event + ' -> ' + w.url + ': ' + String(e.message || e), status: 'denied' });
    return { ok: false, error: String(e.message || e) };
  }
}
// Sebar 1 event ke semua webhook yg berlangganan event tsb (sekuensial).
async function deliver(event, payload) {
  let hooks; try { hooks = getWebhooks(true); } catch (e) { return; }
  for (const w of hooks) {
    if (Array.isArray(w.events) && w.events.indexOf(event) !== -1) await deliverToHook(w, event, payload);
  }
}
// Satu siklus poll: deteksi transisi online<->offline + fault baru, lalu kirim webhook.
async function pollOnce() {
  const st = globalThis.__extApiPoll;
  if (!st) return;
  try {
    const devs = await nbiGet('/devices/?projection=_lastInform');
    const now = Date.now();
    const cur = new Map();
    for (const d of devs) { const last = d._lastInform ? new Date(d._lastInform).getTime() : 0; cur.set(d._id, now - last < ONLINE_MS); }
    if (!st.initialized) { st.online = cur; st.initialized = true; } // baseline pertama: jangan kirim
    else {
      for (const [id, on] of cur) {
        const prev = st.online.get(id);
        if (prev !== undefined && prev !== on) await deliver(on ? 'online' : 'offline', { device: id });
      }
      st.online = cur;
    }
  } catch (e) {}
  try {
    const faults = await nbiGet('/faults/?projection=_id');
    const ids = new Set(faults.map((f) => f._id));
    if (!st.faultsInit) { st.faults = ids; st.faultsInit = true; }
    else { for (const fid of ids) { if (!st.faults.has(fid)) await deliver('fault', { fault: fid }); } st.faults = ids; }
  } catch (e) {}
}
function startPoller() {
  if (globalThis.__extApiPoll && globalThis.__extApiPoll.timer) return; // hindari dobel saat HMR
  globalThis.__extApiPoll = { online: new Map(), faults: new Set(), initialized: false, faultsInit: false, timer: null };
  globalThis.__extApiPoll.timer = setInterval(() => { pollOnce().catch(() => {}); }, POLL_MS);
  pollOnce().catch(() => {}); // baseline segera
}
const vp = (d, k) => (d && d.VirtualParameters && d.VirtualParameters[k] && d.VirtualParameters[k]._value != null) ? d.VirtualParameters[k]._value : null;
function ssidOf(d) { try { return d.InternetGatewayDevice.LANDevice['1'].WLANConfiguration['1'].SSID._value; } catch (e) { return null; } }
function serialOf(d) { const p = String(d._id).split('-'); return p[p.length - 1]; }
function mapDevice(d, now) {
  const last = d._lastInform ? new Date(d._lastInform).getTime() : 0;
  return {
    id: d._id, serial: serialOf(d), tags: d._tags || [],
    model: vp(d, 'Model'), mode: vp(d, 'PONMode'),
    mac: vp(d, 'WANMAC'), ip: vp(d, 'WANIP'), ipMgmt: vp(d, 'IPMgmt'),
    ssid: ssidOf(d), pppoe: vp(d, 'PPPoEUsername'),
    rx: vp(d, 'RXPower'), redaman: vp(d, 'RedamanStatus'), temp: vp(d, 'Temperature'), suhu: vp(d, 'SuhuStatus'),
    uptime: vp(d, 'Uptime'), clients: vp(d, 'ClientCount'),
    lastInform: d._lastInform || null,
    online: now - last < ONLINE_MS,
  };
}

// --- audit (tulis ke db.dash_audit yang sama dgn dashboard) ---
function audit(doc) {
  try {
    const full = Object.assign({ ts: Date.now(), user: '-', roles: 'api', status: 'ok' }, doc);
    mongoEval('db.dash_audit.insertOne(Object.assign(' + JSON.stringify(full) + ',{at:new Date()}))');
  } catch (e) {}
}
// Siapa admin yang manggil endpoint manajemen key (dari Bearer login token).
function adminUserFromReq(req, verify) {
  try {
    if (!verify) return '-';
    const h = req.headers['authorization'] || '';
    const tok = verify(h.replace(/^Bearer\s+/i, ''));
    return (tok && tok.user) || '-';
  } catch (e) { return '-'; }
}

// ============================================================================
// Plugin Vite. `helpers` opsional: { verify } dari vite.config.js untuk tahu
// user admin pada audit manajemen key (kalau tak diberi, user='-').
// ============================================================================
export function extApi(helpers) {
  const verify = helpers && helpers.verify;
  return {
    name: 'genieacs-ext-api',
    configureServer(server) {
      // pastikan index unik keyHash (sekali saja, best-effort)
      try { mongoEval('db.api_keys.createIndex({keyHash:1},{unique:true})'); } catch (e) {}

      // ---- Manajemen key (di balik guard admin existing) ----
      server.middlewares.use('/api/admin/apikeys-create', async (req, res, next) => {
        if (req.method !== 'POST') return next();
        try {
          const { name, scopes } = JSON.parse((await readBody(req)) || '{}');
          if (!name) throw new Error('name wajib diisi');
          const scp = (Array.isArray(scopes) ? scopes : [])
            .map((s) => String(s).trim())
            .filter((s) => VALID_SCOPES.indexOf(s) !== -1);
          if (!scp.length) throw new Error('scopes wajib (pilih dari: ' + VALID_SCOPES.join(', ') + ')');
          const raw = genRawKey();
          const id = 'key_' + randomBytes(6).toString('hex');
          const doc = { _id: id, name: String(name), keyHash: hashKey(raw), scopes: scp, disabled: false };
          mongoEval('db.api_keys.insertOne(Object.assign(' + JSON.stringify(doc) + ',{createdAt:new Date()}))');
          audit({ user: adminUserFromReq(req, verify), action: 'apikey.create', target: id, summary: 'Buat API key "' + name + '" (scope: ' + scp.join(',') + ')', method: 'POST', path: '/api/admin/apikeys-create' });
          // raw key ditampilkan SEKALI saja di sini; di DB cuma hash-nya.
          send(res, 200, { ok: true, id, name: String(name), scopes: scp, key: raw });
        } catch (e) { send(res, 500, { error: String(e.message || e) }); }
      });

      server.middlewares.use('/api/admin/apikeys-list', async (req, res, next) => {
        try {
          const out = mongoEval('print(JSON.stringify(db.api_keys.find({},{keyHash:0}).sort({createdAt:-1}).toArray().map(function(d){return {id:d._id,name:d.name,scopes:d.scopes||[],disabled:!!d.disabled,createdAt:d.createdAt,lastUsedAt:d.lastUsedAt||null};})))');
          send(res, 200, lastJson(out, []));
        } catch (e) { send(res, 500, { error: String(e.message || e) }); }
      });

      server.middlewares.use('/api/admin/apikeys-revoke', async (req, res, next) => {
        if (req.method !== 'POST') return next();
        try {
          const { id } = JSON.parse((await readBody(req)) || '{}');
          if (!id) throw new Error('id wajib');
          mongoEval('db.api_keys.updateOne({_id:' + JSON.stringify(String(id)) + '},{$set:{disabled:true}})');
          audit({ user: adminUserFromReq(req, verify), action: 'apikey.revoke', target: String(id), summary: 'Cabut API key ' + id, method: 'POST', path: '/api/admin/apikeys-revoke' });
          send(res, 200, { ok: true });
        } catch (e) { send(res, 500, { error: String(e.message || e) }); }
      });

      // ---- Manajemen webhook (di balik guard admin existing) ----
      server.middlewares.use('/api/admin/webhooks-create', async (req, res, next) => {
        if (req.method !== 'POST') return next();
        try {
          const { url, events, secret } = JSON.parse((await readBody(req)) || '{}');
          if (!url || !/^https?:\/\//i.test(String(url))) throw new Error('url wajib (http/https)');
          const evs = (Array.isArray(events) ? events : []).map((s) => String(s).trim()).filter((s) => VALID_EVENTS.indexOf(s) !== -1);
          if (!evs.length) throw new Error('events wajib (pilih dari: ' + VALID_EVENTS.join(', ') + ')');
          const sec = secret ? String(secret) : randomBytes(24).toString('hex');
          const id = 'wh_' + randomBytes(6).toString('hex');
          const doc = { _id: id, url: String(url), events: evs, secret: sec, disabled: false };
          mongoEval('db.webhooks.insertOne(Object.assign(' + JSON.stringify(doc) + ',{createdAt:new Date()}))');
          audit({ user: adminUserFromReq(req, verify), action: 'webhook.create', target: id, summary: 'Daftar webhook ' + url + ' (event: ' + evs.join(',') + ')', method: 'POST', path: '/api/admin/webhooks-create' });
          send(res, 200, { ok: true, id, url: String(url), events: evs, secret: sec });
        } catch (e) { send(res, 500, { error: String(e.message || e) }); }
      });
      server.middlewares.use('/api/admin/webhooks-list', async (req, res, next) => {
        try { send(res, 200, getWebhooks(false)); } catch (e) { send(res, 500, { error: String(e.message || e) }); }
      });
      server.middlewares.use('/api/admin/webhooks-delete', async (req, res, next) => {
        if (req.method !== 'POST') return next();
        try {
          const { id } = JSON.parse((await readBody(req)) || '{}');
          if (!id) throw new Error('id wajib');
          mongoEval('db.webhooks.deleteOne({_id:' + JSON.stringify(String(id)) + '})');
          audit({ user: adminUserFromReq(req, verify), action: 'webhook.delete', target: String(id), summary: 'Hapus webhook ' + id, method: 'POST', path: '/api/admin/webhooks-delete' });
          send(res, 200, { ok: true });
        } catch (e) { send(res, 500, { error: String(e.message || e) }); }
      });
      // Kirim event uji ke 1 webhook (verifikasi tanpa nunggu transisi nyata).
      server.middlewares.use('/api/admin/webhooks-test', async (req, res, next) => {
        if (req.method !== 'POST') return next();
        try {
          const { id, event } = JSON.parse((await readBody(req)) || '{}');
          if (!id) throw new Error('id wajib');
          const hooks = getWebhooks(false);
          const w = hooks.find((h) => h.id === id);
          if (!w) throw new Error('webhook tidak ditemukan: ' + id);
          const ev = VALID_EVENTS.indexOf(event) !== -1 ? event : 'online';
          const result = await deliverToHook(w, ev, { device: 'TEST-DEVICE', test: true });
          audit({ user: adminUserFromReq(req, verify), action: 'webhook.test', target: id, summary: 'Uji webhook ' + id + ' (' + ev + ') -> ' + (result.ok ? 'OK ' + result.status : 'GAGAL') });
          send(res, 200, { ok: true, delivered: result });
        } catch (e) { send(res, 500, { error: String(e.message || e) }); }
      });

      // ---- Guard /api/v1/*: wajib API key valid. Set req.apiKey lalu lanjut. ----
      server.middlewares.use('/api/v1', async (req, res, next) => {
        try {
          const info = lookupKey(extractKey(req));
          if (!info) return send(res, 401, { error: 'API key tidak valid / tidak ada (pakai header Authorization: Bearer <key> atau X-API-Key)' });
          req.apiKey = info;
          return next();
        } catch (e) { return send(res, 500, { error: String(e.message || e) }); }
      });

      // ---- /api/v1/ping: uji auth (tanpa scope, cukup key valid) ----
      server.middlewares.use('/api/v1/ping', (req, res) => {
        send(res, 200, { ok: true, pong: true, key: req.apiKey.name, scopes: req.apiKey.scopes });
      });

      // ---- /api/v1/devices  (router: read + control) ----
      // GET  /devices                 -> list ringkas (scope read)
      // GET  /devices/:id             -> detail (scope read)
      // POST /devices/:id/wifi        -> {ssid?,password?,lan?,wlan?} ganti SSID/pass (scope write)
      // POST /devices/:id/reboot      -> reboot (scope write)
      // POST /devices/:id/set         -> {params:[[path,val,type]] | {path:val}} setParameterValues (scope write)
      server.middlewares.use('/api/v1/devices', async (req, res) => {
        const m = (req.method || 'GET').toUpperCase();
        const sub = (req.url || '/').split('?')[0];
        const segs = sub.split('/').filter(Boolean).map((s) => decodeURIComponent(s));
        const id = segs[0];
        const verb = segs[1]; // undefined | 'wifi' | 'reboot' | 'set'
        const who = 'api:' + (req.apiKey && req.apiKey.name);
        try {
          // --- READ ---
          if (m === 'GET') {
            if (!hasScope(req.apiKey, 'read')) return send(res, 403, { error: 'butuh scope: read' });
            const now = Date.now();
            if (!id) {
              const data = await nbiGet('/devices/?projection=' + encodeURIComponent(DEV_PROJ));
              const devices = data.map((d) => mapDevice(d, now));
              return send(res, 200, { count: devices.length, online: devices.filter((x) => x.online).length, devices });
            }
            const arr = await nbiGet('/devices/?query=' + encodeURIComponent(JSON.stringify({ _id: id })) + '&projection=' + encodeURIComponent(DEV_PROJ));
            if (!arr || !arr.length) return send(res, 404, { error: 'device tidak ditemukan: ' + id });
            return send(res, 200, mapDevice(arr[0], now));
          }
          // --- CONTROL (POST) ---
          if (m !== 'POST') return send(res, 405, { error: 'method tidak didukung' });
          if (!id || !verb) return send(res, 404, { error: 'endpoint tidak dikenal' });
          if (!hasScope(req.apiKey, 'write')) return send(res, 403, { error: 'butuh scope: write' });
          const body = JSON.parse((await readBody(req)) || '{}');

          if (verb === 'wifi') {
            const li = body.lan || 1, wi = body.wlan || 1;
            const base = `InternetGatewayDevice.LANDevice.${li}.WLANConfiguration.${wi}`;
            const pvs = [];
            if (body.ssid != null && body.ssid !== '') pvs.push([base + '.SSID', String(body.ssid), 'xsd:string']);
            if (body.password != null && body.password !== '') pvs.push([base + '.KeyPassphrase', String(body.password), 'xsd:string']);
            if (!pvs.length) return send(res, 400, { error: 'minimal salah satu: ssid / password' });
            await postTask(id, { name: 'setParameterValues', parameterValues: pvs });
            // simpan catatan password (ONT tak ekspos KeyPassphrase) -> konsisten dgn dashboard
            if (body.password) { try { mongoEval('db.dash_wifi_pw.updateOne({_id:' + JSON.stringify(id + '|' + base) + '},{$set:{device:' + JSON.stringify(id) + ',base:' + JSON.stringify(base) + ',password:' + JSON.stringify(String(body.password)) + '}},{upsert:true})'); } catch (e) {} }
            audit({ user: who, action: 'api.wifi', target: id, summary: 'API ubah WiFi (' + base + ') @ ' + id + ': ' + pvs.map((p) => p[0].split('.').pop()).join(',') });
            return send(res, 200, { ok: true, queued: true, device: id, base, set: pvs.map((p) => p[0]) });
          }

          if (verb === 'reboot') {
            await postTask(id, { name: 'reboot' });
            audit({ user: who, action: 'api.reboot', target: id, summary: 'API reboot ' + id });
            return send(res, 200, { ok: true, queued: true, device: id, action: 'reboot' });
          }

          if (verb === 'set') {
            let pvs = body.params;
            if (pvs && !Array.isArray(pvs) && typeof pvs === 'object') pvs = Object.keys(pvs).map((k) => [k, pvs[k]]);
            if (!Array.isArray(pvs) || !pvs.length) return send(res, 400, { error: 'params wajib: array [[path,val,type]] atau objek {path:val}' });
            const norm = pvs.map((p) => (Array.isArray(p) && p.length >= 3) ? [String(p[0]), p[1], String(p[2])] : [String(p[0]), p[1], guessType(p[1])]);
            await postTask(id, { name: 'setParameterValues', parameterValues: norm });
            audit({ user: who, action: 'api.set', target: id, summary: 'API set ' + norm.length + ' param @ ' + id + ': ' + norm.map((p) => p[0].split('.').slice(-2).join('.')).slice(0, 6).join(', ') });
            return send(res, 200, { ok: true, queued: true, device: id, count: norm.length });
          }

          return send(res, 404, { error: 'verb tidak dikenal: ' + verb });
        } catch (e) { return send(res, 502, { error: String(e.message || e) }); }
      });

      // ---- /api/v1/stats  (scope: stats) ----
      server.middlewares.use('/api/v1/stats', async (req, res) => {
        if (!hasScope(req.apiKey, 'stats')) return send(res, 403, { error: 'butuh scope: stats' });
        try {
          const now = Date.now();
          const devs = await nbiGet('/devices/?projection=_lastInform');
          let online = 0;
          for (const d of devs) { const last = d._lastInform ? new Date(d._lastInform).getTime() : 0; if (now - last < ONLINE_MS) online++; }
          let faults = 0;
          try { faults = (await nbiGet('/faults/?projection=_id')).length; } catch (e) {}
          return send(res, 200, { total: devs.length, online, offline: devs.length - online, faults, generatedAt: new Date().toISOString() });
        } catch (e) { return send(res, 502, { error: 'gagal ambil dari NBI: ' + String(e.message || e) }); }
      });

      // mulai poller webhook (deteksi online/offline/fault tiap 3 menit)
      startPoller();
    },
  };
}

// ekspor util biar bisa dipakai endpoint fase berikutnya (read/control/stats)
export { mongoEval, lastJson, readBody, send, hasScope, audit, VALID_SCOPES };
