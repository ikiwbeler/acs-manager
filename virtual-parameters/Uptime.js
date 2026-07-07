// Device uptime -> human readable (d/h/m). Source: DeviceInfo.UpTime (IGD or TR-181).
const now = Date.now(300000);
function read(path){ const d=declare(path,{value:now}); return (d.value!=null && d.value[0]!=null)? d.value[0] : null; }
let s = read("InternetGatewayDevice.DeviceInfo.UpTime");
if (s == null) s = read("Device.DeviceInfo.UpTime");
let out = "N/A";
if (s != null){
  let sec = parseInt(s, 10);
  if (!isNaN(sec) && sec >= 0){
    const d = Math.floor(sec/86400); sec -= d*86400;
    const h = Math.floor(sec/3600); sec -= h*3600;
    const m = Math.floor(sec/60);
    out = d + "d " + h + "h " + m + "m";
  }
}
return {writable: false, value: [out, "xsd:string"]};
