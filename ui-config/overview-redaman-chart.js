// 1) Chart redaman di overview
function S(key,label,color,status){
  db.config.updateOne({_id:"ui.overview.charts.redaman.slices."+key+".label"},{$set:{value:"'"+label+"'"}},{upsert:true});
  db.config.updateOne({_id:"ui.overview.charts.redaman.slices."+key+".color"},{$set:{value:"'"+color+"'"}},{upsert:true});
  db.config.updateOne({_id:"ui.overview.charts.redaman.slices."+key+".filter"},{$set:{value:"VirtualParameters.RedamanStatus = '"+status+"'"}},{upsert:true});
}
db.config.updateOne({_id:"ui.overview.charts.redaman.label"},{$set:{value:"'Status Redaman (Optical RX)'"}},{upsert:true});
S("1_normal","Normal (-8..-25 dBm)","#31a354","Normal");
S("2_warning","Warning (-25..-27 dBm)","#fec44f","Warning");
S("3_kritis","Kritis (< -27 dBm)","#d62728","Kritis");
S("4_overload","Overload (> -8 dBm)","#fd8d3c","Overload");
db.config.updateOne({_id:"ui.overview.groups.redaman.label"},{$set:{value:"'Status Redaman / Optical RX'"}},{upsert:true});
db.config.updateOne({_id:"ui.overview.groups.redaman.charts.0"},{$set:{value:"'redaman'"}},{upsert:true});

// 2) Rebuild device list dgn kolom Redaman (setelah Rx)
db.config.deleteMany({_id:/^ui\.index\./});
var c = {
 "0.type":"'device-link'","0.label":"'SN'","0.parameter":"DeviceID.SerialNumber","0.components.0.type":"'parameter'",
 "1.label":"'MAC'","1.parameter":"VirtualParameters.WANMAC",
 "2.label":"'Tipe'","2.parameter":"VirtualParameters.Model",
 "3.label":"'Mode'","3.parameter":"VirtualParameters.PONMode",
 "4.label":"'IP'","4.parameter":"VirtualParameters.WANIP",
 "5.label":"'IP Mgmt'","5.parameter":"VirtualParameters.IPMgmt",
 "6.label":"'SSID'","6.parameter":"InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID",
 "7.label":"'PPPoE'","7.parameter":"VirtualParameters.PPPoEUsername",
 "8.label":"'Rx'","8.parameter":"VirtualParameters.RXPower",
 "9.label":"'Redaman'","9.parameter":"VirtualParameters.RedamanStatus",
 "10.label":"'Temp'","10.parameter":"VirtualParameters.Temperature",
 "11.label":"'Uptime'","11.parameter":"VirtualParameters.Uptime",
 "12.label":"'Client'","12.parameter":"VirtualParameters.ClientCount",
 "13.label":"'Status'","13.parameter":"CASE WHEN Events.Inform > NOW() - 300000 THEN 'Online' ELSE 'Offline' END",
 "14.type":"'tags'","14.label":"'Tags'","14.parameter":"Tags","14.unsortable":"true","14.writable":"false"
};
Object.keys(c).forEach(function(k){ db.config.updateOne({_id:"ui.index."+k},{$set:{value:c[k]}},{upsert:true}); });
// 3) detail: tambah Redaman
db.config.updateOne({_id:"ui.device.2.parameters.19.label"},{$set:{value:"'Status Redaman'"}},{upsert:true});
db.config.updateOne({_id:"ui.device.2.parameters.19.parameter"},{$set:{value:"VirtualParameters.RedamanStatus"}},{upsert:true});
print("redaman slices:", db.config.count({_id:/ui\.overview\.charts\.redaman\.slices/}), "| index entries:", db.config.count({_id:/^ui\.index\./}));
