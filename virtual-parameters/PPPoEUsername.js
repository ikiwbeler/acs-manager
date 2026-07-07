// PPPoE username (multi-model). Prefer Connected + Name~INTERNET, then Connected, then any non-empty.
const now = Date.now(300000);
function pstr(p){ return (p && p.join) ? p.join('.') : String(p); }
function gather(path, arr){
  const decls = declare(path, {value: now});
  for (const d of decls){ if (d.value != null && d.value[0] != null) arr.push({path: pstr(d.path), val: String(d.value[0])}); }
}
const users=[]; gather("InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANPPPConnection.*.Username", users);
gather("Device.PPP.Interface.*.Username", users);
const stat=[]; gather("InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANPPPConnection.*.ConnectionStatus", stat);
const names=[]; gather("InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANPPPConnection.*.Name", names);
function key(p){ return p.split('.').slice(0,7).join('.'); }
function attr(arr,p){ const k=key(p); for (let i=0;i<arr.length;i++){ if (key(arr[i].path)===k) return arr[i].val; } return ''; }
let best='';
for (let i=0;i<users.length && !best;i++){ const u=users[i]; if (u.val && attr(stat,u.path).toUpperCase()==='CONNECTED' && attr(names,u.path).toUpperCase().indexOf('INTERNET')>=0) best=u.val; }
for (let i=0;i<users.length && !best;i++){ const u=users[i]; if (u.val && attr(stat,u.path).toUpperCase()==='CONNECTED') best=u.val; }
for (let i=0;i<users.length && !best;i++){ if (users[i].val) best=users[i].val; }
return {writable: false, value: [best || 'N/A', "xsd:string"]};
