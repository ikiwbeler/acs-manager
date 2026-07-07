// Model ONT diekstrak dari DeviceID.ID (format OUI-ProductClass-Serial; dash dlm komponen ter-encode %2D, spasi %20).
const id = declare("DeviceID.ID", {value: 1}).value[0];
let model = "Unknown";
if (id != null) {
  const parts = String(id).split('-');
  if (parts.length >= 2) {
    model = parts[1].replace(/%2D/gi, '-').replace(/%20/gi, ' ');
  }
}
return {writable:false, value:[model, "xsd:string"]};
