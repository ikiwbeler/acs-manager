// IP manajemen (TR069) diekstrak dari ConnectionRequestURL. Multi-root.
const now = Date.now(300000);
function read(p){ const d=declare(p,{value:now}); return (d.value!=null && d.value[0]!=null)? String(d.value[0]):null; }
let url = read("InternetGatewayDevice.ManagementServer.ConnectionRequestURL") || read("Device.ManagementServer.ConnectionRequestURL");
let ip = "N/A";
if (url){ const m = url.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/); if (m) ip = m[1]; }
return {writable:false, value:[ip,"xsd:string"]};
