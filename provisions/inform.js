// Universal inform — IGD (TR-098) fleet. Kredensial ConnectionRequest pakai DeviceID (natural, diterima semua merek).
// CATATAN: declare Device.* (TR-181) sengaja DIHAPUS — pada ONT IGD-only yang ketat (mis. SIGMA ZX-F663NV3a)
// GetParameterNames("Device.") balas CPE 9005 -> GenieACS retry tanpa henti -> too_many_commits.
// Kalau nanti ada ONT TR-181 murni, tambahkan handler terpisah berbasis deteksi root.
const username = declare("DeviceID.ID", {value: 1}).value[0];
const password = Math.trunc(Math.random() * Number.MAX_SAFE_INTEGER).toString(36);
const informInterval = 300;
const daily = Date.now(86400000);
declare("InternetGatewayDevice.ManagementServer.ConnectionRequestUsername", {value: daily}, {value: username});
declare("InternetGatewayDevice.ManagementServer.ConnectionRequestPassword", {value: daily}, {value: password});
declare("InternetGatewayDevice.ManagementServer.PeriodicInformEnable", {value: daily}, {value: true});
declare("InternetGatewayDevice.ManagementServer.PeriodicInformInterval", {value: daily}, {value: informInterval});
