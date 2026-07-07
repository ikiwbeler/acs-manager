import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { pbkdf2Sync, randomBytes, createHmac } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { extApi } from './ext-api.js';

// Secret token STABIL: env DASH_SECRET > file .dash_secret (auto-dibuat sekali) > random.
// Stabil = token login tidak invalid tiap restart vite (perbaikan keterbatasan lama).
function loadSecret() {
  if (process.env.DASH_SECRET) return process.env.DASH_SECRET;
  const f = fileURLToPath(new URL('./.dash_secret', import.meta.url));
  try { if (existsSync(f)) return readFileSync(f, 'utf8').trim(); } catch (e) {}
  const s = randomBytes(32).toString('hex');
  try { writeFileSync(f, s, { mode: 0o600 }); } catch (e) {}
  return s;
}
const SECRET = loadSecret();

// === RBAC: kapabilitas per role (HARUS sinkron dgn can() di src/api.js) ===
const ROLE_CAPS = {
  admin: '*',
  noc: new Set(['view', 'summon', 'reboot', 'wifi.ssid', 'wifi.full', 'wan.edit', 'param.edit', 'tags', 'faults.clear']),
  cs: new Set(['view', 'summon', 'reboot', 'wifi.ssid']),
};
function roleHas(roles, cap) {
  if (!cap) return true; // path tak terjaga
  for (const r of String(roles || '').split(',').map((s) => s.trim()).filter(Boolean)) {
    const caps = ROLE_CAPS[r];
    if (caps === '*') return true;
    if (caps && caps.has(cap)) return true;
  }
  return false;
}
// Petakan (method, path, body) -> kapabilitas yang dibutuhkan. null = bebas (selama sudah login).
function requiredCap(method, path, body) {
  if (path.startsWith('/api/admin/')) {
    const ep = path.slice('/api/admin/'.length);
    if (ep === 'wifi-pass-save') return 'wifi.ssid';
    if (ep === 'wifi-pass-list') return 'view';
    if (ep === 'audit-list') return 'view';
    return 'admin.manage'; // config/permissions/users management
  }
  if (path.startsWith('/nbi/')) {
    const p = path.slice('/nbi/'.length);
    if (method === 'GET') {
      if (/^(config|permissions|users|provisions|virtual_parameters)\b/.test(p)) return 'admin.manage';
      return 'view';
    }
    if (/^(provisions|virtual_parameters|config|permissions|users)\b/.test(p)) return 'admin.manage';
    if (/^files\b/.test(p)) return 'firmware'; // PUT/DELETE files (upload/hapus firmware)
    if (/^faults\//.test(p) && method === 'DELETE') return 'faults.clear';
    if (/^tasks\//.test(p) && method === 'DELETE') return 'param.edit';
    if (/^devices\/[^/]+\/tags\//.test(p)) return 'tags';
    if (/^devices\/[^/]+$/.test(p) && method === 'DELETE') return 'device.delete';
    if (/^devices\/[^/]+\/tasks$/.test(p) && method === 'POST') {
      const name = body && body.name;
      if (name === 'reboot') return 'reboot';
      if (name === 'factoryReset') return 'factoryReset';
      if (name === 'download') return 'firmware';
      if (name === 'getParameterValues' || name === 'refreshObject') return 'summon';
      if (name === 'addObject' || name === 'deleteObject') return /WLANConfiguration/.test(body.objectName || '') ? 'wifi.full' : 'wan.edit';
      if (name === 'setParameterValues') {
        const pvs = body.parameterValues || [];
        const allWifi = pvs.length > 0 && pvs.every((x) => /WLANConfiguration\.\d+\.(SSID|KeyPassphrase)$/.test(x[0]));
        return allWifi ? 'wifi.ssid' : 'param.edit';
      }
      return 'param.edit';
    }
    return 'view';
  }
  return null;
}
const b64u = (b) => Buffer.from(b).toString('base64url');
function sign(payload) {
  const body = b64u(JSON.stringify(payload));
  const sig = createHmac('sha256', SECRET).update(body).digest('base64url');
  return body + '.' + sig;
}
function verify(token) {
  try {
    const [body, sig] = String(token).split('.');
    if (!body || !sig) return null;
    if (createHmac('sha256', SECRET).update(body).digest('base64url') !== sig) return null;
    const p = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (p.exp && Date.now() > p.exp) return null;
    return p;
  } catch (e) { return null; }
}
function authed(req) {
  const h = req.headers['authorization'] || '';
  return verify(h.replace(/^Bearer\s+/i, ''));
}
function mongoEval(evalStr) {
  const r = spawnSync('docker', ['exec', 'genieacs-mongo', 'mongo', 'genieacs', '--quiet', '--eval', evalStr], { encoding: 'utf8', timeout: 15000 });
  if (r.status !== 0) throw new Error((r.stderr || r.stdout || 'mongo error').trim());
  return r.stdout;
}
function readBody(req) { return new Promise((res) => { let d = ''; req.on('data', (c) => (d += c)); req.on('end', () => res(d)); }); }
function send(res, code, obj) { res.statusCode = code; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(obj)); }
const hashPw = (pw, salt) => pbkdf2Sync(pw, salt, 10000, 128, 'sha512').toString('hex');

// === AUDIT LOG (db.dash_audit): catat aksi mengubah-data, login, & akses ditolak ===
let _auditIdxDone = false;
function ensureAuditIndex() {
  if (_auditIdxDone) return; _auditIdxDone = true;
  try { mongoEval('db.dash_audit.createIndex({at:1},{expireAfterSeconds:7776000}); db.dash_audit.createIndex({ts:-1});'); } catch (e) {}
}
function deviceFromPath(path) {
  const m = path.match(/^\/nbi\/devices\/([^/]+)/);
  return m ? decodeURIComponent(m[1]) : '';
}
function auditSummary(method, path, body) {
  const dev = deviceFromPath(path);
  const p = path.replace(/^\/nbi\//, '').replace(/^\/api\/admin\//, '');
  if (/^\/nbi\/devices\/[^/]+\/tasks$/.test(path) && body) {
    const n = body.name;
    if (n === 'reboot') return { action: 'reboot', target: dev, summary: 'Reboot perangkat ' + dev };
    if (n === 'factoryReset') return { action: 'factoryReset', target: dev, summary: 'Factory reset ' + dev };
    if (n === 'download') return { action: 'firmware.push', target: dev, summary: 'Push firmware "' + (body.fileName || '') + '" ke ' + dev };
    if (n === 'addObject') { const w = /WLANConfiguration/.test(body.objectName || ''); return { action: w ? 'wifi.add' : 'wan.add', target: dev, summary: 'Tambah ' + (w ? 'WiFi (WLAN)' : 'objek WAN') + ' di ' + dev + ': ' + (body.objectName || '') }; }
    if (n === 'deleteObject') { const w = /WLANConfiguration/.test(body.objectName || ''); return { action: w ? 'wifi.del' : 'wan.del', target: dev, summary: 'Hapus ' + (w ? 'WiFi (WLAN)' : 'objek WAN') + ' di ' + dev + ': ' + (body.objectName || '') }; }
    if (n === 'setParameterValues') {
      const pvs = body.parameterValues || [];
      const names = pvs.map((x) => String(x[0]).split('.').slice(-2).join('.'));
      const allWifi = pvs.length > 0 && pvs.every((x) => /WLANConfiguration\.\d+\.(SSID|KeyPassphrase)$/.test(x[0]));
      return { action: allWifi ? 'wifi.set' : 'param.set', target: dev, summary: (allWifi ? 'Ubah SSID/Password WiFi ' : 'Ubah parameter ') + dev + ': ' + names.slice(0, 6).join(', ') + (names.length > 6 ? ' (+' + (names.length - 6) + ' lainnya)' : '') };
    }
    return { action: 'task.' + n, target: dev, summary: 'Task ' + n + ' di ' + dev };
  }
  let m2 = path.match(/^\/nbi\/devices\/[^/]+\/tags\/([^/]+)$/);
  if (m2) return { action: method === 'DELETE' ? 'tag.del' : 'tag.add', target: dev, summary: (method === 'DELETE' ? 'Hapus' : 'Tambah') + ' tag "' + decodeURIComponent(m2[1]) + '" di ' + dev };
  if (/^\/nbi\/devices\/[^/]+$/.test(path) && method === 'DELETE') return { action: 'device.del', target: dev, summary: 'Hapus perangkat ' + dev };
  if (/^\/nbi\/faults\//.test(path) && method === 'DELETE') { m2 = path.match(/faults\/(.+)$/); const f = m2 ? decodeURIComponent(m2[1]) : ''; return { action: 'fault.clear', target: f, summary: 'Clear fault ' + f }; }
  if (/^\/nbi\/tasks\//.test(path) && method === 'DELETE') { m2 = path.match(/tasks\/(.+)$/); const t = m2 ? decodeURIComponent(m2[1]) : ''; return { action: 'task.cancel', summary: 'Batalkan task ' + t }; }
  m2 = path.match(/^\/nbi\/(files|provisions|virtual_parameters|presets)\/(.+)$/);
  if (m2) return { action: m2[1] + (method === 'DELETE' ? '.del' : '.save'), summary: (method === 'DELETE' ? 'Hapus' : 'Simpan') + ' ' + m2[1] + ' "' + decodeURIComponent(m2[2]) + '"' };
  return { action: method + ' ' + p, summary: method + ' ' + p };
}
function logAudit(tok, method, path, body, extra) {
  try {
    ensureAuditIndex();
    const base = auditSummary(method, path, body);
    const info = extra || {};
    const doc = {
      ts: Date.now(),
      user: info.user || (tok && tok.user) || '-',
      roles: (tok && tok.roles) || '',
      action: info.action || base.action || '',
      summary: info.summary || base.summary || '',
      target: info.target || base.target || '',
      method: method, path: path,
      status: info.status || 'ok',
    };
    mongoEval('db.dash_audit.insertOne(Object.assign(' + JSON.stringify(doc) + ',{at:new Date()}))');
  } catch (e) {}
}

function adminApi() {
  return {
    name: 'genieacs-admin-api',
    configureServer(server) {
      // Guard RBAC: /api/admin/* & /nbi/* wajib token valid + role yang cukup (kecuali /api/login).
      // Untuk task POST (reboot/setParams/dll) body di-buffer agar bisa diperiksa, lalu ditulis
      // ulang ke proxy lewat handler 'proxyReq' (lihat konfigurasi proxy di bawah).
      server.middlewares.use(async (req, res, next) => {
        const u = req.url || '';
        if (!(u.startsWith('/api/admin') || u.startsWith('/nbi'))) return next();
        const tok = authed(req);
        if (!tok) return send(res, 401, { error: 'unauthorized' });
        const m = (req.method || 'GET').toUpperCase();
        const path = u.split('?')[0];
        try {
          if (path.startsWith('/nbi/') && m === 'POST' && /^\/nbi\/devices\/[^/]+\/tasks$/.test(path)) {
            const raw = await readBody(req);
            req.rbacBody = raw; // dipakai proxyReq utk kirim ulang body
            let bodyObj = {}; try { bodyObj = JSON.parse(raw); } catch (e) {}
            const cap = requiredCap(m, path, bodyObj);
            if (!roleHas(tok.roles, cap)) { logAudit(tok, m, path, bodyObj, { status: 'denied', action: 'denied', summary: 'DITOLAK (' + cap + '): ' + auditSummary(m, path, bodyObj).summary }); return send(res, 403, { error: 'Akses ditolak (butuh izin: ' + cap + ')' }); }
            if (bodyObj.name !== 'getParameterValues' && bodyObj.name !== 'refreshObject') logAudit(tok, m, path, bodyObj);
            return next();
          }
          const cap = requiredCap(m, path, null);
          if (!roleHas(tok.roles, cap)) { if (m !== 'GET') logAudit(tok, m, path, null, { status: 'denied', action: 'denied', summary: 'DITOLAK (' + cap + '): ' + auditSummary(m, path, null).summary }); return send(res, 403, { error: 'Akses ditolak (butuh izin: ' + cap + ')' }); }
          if (m !== 'GET' && path.startsWith('/nbi/')) logAudit(tok, m, path, null);
          return next();
        } catch (e) { return send(res, 500, { error: String(e.message || e) }); }
      });

      server.middlewares.use('/api/login', async (req, res, next) => {
        if (req.method !== 'POST') return next();
        try {
          const { username, password } = JSON.parse(await readBody(req));
          const out = mongoEval(`var u=db.users.findOne({_id:${JSON.stringify(String(username))}}); print(u?JSON.stringify({salt:u.salt,password:u.password,roles:u.roles}):"")`);
          const lines = out.split('\n').map((s) => s.trim()).filter(Boolean);
          const line = lines[lines.length - 1];
          if (!line) { logAudit(null, 'POST', '/api/login', null, { status: 'denied', action: 'login.fail', user: username, summary: 'Login GAGAL (user tidak ada): ' + username }); return send(res, 401, { error: 'Username atau password salah' }); }
          const u = JSON.parse(line);
          if (hashPw(password, u.salt) !== u.password) { logAudit(null, 'POST', '/api/login', null, { status: 'denied', action: 'login.fail', user: username, summary: 'Login GAGAL (password salah): ' + username }); return send(res, 401, { error: 'Username atau password salah' }); }
          logAudit({ user: username, roles: u.roles }, 'POST', '/api/login', null, { action: 'login', user: username, summary: 'Login berhasil' });
          send(res, 200, { token: sign({ user: username, roles: u.roles, exp: Date.now() + 12 * 3600 * 1000 }), user: username, roles: u.roles });
        } catch (e) { send(res, 500, { error: String(e.message || e) }); }
      });

      server.middlewares.use('/api/admin/user-save', async (req, res, next) => {
        if (req.method !== 'POST') return next();
        try {
          const { username, password, roles } = JSON.parse(await readBody(req));
          if (!username) throw new Error('username wajib diisi');
          let set;
          if (password) { const salt = randomBytes(64).toString('hex'); set = { password: hashPw(password, salt), salt, roles: roles || 'admin' }; }
          else set = { roles: roles || 'admin' };
          mongoEval(`db.users.updateOne({_id:${JSON.stringify(username)}},{$set:${JSON.stringify(set)}},{upsert:true})`);
          logAudit(authed(req), 'POST', '/api/admin/user-save', null, { action: 'user.save', target: username, summary: 'Simpan user "' + username + '" (role: ' + (roles || 'admin') + ')' });
          send(res, 200, { ok: true });
        } catch (e) { send(res, 500, { error: String(e.message || e) }); }
      });
      server.middlewares.use('/api/admin/user-delete', async (req, res, next) => {
        if (req.method !== 'POST') return next();
        try { const { username } = JSON.parse(await readBody(req)); mongoEval(`db.users.deleteOne({_id:${JSON.stringify(username)}})`); logAudit(authed(req), 'POST', '/api/admin/user-delete', null, { action: 'user.del', target: username, summary: 'Hapus user "' + username + '"' }); send(res, 200, { ok: true }); }
        catch (e) { send(res, 500, { error: String(e.message || e) }); }
      });
      server.middlewares.use('/api/admin/user-rename', async (req, res, next) => {
        if (req.method !== 'POST') return next();
        try {
          const { from, to } = JSON.parse(await readBody(req));
          if (!from || !to) throw new Error('from & to wajib');
          mongoEval(`var u=db.users.findOne({_id:${JSON.stringify(from)}}); if(!u){throw 'user tidak ada';} u._id=${JSON.stringify(to)}; db.users.insertOne(u); db.users.deleteOne({_id:${JSON.stringify(from)}});`);
          logAudit(authed(req), 'POST', '/api/admin/user-rename', null, { action: 'user.rename', target: to, summary: 'Rename user "' + from + '" -> "' + to + '"' });
          send(res, 200, { ok: true });
        } catch (e) { send(res, 500, { error: String(e.message || e) }); }
      });
      // Daftar user (aktif + nonaktif). Nonaktif disimpan di koleksi users_disabled.
      server.middlewares.use('/api/admin/users-list', async (req, res, next) => {
        try {
          const out = mongoEval(`var a=db.users.find({},{roles:1}).toArray().map(function(u){return {_id:u._id,roles:u.roles,disabled:false};}); var d=db.users_disabled.find({},{roles:1}).toArray().map(function(u){return {_id:u._id,roles:u.roles,disabled:true};}); print(JSON.stringify(a.concat(d)));`);
          const lines = out.split('\n').map((s) => s.trim()).filter(Boolean);
          send(res, 200, JSON.parse(lines[lines.length - 1] || '[]'));
        } catch (e) { send(res, 500, { error: String(e.message || e) }); }
      });
      server.middlewares.use('/api/admin/user-disable', async (req, res, next) => {
        if (req.method !== 'POST') return next();
        try {
          const { username } = JSON.parse(await readBody(req));
          mongoEval(`var u=db.users.findOne({_id:${JSON.stringify(username)}}); if(!u){throw 'user tidak ada';} db.users_disabled.replaceOne({_id:u._id},u,{upsert:true}); db.users.deleteOne({_id:u._id});`);
          logAudit(authed(req), 'POST', '/api/admin/user-disable', null, { action: 'user.disable', target: username, summary: 'Nonaktifkan user "' + username + '"' });
          send(res, 200, { ok: true });
        } catch (e) { send(res, 500, { error: String(e.message || e) }); }
      });
      server.middlewares.use('/api/admin/user-enable', async (req, res, next) => {
        if (req.method !== 'POST') return next();
        try {
          const { username } = JSON.parse(await readBody(req));
          mongoEval(`var u=db.users_disabled.findOne({_id:${JSON.stringify(username)}}); if(!u){throw 'user tidak ada di nonaktif';} db.users.replaceOne({_id:u._id},u,{upsert:true}); db.users_disabled.deleteOne({_id:u._id});`);
          logAudit(authed(req), 'POST', '/api/admin/user-enable', null, { action: 'user.enable', target: username, summary: 'Aktifkan kembali user "' + username + '"' });
          send(res, 200, { ok: true });
        } catch (e) { send(res, 500, { error: String(e.message || e) }); }
      });
      // Simpan password WiFi yang kita set (per device+WLAN), krn ONT tidak mengeksposnya.
      server.middlewares.use('/api/admin/wifi-pass-save', async (req, res, next) => {
        if (req.method !== 'POST') return next();
        try {
          const { device, base, password } = JSON.parse(await readBody(req));
          if (!device || !base) throw new Error('device & base wajib');
          const key = device + '|' + base;
          mongoEval(`db.dash_wifi_pw.updateOne({_id:${JSON.stringify(key)}},{$set:{device:${JSON.stringify(device)},base:${JSON.stringify(base)},password:${JSON.stringify(password || '')}}},{upsert:true})`);
          logAudit(authed(req), 'POST', '/api/admin/wifi-pass-save', null, { action: 'wifi.pass', target: device, summary: 'Simpan catatan password WiFi (' + base + ') @ ' + device });
          send(res, 200, { ok: true });
        } catch (e) { send(res, 500, { error: String(e.message || e) }); }
      });
      server.middlewares.use('/api/admin/wifi-pass-list', async (req, res, next) => {
        if (req.method !== 'POST') return next();
        try {
          const { device } = JSON.parse(await readBody(req));
          const out = mongoEval(`print(JSON.stringify(db.dash_wifi_pw.find({device:${JSON.stringify(device)}}).toArray().map(function(d){return {base:d.base,password:d.password};})))`);
          const lines = out.split('\n').map((s) => s.trim()).filter(Boolean);
          send(res, 200, JSON.parse(lines[lines.length - 1] || '[]'));
        } catch (e) { send(res, 500, { error: String(e.message || e) }); }
      });

      // Config & Permissions: NBI read-only (PUT/DELETE -> 404), jadi tulis langsung ke mongo
      // (pola sama dgn users). Dashboard membaca via NBI GET (fresh dari koleksi) sehingga
      // perubahan langsung tampak; sebagian config ui.* baru efektif di GenieACS setelah restart.
      server.middlewares.use('/api/admin/config-save', async (req, res, next) => {
        if (req.method !== 'POST') return next();
        try {
          const { id, value } = JSON.parse(await readBody(req));
          if (!id) throw new Error('id (key) wajib');
          mongoEval(`db.config.updateOne({_id:${JSON.stringify(String(id))}},{$set:{value:${JSON.stringify(String(value ?? ''))}}},{upsert:true})`);
          logAudit(authed(req), 'POST', '/api/admin/config-save', null, { action: 'config.save', target: String(id), summary: 'Ubah config "' + id + '" = ' + String(value ?? '') });
          send(res, 200, { ok: true });
        } catch (e) { send(res, 500, { error: String(e.message || e) }); }
      });
      server.middlewares.use('/api/admin/config-delete', async (req, res, next) => {
        if (req.method !== 'POST') return next();
        try { const { id } = JSON.parse(await readBody(req)); mongoEval(`db.config.deleteOne({_id:${JSON.stringify(String(id))}})`); logAudit(authed(req), 'POST', '/api/admin/config-delete', null, { action: 'config.del', target: String(id), summary: 'Hapus config "' + id + '"' }); send(res, 200, { ok: true }); }
        catch (e) { send(res, 500, { error: String(e.message || e) }); }
      });
      server.middlewares.use('/api/admin/permission-save', async (req, res, next) => {
        if (req.method !== 'POST') return next();
        try {
          const { role, resource, access, validate, filter } = JSON.parse(await readBody(req));
          if (!role || !resource || access == null) throw new Error('role, resource, access wajib');
          const acc = parseInt(access, 10);
          if (isNaN(acc)) throw new Error('access harus angka (1/2/3)');
          const id = `${role}:${resource}:${acc}`;
          const doc = { _id: id, role: String(role), resource: String(resource), access: acc, validate: String(validate || 'true') };
          if (filter) doc.filter = String(filter);
          mongoEval(`db.permissions.replaceOne({_id:${JSON.stringify(id)}},${JSON.stringify(doc)},{upsert:true})`);
          logAudit(authed(req), 'POST', '/api/admin/permission-save', null, { action: 'permission.save', target: id, summary: 'Simpan permission ' + id });
          send(res, 200, { ok: true, _id: id });
        } catch (e) { send(res, 500, { error: String(e.message || e) }); }
      });
      server.middlewares.use('/api/admin/permission-delete', async (req, res, next) => {
        if (req.method !== 'POST') return next();
        try { const { id } = JSON.parse(await readBody(req)); mongoEval(`db.permissions.deleteOne({_id:${JSON.stringify(String(id))}})`); logAudit(authed(req), 'POST', '/api/admin/permission-delete', null, { action: 'permission.del', target: String(id), summary: 'Hapus permission ' + id }); send(res, 200, { ok: true }); }
        catch (e) { send(res, 500, { error: String(e.message || e) }); }
      });
      // Log Aktivitas: baca audit (semua role yg login). Filter opsional: {limit,user,action,target}.
      server.middlewares.use('/api/admin/audit-list', async (req, res, next) => {
        try {
          let q = {}, limit = 500;
          if (req.method === 'POST') { const b = JSON.parse((await readBody(req)) || '{}'); if (b.limit) limit = Math.min(2000, parseInt(b.limit, 10) || 500); if (b.user) q.user = String(b.user); if (b.action) q.action = String(b.action); if (b.target) q.target = String(b.target); }
          const out = mongoEval('print(JSON.stringify(db.dash_audit.find(' + JSON.stringify(q) + ').sort({ts:-1}).limit(' + limit + ').toArray().map(function(d){return {ts:d.ts,user:d.user,roles:d.roles,action:d.action,summary:d.summary,target:d.target,method:d.method,status:d.status};})))');
          const lines = out.split('\n').map((s) => s.trim()).filter(Boolean);
          send(res, 200, JSON.parse(lines[lines.length - 1] || '[]'));
        } catch (e) { send(res, 500, { error: String(e.message || e) }); }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), adminApi(), extApi({ verify })],
  server: {
    host: true, port: 5173,
    proxy: { '/nbi': {
      target: 'http://127.0.0.1:7557', changeOrigin: true, rewrite: (p) => p.replace(/^\/nbi/, ''),
      configure: (proxy) => {
        // Body task POST sudah di-buffer guard RBAC (stream terpakai) -> kirim ulang ke target.
        proxy.on('proxyReq', (proxyReq, req) => {
          if (req.rbacBody != null) {
            proxyReq.setHeader('Content-Length', Buffer.byteLength(req.rbacBody));
            proxyReq.write(req.rbacBody);
          }
        });
      },
    } },
  },
});
