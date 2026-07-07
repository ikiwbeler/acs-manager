// Multi-model WAN MAC: first valid MAC across WAN connections.
const now = Date.now(300000);
function firstValid(path){
  const decls = declare(path, {value: now});
  for (const d of decls){
    if (d.value != null && d.value[0] != null){
      const v = String(d.value[0]);
      if (v && v !== '00:00:00:00:00:00' && v.length >= 12) return v;
    }
  }
  return '';
}
let mac = firstValid("InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANIPConnection.*.MACAddress");
if (!mac) mac = firstValid("InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANPPPConnection.*.MACAddress");
return {writable: false, value: [mac || 'N/A', "xsd:string"]};
