// Multi-model RX optical power (dBm). GPON (ZTE/CT-COM/CMCC/CU): raw 0.1uW (positif) -> 10*log10(raw)-40.
// EPON/sebagian ONT: raw sudah dBm langsung (negatif, mis. -18). Pilih path pertama yang ada.
const now = Date.now(300000);
const candidates = [
  "InternetGatewayDevice.WANDevice.1.X_ZTE-COM_WANPONInterfaceConfig.RXPower",
  "InternetGatewayDevice.WANDevice.1.X_CT-COM_GponInterfaceConfig.RXPower",
  "InternetGatewayDevice.WANDevice.1.X_CT-COM_EponInterfaceConfig.RXPower",
  "InternetGatewayDevice.WANDevice.1.X_CMCC_GponInterfaceConfig.RXPower",
  "InternetGatewayDevice.WANDevice.1.X_CMCC_EponInterfaceConfig.RXPower",
  "InternetGatewayDevice.WANDevice.1.X_CU_WANGPONInterfaceConfig.OpticalTransceiver.RXPower",
  "InternetGatewayDevice.WANDevice.1.X_CU_WANEPONInterfaceConfig.OpticalTransceiver.RXPower",
  "InternetGatewayDevice.WANDevice.1.X_GponInterfaceConfig.RXPower",
  "InternetGatewayDevice.WANDevice.1.WANPONInterfaceConfig.RXPower"
];
let raw = null;
for (let i = 0; i < candidates.length; i++) {
  const d = declare(candidates[i], {value: now});
  if (d.value != null && d.value[0] != null && d.value[0] !== "") { raw = parseFloat(d.value[0]); break; }
}
// Sebagian ONT (mis. ZTE F460) lapor nilai lantai raw=1 & suhu 0 saat modul optik tidak
// terbaca. raw=1 -> -40 dBm, jauh di bawah sensitivitas ONT manapun; kalau device masih
// inform, itu pasti bukan pengukuran asli. Perlakukan sebagai N/A, bukan Kritis palsu.
let out = "N/A";
if (raw != null && !isNaN(raw)) {
  let dbm = null;
  if (raw > 1) dbm = 10 * Math.log10(raw) - 40;                      // 0.1uW units (GPON)
  else if (raw < 0 && raw > -60) dbm = raw;                          // already dBm (EPON, negatif)
  if (dbm != null && dbm > -35) out = dbm.toFixed(2);                // < -35 dBm = di bawah sensitivitas -> N/A
}
return {writable: false, value: [out, "xsd:string"]};