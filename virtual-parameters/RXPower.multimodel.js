// Multi-model RX optical power (dBm). GPON (ZTE/CT-COM): raw 0.1uW (positif) -> 10*log10(raw)-40.
// EPON/sebagian ONT: raw sudah dBm langsung (negatif, mis. -18). Pilih path pertama yang ada.
const now = Date.now(300000);
const candidates = [
  "InternetGatewayDevice.WANDevice.1.X_ZTE-COM_WANPONInterfaceConfig.RXPower",
  "InternetGatewayDevice.WANDevice.1.X_CT-COM_GponInterfaceConfig.RXPower",
  "InternetGatewayDevice.WANDevice.1.X_CT-COM_EponInterfaceConfig.RXPower",
  "InternetGatewayDevice.WANDevice.1.X_GponInterfaceConfig.RXPower",
  "InternetGatewayDevice.WANDevice.1.WANPONInterfaceConfig.RXPower"
];
let raw = null;
for (let i = 0; i < candidates.length; i++) {
  const d = declare(candidates[i], {value: now});
  if (d.value != null && d.value[0] != null && d.value[0] !== "") { raw = parseFloat(d.value[0]); break; }
}
let out = "N/A";
if (raw != null && !isNaN(raw)) {
  if (raw > 0) out = (10 * Math.log10(raw) - 40).toFixed(2);          // 0.1uW units (GPON)
  else if (raw < 0 && raw > -60) out = raw.toFixed(2);               // already dBm (EPON, negatif)
}
return {writable: false, value: [out, "xsd:string"]};
