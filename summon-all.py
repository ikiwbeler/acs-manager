#!/usr/bin/env python3
# Summon (refresh) SEMUA device GenieACS sekaligus. Berurutan + jeda kecil agar aman.
import json,urllib.request,urllib.parse,time,sys
NBI="http://127.0.0.1:7557"
DELAY=float(sys.argv[1]) if len(sys.argv)>1 else 1.5
ids=[d["_id"] for d in json.load(urllib.request.urlopen(NBI+"/devices/?projection=_id"))]
print("Summon %d device (delay %.1fs)..." % (len(ids),DELAY))
ok=req=0
for i in ids:
    e=urllib.parse.quote(i,safe='')
    # connection_request memicu inform -> provision 'default' me-refresh semua VP
    body=json.dumps({"name":"getParameterValues","parameterNames":["InternetGatewayDevice.DeviceInfo.UpTime"]}).encode()
    r=urllib.request.Request("%s/devices/%s/tasks?connection_request"%(NBI,e),data=body,headers={"Content-Type":"application/json"},method="POST")
    try:
        code=urllib.request.urlopen(r,timeout=25).status; req+=1
        if code in (200,202): ok+=1
        print("  [%s] %s" % (code,i[:46]))
    except Exception as ex:
        print("  [ERR] %s (%s)" % (i[:46],str(ex)[:30]))
    time.sleep(DELAY)
flt=json.load(urllib.request.urlopen(NBI+"/faults/"))
print("Selesai: %d/%d ter-trigger, faults=%d" % (ok,len(ids),len(flt)))
