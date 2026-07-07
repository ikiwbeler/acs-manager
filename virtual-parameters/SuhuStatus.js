// Status suhu ONT/transceiver. Baca VirtualParameters.Temperature lalu klasifikasi.
const now = Date.now(300000);
const d = declare("VirtualParameters.Temperature", {value: now});
const raw = (d.value != null) ? d.value[0] : null;
let status = "N/A";
if (raw != null && raw !== "N/A") {
  const t = parseFloat(raw);
  if (!isNaN(t)) {
    if (t >= 80) status = "Kritis";
    else if (t >= 65) status = "Warning";
    else status = "Normal";
  }
}
return {writable:false, value:[status,"xsd:string"]};
