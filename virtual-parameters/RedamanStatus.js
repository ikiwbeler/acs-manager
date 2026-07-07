// Status redaman (Optical RX) sesuai standar GPON/EPON. Baca VirtualParameters.RXPower (sudah dihitung) lalu klasifikasi.
const now = Date.now(300000);
const d = declare("VirtualParameters.RXPower", {value: now});
const raw = (d.value != null) ? d.value[0] : null;
let status = "N/A";
if (raw != null && raw !== "N/A") {
  const rx = parseFloat(raw);
  if (!isNaN(rx)) {
    if (rx > -8) status = "Overload";
    else if (rx >= -25) status = "Normal";
    else if (rx >= -27) status = "Warning";
    else status = "Kritis";
  }
}
return {writable:false, value:[status, "xsd:string"]};
