db.config.deleteMany({_id:/^ui\.index\./});
var c = {
 "0.type":"'device-link'","0.label":"'SN'","0.parameter":"DeviceID.SerialNumber","0.components.0.type":"'parameter'",
 "1.label":"'MAC'","1.parameter":"VirtualParameters.WANMAC",
 "2.label":"'Tipe'","2.parameter":"DeviceID.ProductClass",
 "3.label":"'Mode'","3.parameter":"VirtualParameters.PONMode",
 "4.label":"'IP'","4.parameter":"VirtualParameters.WANIP",
 "5.label":"'IP Mgmt'","5.parameter":"VirtualParameters.IPMgmt",
 "6.label":"'SSID'","6.parameter":"InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID",
 "7.label":"'PPPoE'","7.parameter":"VirtualParameters.PPPoEUsername",
 "8.label":"'Rx'","8.parameter":"VirtualParameters.RXPower",
 "9.label":"'Temp'","9.parameter":"VirtualParameters.Temperature",
 "10.label":"'Uptime'","10.parameter":"VirtualParameters.Uptime",
 "11.label":"'Client'","11.parameter":"VirtualParameters.ClientCount",
 "12.label":"'Status'","12.parameter":"CASE WHEN Events.Inform > NOW() - 300000 THEN 'Online' ELSE 'Offline' END",
 "13.type":"'tags'","13.label":"'Tags'","13.parameter":"Tags","13.unsortable":"true","13.writable":"false"
};
Object.keys(c).forEach(function(k){ db.config.updateOne({_id:"ui.index."+k},{$set:{value:c[k]}},{upsert:true}); });
// detail: tambah IP Mgmt + Client
db.config.updateOne({_id:"ui.device.2.parameters.16.label"},{$set:{value:"'IP Management'"}},{upsert:true});
db.config.updateOne({_id:"ui.device.2.parameters.16.parameter"},{$set:{value:"VirtualParameters.IPMgmt"}},{upsert:true});
db.config.updateOne({_id:"ui.device.2.parameters.17.label"},{$set:{value:"'Connected Clients'"}},{upsert:true});
db.config.updateOne({_id:"ui.device.2.parameters.17.parameter"},{$set:{value:"VirtualParameters.ClientCount"}},{upsert:true});
db.config.updateOne({_id:"ui.device.2.parameters.18.label"},{$set:{value:"'PON Mode'"}},{upsert:true});
db.config.updateOne({_id:"ui.device.2.parameters.18.parameter"},{$set:{value:"VirtualParameters.PONMode"}},{upsert:true});
print("index entries:", db.config.count({_id:/^ui\.index\./}));
