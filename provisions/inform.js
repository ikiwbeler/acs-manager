// Universal inform — IGD (TR-098) fleet.
// ConnectionRequest: username = DeviceID (natural, diterima semua merek), password = TETAP (anti-drift).
// Password random sebelumnya bikin Summon gagal 401 saat CPE tak sinkron (CPE selalu balas password kosong
// demi keamanan, jadi GenieACS & ONU gampang beda). Password tetap + set SEKALI (refresh null) => selalu cocok.
// CATATAN: declare Device.* (TR-181) sengaja DIHAPUS — pada ONT IGD-only yang ketat (mis. SIGMA ZX-F663NV3a)
// GetParameterNames("Device.") balas CPE 9005 -> GenieACS retry tanpa henti -> too_many_commits.
const username = declare("DeviceID.ID", {value: 1}).value[0];
// Default netral untuk whitelabel — GANTI per-instalasi (belum di-set otomatis oleh wizard setup).
// Cara ganti: ubah nilai di bawah, lalu seed ulang provision `inform` (PUT ke NBI /provisions/inform).
// Perangkat mengadopsi password baru pada inform berikutnya (<= informInterval).
const password = "acsmanager";
const informInterval = 300;
const daily = Date.now(86400000);
declare("InternetGatewayDevice.ManagementServer.ConnectionRequestUsername", null, {value: username});
declare("InternetGatewayDevice.ManagementServer.ConnectionRequestPassword", null, {value: password});
declare("InternetGatewayDevice.ManagementServer.PeriodicInformEnable", {value: daily}, {value: true});
declare("InternetGatewayDevice.ManagementServer.PeriodicInformInterval", {value: daily}, {value: informInterval});
