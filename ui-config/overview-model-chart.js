// Chart distribusi Model ONT di Overview
function S(key,label,color,model){
  db.config.updateOne({_id:"ui.overview.charts.model.slices."+key+".label"},{$set:{value:"'"+label+"'"}},{upsert:true});
  db.config.updateOne({_id:"ui.overview.charts.model.slices."+key+".color"},{$set:{value:"'"+color+"'"}},{upsert:true});
  db.config.updateOne({_id:"ui.overview.charts.model.slices."+key+".filter"},{$set:{value:"VirtualParameters.Model = '"+model+"'"}},{upsert:true});
}
db.config.updateOne({_id:"ui.overview.charts.model.label"},{$set:{value:"'Model ONT'"}},{upsert:true});
S("1_F650","F650","#1f77b4","F650");
S("2_F609","F609","#ff7f0e","F609");
S("3_GM630","GM630 XPON","#2ca02c","GM630 XPON");
S("4_SIGMA","SIGMA ZX-F663NV3a","#d62728","SIGMA ZX-F663NV3a");
S("5_GM220S","GM220-S","#9467bd","GM220-S");
S("6_F460","F460","#8c564b","F460");
S("7_HSGQ","HSGQ-X130W","#e377c2","HSGQ-X130W");
S("8_H22","H2-2 XPON","#7f7f7f","H2-2 XPON");
S("9_R880","R880","#bcbd22","R880");
db.config.updateOne({_id:"ui.overview.groups.model.label"},{$set:{value:"'Distribusi Model ONT'"}},{upsert:true});
db.config.updateOne({_id:"ui.overview.groups.model.charts.0"},{$set:{value:"'model'"}},{upsert:true});
print("model chart slices:", db.config.count({_id:/ui\.overview\.charts\.model\.slices/}));
