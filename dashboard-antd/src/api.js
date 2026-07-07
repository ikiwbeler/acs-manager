const BASE = '/nbi';
const LIST_PROJ = [
  '_lastInform','_tags',
  'VirtualParameters.Model','VirtualParameters.PONMode','VirtualParameters.WANIP','VirtualParameters.IPMgmt',
  'VirtualParameters.WANMAC','VirtualParameters.PPPoEUsername','VirtualParameters.RXPower','VirtualParameters.RedamanStatus',
  'VirtualParameters.Temperature','VirtualParameters.SuhuStatus','VirtualParameters.Uptime','VirtualParameters.ClientCount',
  'InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID',
].join(',');

// --- Auth ---
export const getToken = () => localStorage.getItem('dash_token') || '';
export const currentUser = () => localStorage.getItem('dash_user') || '';
export const currentRoles = () => localStorage.getItem('dash_roles') || '';
export const isAuthed = () => !!getToken();
export function logout() { ['dash_token', 'dash_user', 'dash_roles'].forEach((k) => localStorage.removeItem(k)); location.reload(); }
export async function login(username, password) {
  const r = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Login gagal');
  localStorage.setItem('dash_token', j.token);
  localStorage.setItem('dash_user', username);
  localStorage.setItem('dash_roles', j.roles || '');
  return j;
}

// === RBAC (mirror dari ROLE_CAPS di vite.config.js — JAGA AGAR SINKRON) ===
const ROLE_CAPS = {
  admin: '*',
  noc: new Set(['view', 'summon', 'reboot', 'wifi.ssid', 'wifi.full', 'wan.edit', 'param.edit', 'tags', 'faults.clear']),
  cs: new Set(['view', 'summon', 'reboot', 'wifi.ssid']),
};
// can(cap): apakah user saat ini punya kapabilitas. Dipakai UI utk sembunyikan/disable tombol.
export function can(cap) {
  if (!cap) return true;
  for (const r of currentRoles().split(',').map((s) => s.trim()).filter(Boolean)) {
    const caps = ROLE_CAPS[r];
    if (caps === '*') return true;
    if (caps && caps.has(cap)) return true;
  }
  return false;
}
export const isAdmin = () => can('admin.manage');
// fetch dgn token; auto-logout bila 401
function afetch(url, opts = {}) {
  const h = { ...(opts.headers || {}) };
  const t = getToken();
  if (t) h['Authorization'] = 'Bearer ' + t;
  return fetch(url, { ...opts, headers: h }).then((r) => {
    if (r.status === 401) { localStorage.removeItem('dash_token'); localStorage.removeItem('dash_user'); location.reload(); }
    return r;
  });
}

const vp = (d, k) => d?.VirtualParameters?.[k]?._value ?? null;
function ssid(d){ try { return d.InternetGatewayDevice.LANDevice['1'].WLANConfiguration['1'].SSID._value; } catch { return null; } }
function serial(d){ const p = d._id.split('-'); return p[p.length - 1]; }

export async function getDevices() {
  const res = await afetch(`${BASE}/devices/?projection=${encodeURIComponent(LIST_PROJ)}`);
  const data = await res.json();
  const now = Date.now();
  return data.map((d) => {
    const last = d._lastInform ? new Date(d._lastInform).getTime() : 0;
    return {
      id: d._id, key: d._id, serial: serial(d), tags: d._tags || [],
      mac: vp(d,'WANMAC'), model: vp(d,'Model'), mode: vp(d,'PONMode'),
      ip: vp(d,'WANIP'), ipMgmt: vp(d,'IPMgmt'), ssid: ssid(d), pppoe: vp(d,'PPPoEUsername'),
      rx: vp(d,'RXPower'), redaman: vp(d,'RedamanStatus'), temp: vp(d,'Temperature'), suhu: vp(d,'SuhuStatus'),
      uptime: vp(d,'Uptime'), clients: vp(d,'ClientCount'), lastInform: d._lastInform,
      online: now - last < 5 * 60 * 1000,
    };
  });
}
export async function getDevice(id){
  const q = encodeURIComponent(JSON.stringify({ _id: id }));
  const r = await afetch(`${BASE}/devices/?query=${q}`);
  const a = await r.json();
  return a[0] || null;
}
function task(id, body, cr = true){
  return afetch(`${BASE}/devices/${encodeURIComponent(id)}/tasks${cr ? '?connection_request' : ''}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}
export const summon = (id) => task(id, { name:'getParameterValues', parameterNames:['InternetGatewayDevice.DeviceInfo.UpTime'] });
export const reboot = (id) => task(id, { name:'reboot' });
export const factoryReset = (id) => task(id, { name:'factoryReset' });
export const refreshAll = (id) => task(id, { name:'refreshObject', objectName:'' });
export const refreshHosts = (id) => task(id, { name:'refreshObject', objectName:'InternetGatewayDevice.LANDevice.1.Hosts' });
export const refreshWlan = (id) => task(id, { name:'getParameterValues', parameterNames: [
  'InternetGatewayDevice.LANDevice.*.WLANConfiguration.*.SSID',
  'InternetGatewayDevice.LANDevice.*.WLANConfiguration.*.KeyPassphrase',
  'InternetGatewayDevice.LANDevice.*.WLANConfiguration.*.Enable',
  'InternetGatewayDevice.LANDevice.*.WLANConfiguration.*.Standard',
] });
export const refreshWan = (id) => task(id, { name:'getParameterValues', parameterNames: [
  'InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANIPConnection.*.Name',
  'InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANIPConnection.*.Enable',
  'InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANIPConnection.*.ConnectionType',
  'InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANIPConnection.*.AddressingType',
  'InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANIPConnection.*.ExternalIPAddress',
  'InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANIPConnection.*.ConnectionStatus',
  'InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANPPPConnection.*.Name',
  'InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANPPPConnection.*.Enable',
  'InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANPPPConnection.*.Username',
  'InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANPPPConnection.*.ConnectionType',
  'InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANPPPConnection.*.ExternalIPAddress',
  'InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANPPPConnection.*.ConnectionStatus',
  'InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANIPConnection.*.X_CT-COM_ServiceList',
  'InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANPPPConnection.*.X_CT-COM_ServiceList',
  'InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.X_CT-COM_WANGponLinkConfig.VLANIDMark',
  'InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.X_CT-COM_WANGponLinkConfig.Mode',
  'InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.X_CT-COM_WANGponLinkConfig.Enable',
  'InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.X_CT-COM_WANEponLinkConfig.VLANIDMark',
  'InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.X_CT-COM_WANEponLinkConfig.Mode',
  'InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.X_CT-COM_WANEponLinkConfig.Enable',
  'InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANIPConnection.*.X_ZTE-COM_VLANID',
  'InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANIPConnection.*.X_ZTE-COM_VLANEnable',
  'InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANPPPConnection.*.X_ZTE-COM_VLANID',
  'InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANPPPConnection.*.X_ZTE-COM_VLANEnable',
  'InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANIPConnection.*.X_ZTE-COM_ServiceList',
  'InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANPPPConnection.*.X_ZTE-COM_ServiceList',
  'InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANIPConnection.*.X_ZTE-COM_LanInterface',
  'InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANPPPConnection.*.X_ZTE-COM_LanInterface',
  'InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANIPConnection.*.X_CT-COM_LanInterface',
  'InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANPPPConnection.*.X_CT-COM_LanInterface',
  'InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANIPConnection.*.X_CT-COM_LanInterface-DHCPEnable',
  'InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANPPPConnection.*.X_CT-COM_LanInterface-DHCPEnable',
  'InternetGatewayDevice.LANDevice.*.LANEthernetInterfaceConfig.*.Enable',
  'InternetGatewayDevice.LANDevice.*.WLANConfiguration.*.SSID',
] });
export const getParams = (id, names) => task(id, { name:'getParameterValues', parameterNames: names });

// Indeks anak (non-_) dari sebuah node di device tree, mengikuti path bertitik.
function childIndices(dev, path){
  let n = dev;
  for (const seg of path.split('.')) { if (!n || typeof n !== 'object') return []; n = n[seg]; }
  if (!n || typeof n !== 'object') return [];
  return Object.keys(n).filter((k) => !k.startsWith('_'));
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// addObject itu async (butuh ≥1 siklus sesi). Picu connection request berulang sampai
// indeks anak baru muncul di parentPath, atau timeout. Mengembalikan indeks baru (string).
async function addAndWait(id, parentPath, timeoutMs, onStep){
  const before = childIndices(await getDevice(id), parentPath);
  await addObject(id, 'InternetGatewayDevice.' + parentPath);
  const deadline = Date.now() + (timeoutMs || 45000);
  while (Date.now() < deadline) {
    // Picu sesi via leaf ringan (cepat selesai, tak menumpuk task refresh) agar addObject tereksekusi.
    await getParams(id, ['InternetGatewayDevice.DeviceInfo.UpTime']).catch(() => {});
    await sleep(4500);
    const after = childIndices(await getDevice(id), parentPath);
    const fresh = after.filter((k) => !before.includes(k));
    if (fresh.length) return fresh[fresh.length - 1];
    if (onStep) onStep('menunggu ONU membuat objek...');
  }
  throw new Error('ONU tidak membuat objek dalam waktu yang ditentukan (mungkin tidak mengizinkan tambah WAN).');
}

// Buat WAN baru terpandu: tambah WCD -> tambah koneksi (PPP/IP) -> set VLAN/ServiceList/kredensial.
// o: { ppp, name, type, service, vlan, user, pass, addr, hasGlc }
export async function createWanGuided(id, o, onStep){
  const STEP = onStep || (() => {});
  STEP('Membuat WAN Connection Device baru...');
  const ci = await addAndWait(id, 'WANDevice.1.WANConnectionDevice', 50000, STEP);
  const kind = o.ppp ? 'WANPPPConnection' : 'WANIPConnection';
  STEP(`Menambah koneksi ${o.ppp ? 'PPPoE' : 'IPoE'} (WCD ${ci})...`);
  const wcd = `WANDevice.1.WANConnectionDevice.${ci}`;
  const ki = await addAndWait(id, `${wcd}.${kind}`, 50000, STEP);
  STEP('Mengatur VLAN, ServiceList & parameter koneksi...');
  const base = `InternetGatewayDevice.${wcd}.${kind}.${ki}`;
  const pvs = [];
  // Prefix vendor: ZTE pakai X_ZTE-COM_, lainnya X_CT-COM_
  const zte = o.vlanScheme === 'zte';
  const pfx = zte ? 'X_ZTE-COM_' : 'X_CT-COM_';
  if (o.name) pvs.push([base + '.Name', o.name, 'xsd:string']);
  if (o.type) pvs.push([base + '.ConnectionType', o.type, 'xsd:string']);
  if (o.service) pvs.push([base + '.' + pfx + 'ServiceList', o.service, 'xsd:string']);
  pvs.push([base + '.Enable', true, 'xsd:boolean']);
  if (o.ppp) { if (o.user) pvs.push([base + '.Username', o.user, 'xsd:string']); if (o.pass) pvs.push([base + '.Password', o.pass, 'xsd:string']); }
  else if (o.addr) pvs.push([base + '.AddressingType', o.addr, 'xsd:string']);
  if (o.lanif && o.lanif.length) pvs.push([base + '.' + pfx + 'LanInterface', o.lanif.join(','), 'xsd:string']);
  if (!zte && o.dhcp != null) pvs.push([base + '.X_CT-COM_LanInterface-DHCPEnable', !!o.dhcp, 'xsd:boolean']);
  if (o.hasGlc && o.vlan !== '' && o.vlan != null) {
    const vid = parseInt(o.vlan, 10);
    if (!isNaN(vid)) {
      if (zte) {
        // ZTE: VLAN per-koneksi
        pvs.push([base + '.X_ZTE-COM_VLANEnable', vid > 0, 'xsd:boolean']);
        pvs.push([base + '.X_ZTE-COM_VLANID', vid, 'xsd:int']);
      } else {
        // CT-COM: link config per-WCD (Gpon utk GPON, Epon utk EPON)
        const linkNode = o.vlanScheme === 'epon' ? 'X_CT-COM_WANEponLinkConfig' : 'X_CT-COM_WANGponLinkConfig';
        const glc = `InternetGatewayDevice.${wcd}.${linkNode}`;
        pvs.push([glc + '.Enable', true, 'xsd:boolean']);
        pvs.push([glc + '.Mode', vid > 0 ? 2 : 1, 'xsd:int']);
        pvs.push([glc + '.VLANIDMark', vid, 'xsd:int']);
      }
    }
  }
  await setParams(id, pvs);
  // setParams juga async — drive sesi sampai Name commit (ONT butuh ~30-40s + beberapa siklus sesi).
  STEP('Menerapkan konfigurasi ke ONU (butuh ~30-60 detik)...');
  const dl = Date.now() + 75000;
  let ok = false;
  while (Date.now() < dl) {
    await sleep(5000);
    const d = await getDevice(id);
    let n = d;
    for (const seg of (base + '.Name').split('.')) { n = n && n[seg]; }
    if (n && n._value === o.name) { ok = true; break; }
    await getParams(id, ['InternetGatewayDevice.DeviceInfo.UpTime']).catch(() => {});
  }
  STEP(ok ? 'Selesai.' : 'Konfigurasi terkirim (ONU sedang menerapkan, refresh sebentar lagi).');
  return { ci, ki, committed: ok };
}
export const setParams = (id, pvs) => task(id, { name:'setParameterValues', parameterValues: pvs });
export const downloadToDevice = (id, fileType, fileName) => task(id, { name:'download', fileType, fileName });
export const addObject = (id, objectName) => task(id, { name:'addObject', objectName });
export const deleteObject = (id, objectName) => task(id, { name:'deleteObject', objectName });
export async function getDeviceTasks(id){
  const q = encodeURIComponent(JSON.stringify({ device: id }));
  const r = await afetch(`${BASE}/tasks/?query=${q}`); return r.json();
}
export const deleteTask = (tid) => afetch(`${BASE}/tasks/${encodeURIComponent(tid)}`, { method:'DELETE' });
export const uploadFile = (name, file, meta = {}) => afetch(`${BASE}/files/${encodeURIComponent(name)}`, {
  method: 'PUT',
  headers: { fileType: meta.fileType || '', oui: meta.oui || '', productClass: meta.productClass || '', version: meta.version || '' },
  body: file,
});
export const addTag = (id, tag) => afetch(`${BASE}/devices/${encodeURIComponent(id)}/tags/${encodeURIComponent(tag)}`, { method:'POST' });
export const removeTag = (id, tag) => afetch(`${BASE}/devices/${encodeURIComponent(id)}/tags/${encodeURIComponent(tag)}`, { method:'DELETE' });
export const deleteDevice = (id) => afetch(`${BASE}/devices/${encodeURIComponent(id)}`, { method:'DELETE' });
export async function getFaults(){ const r = await afetch(`${BASE}/faults/`); return r.json(); }
export const deleteFault = (fid) => afetch(`${BASE}/faults/${encodeURIComponent(fid)}`, { method:'DELETE' });
export async function clearDeviceFaults(id){
  const all = await getFaults();
  const mine = all.filter((f) => f.device === id);
  await Promise.all(mine.map((f) => deleteFault(f._id)));
  return mine.length;
}

// --- Admin resources (NBI) ---
async function listRes(res){ const r = await afetch(`${BASE}/${res}/`); return r.json(); }
export const getProvisions = () => listRes('provisions');
export const getVirtualParameters = () => listRes('virtual_parameters');
export const getPresets = () => listRes('presets');
export const getFiles = () => listRes('files');
export const putScript = (res, name, script) => afetch(`${BASE}/${res}/${encodeURIComponent(name)}`, {
  method: 'PUT', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: script,
});
export const putJson = (res, name, obj) => afetch(`${BASE}/${res}/${encodeURIComponent(name)}`, {
  method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj),
});
export const deleteRes = (res, name) => afetch(`${BASE}/${res}/${encodeURIComponent(name)}`, { method: 'DELETE' });
async function adminPost(path, body){
  const r = await afetch('/api/admin/' + path, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'gagal');
  return j;
}
export const saveUser = (username, password, roles) => adminPost('user-save', { username, password, roles });
export const deleteUser = (username) => adminPost('user-delete', { username });
export const renameUser = (from, to) => adminPost('user-rename', { from, to });
export const disableUser = (username) => adminPost('user-disable', { username });
export const enableUser = (username) => adminPost('user-enable', { username });
export const saveWifiPass = (device, base, password) => adminPost('wifi-pass-save', { device, base, password });
export const getWifiPass = (device) => adminPost('wifi-pass-list', { device });
export async function getUsersFull(){ const r = await afetch('/api/admin/users-list'); if (!r.ok) throw new Error('gagal'); return r.json(); }
export async function getAuditLog(opts = {}){ const r = await afetch('/api/admin/audit-list', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(opts) }); if (!r.ok) throw new Error('gagal memuat log'); return r.json(); }
export const getConfig = () => listRes('config');
export const getPermissions = () => listRes('permissions');
export const getUsers = () => listRes('users');
// NBI config/permissions read-only (PUT 404) -> tulis via backend mongo (adminPost cek res.ok, jujur saat gagal).
export const saveConfigVal = (id, value) => adminPost('config-save', { id, value });
export const deleteConfigVal = (id) => adminPost('config-delete', { id });
export const savePermission = (perm) => adminPost('permission-save', perm);
export const deletePermission = (id) => adminPost('permission-delete', { id });

export function flatten(obj, prefix = '', out = []){
  for (const k in obj){
    if (k.startsWith('_')) continue;
    const v = obj[k];
    const path = prefix ? prefix + '.' + k : k;
    if (v && typeof v === 'object'){
      if ('_value' in v) out.push({ key: path, path, value: v._value, writable: !!v._writable, type: v._type });
      flatten(v, path, out);
    }
  }
  return out;
}

// --- API mesin /api/v1: manajemen key & webhook (semua lewat login admin) ---
export async function getApiKeys(){ const r = await afetch('/api/admin/apikeys-list'); if (!r.ok) throw new Error('gagal memuat keys'); return r.json(); }
export const createApiKey = (name, scopes) => adminPost('apikeys-create', { name, scopes });
export const revokeApiKey = (id) => adminPost('apikeys-revoke', { id });
export async function getWebhooks(){ const r = await afetch('/api/admin/webhooks-list'); if (!r.ok) throw new Error('gagal memuat webhooks'); return r.json(); }
export const createWebhook = (url, events, secret) => adminPost('webhooks-create', { url, events, secret });
export const deleteWebhook = (id) => adminPost('webhooks-delete', { id });
export const testWebhook = (id, event) => adminPost('webhooks-test', { id, event });
