// WAN IP multi-model. Prioritas: IP dari koneksi PPPoE ber-username (internet routed aktif) -> PPP IP lain -> IPoE non-TR069 -> apa pun valid.
const now = Date.now(300000);
function pstr(p){ return (p && p.join) ? p.join('.') : String(p); }
function gather(path, arr){
  const decls = declare(path, {value: now});
  for (const d of decls){ if (d.value != null && d.value[0] != null) arr.push({path: pstr(d.path), val: String(d.value[0])}); }
}
const ipc=[], pppip=[], users=[], svcs=[];
gather("InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANIPConnection.*.ExternalIPAddress", ipc);
gather("InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANPPPConnection.*.ExternalIPAddress", pppip);
gather("InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANPPPConnection.*.Username", users);
gather("InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANIPConnection.*.X_CT-COM_ServiceList", svcs);
function wcdKey(p){ return p.split('.').slice(0,5).join('.'); }
function findBy(arr,key){ for (let i=0;i<arr.length;i++){ if (wcdKey(arr[i].path)===key) return arr[i].val; } return ''; }
function valid(ip){ return ip && ip !== '0.0.0.0' && ip.length >= 7; }
let best='';
for (let i=0;i<pppip.length && !best;i++){ if (valid(pppip[i].val) && findBy(users,wcdKey(pppip[i].path))) best=pppip[i].val; }
for (let i=0;i<pppip.length && !best;i++){ if (valid(pppip[i].val)) best=pppip[i].val; }
for (let i=0;i<ipc.length && !best;i++){ if (valid(ipc[i].val) && findBy(svcs,wcdKey(ipc[i].path)).toUpperCase().indexOf('TR069')<0) best=ipc[i].val; }
for (let i=0;i<ipc.length && !best;i++){ if (valid(ipc[i].val)) best=ipc[i].val; }
return {writable:false, value:[best || 'N/A', "xsd:string"]};
