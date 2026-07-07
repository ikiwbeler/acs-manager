// Deteksi mode PON dari optical interface config yang ada. GPON: *GponInterfaceConfig / X_ZTE-COM_WANPONInterfaceConfig. EPON: *EponInterfaceConfig. Keduanya -> XPON.
const now = Date.now(86400000); // mode statis -> refresh harian
function has(path){ const d=declare(path,{value:now}); return d.value!=null && d.value[0]!=null && d.value[0]!==""; }
const gpon = has("InternetGatewayDevice.WANDevice.1.X_CT-COM_GponInterfaceConfig.RXPower")
          || has("InternetGatewayDevice.WANDevice.1.X_ZTE-COM_WANPONInterfaceConfig.RXPower")
          || has("InternetGatewayDevice.WANDevice.1.X_GponInterfaceConfig.RXPower");
const epon = has("InternetGatewayDevice.WANDevice.1.X_CT-COM_EponInterfaceConfig.RXPower")
          || has("InternetGatewayDevice.WANDevice.1.X_CT-COM_EponInterafceConfig.RXPower");
let mode = "N/A";
if (gpon && epon) mode = "XPON";
else if (gpon) mode = "GPON";
else if (epon) mode = "EPON";
return {writable:false, value:[mode,"xsd:string"]};
