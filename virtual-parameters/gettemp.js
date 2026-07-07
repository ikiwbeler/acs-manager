// Transceiver/optical temperature (°C), multi-model. Raw umumnya 1/256 °C (mis. 8048 -> 31.4).
const now = Date.now(300000);
function pick(paths){
  for (let i=0;i<paths.length;i++){
    const d = declare(paths[i], {value: now});
    if (d.value != null && d.value[0] != null && d.value[0] !== "") return parseFloat(d.value[0]);
  }
  return null;
}
const raw = pick([
  "InternetGatewayDevice.WANDevice.1.X_CT-COM_GponInterfaceConfig.TransceiverTemperature",
  "InternetGatewayDevice.WANDevice.1.X_CT-COM_EponInterfaceConfig.TransceiverTemperature",
  "InternetGatewayDevice.WANDevice.1.X_ZTE-COM_WANPONInterfaceConfig.TransceiverTemperature",
  "InternetGatewayDevice.WANDevice.1.X_ZTE-COM_WANPONInterfaceConfig.Temperature",
  "InternetGatewayDevice.WANDevice.1.X_GponInterfaceConfig.TransceiverTemperature"
]);
let out = "N/A";
if (raw != null && !isNaN(raw)){
  let c = (raw > 150) ? (raw/256) : raw;
  out = c.toFixed(1);
}
return {writable:false, value:[out,"xsd:string"]};
