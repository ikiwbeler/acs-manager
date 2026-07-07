// Klien WiFi aktif = jumlah TotalAssociations di semua radio WLAN. Ringan & bebas loop (tidak refresh tabel Hosts).
const now = Date.now(300000);
let count = 0;
const decls = declare("InternetGatewayDevice.LANDevice.*.WLANConfiguration.*.TotalAssociations", {value: now});
for (const d of decls) {
  const v = (d.value != null) ? parseInt(d.value[0],10) : 0;
  if (!isNaN(v)) count += v;
}
return {writable:false, value:[String(count), "xsd:string"]};
