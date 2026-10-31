#!/usr/bin/env python3
# pidx.py SPEC.json: write research/sources/prices/<code>.json from a spec and add its register entry
# spec: {"country","name","index","from":[...],"to":[...],"note"?,"sources":[...]}
import json,sys,subprocess
s=json.load(open(sys.argv[1]))
d={"country":s['country'],"index":s['index']}
if s.get('relative'): d['relative']=s['relative']
if s.get('benchmark'): d['benchmark']=s['benchmark']
d.update({"from":{"year":s.get('fromYear',2021),"values":s['from'],**({'changes':s['fromChanges']} if s.get('fromChanges') else {})},"to":{"year":s.get('toYear',2025),"values":s['to']}})
if s.get('note'): d['note']=s['note']
d['sources']=s['sources']
name=s.get('file',s['country'])
f=f"research/sources/prices/{name}.json"
open('/home/user/SLATE/'+f,'w').write(json.dumps(d,indent=1,ensure_ascii=False)+'\n')
subprocess.run(['python3','/tmp/claude-0/-home-user-SLATE/c8b0b159-b4a5-540a-bbd6-18661cbe240c/scratchpad/bin/padd.py',f"world.prices.{name}",f,s.get('sought',f"{s['name']}'s consumer price index in 2021 and 2025, from its statistics office")],check=True)
