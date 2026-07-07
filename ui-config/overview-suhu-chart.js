function S(key,label,color,status){
  db.config.updateOne({_id:"ui.overview.charts.suhu.slices."+key+".label"},{$set:{value:"'"+label+"'"}},{upsert:true});
  db.config.updateOne({_id:"ui.overview.charts.suhu.slices."+key+".color"},{$set:{value:"'"+color+"'"}},{upsert:true});
  db.config.updateOne({_id:"ui.overview.charts.suhu.slices."+key+".filter"},{$set:{value:"VirtualParameters.SuhuStatus = '"+status+"'"}},{upsert:true});
}
db.config.updateOne({_id:"ui.overview.charts.suhu.label"},{$set:{value:"'Status Suhu (Temperature)'"}},{upsert:true});
S("1_normal","Normal (< 65 C)","#31a354","Normal");
S("2_warning","Warning (65-80 C)","#fec44f","Warning");
S("3_kritis","Kritis (>= 80 C)","#d62728","Kritis");
db.config.updateOne({_id:"ui.overview.groups.suhu.label"},{$set:{value:"'Status Suhu / Temperature'"}},{upsert:true});
db.config.updateOne({_id:"ui.overview.groups.suhu.charts.0"},{$set:{value:"'suhu'"}},{upsert:true});
db.config.updateOne({_id:"ui.device.2.parameters.20.label"},{$set:{value:"'Status Suhu'"}},{upsert:true});
db.config.updateOne({_id:"ui.device.2.parameters.20.parameter"},{$set:{value:"VirtualParameters.SuhuStatus"}},{upsert:true});
print("suhu slices:", db.config.count({_id:/ui\.overview\.charts\.suhu\.slices/}));
