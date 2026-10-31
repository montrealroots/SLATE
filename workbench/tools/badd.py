#!/usr/bin/env python3
# badd.py blk/CC.json: add or refresh the register's blocker papers.passports.blocked.CC from a spec {sought, attempts}
import json,sys,os
R='/home/user/SLATE/research/register.json'
spec=json.load(open(sys.argv[1])); cc=os.path.basename(sys.argv[1])[:2]
fact='papers.passports.blocked.'+cc
METHODS=['institution','official-register','web-search','trade-press','archive']
assert {a['method'] for a in spec['attempts']}>=set(METHODS), 'every method needs an attempt'
for a in spec['attempts']: assert a['tried'] and a['result'] and a['date']
txt=open(R).read(); reg=json.loads(txt)
assert not any(e['fact']=='papers.passports.'+cc for e in reg['entries']), 'the country is researched'
old=[e for e in reg['entries'] if e['fact']==fact]
eid=old[0]['id'] if old else 'R-%04d'%(max(int(e['id'][2:]) for e in reg['entries'])+1)
entry={"id":eid,"fact":fact,"sought":spec['sought'],"status":"blocked","attempts":spec['attempts'],"notModeled":"passports.unkept"}
body='\n'.join('  '+l for l in json.dumps(entry,indent=1,ensure_ascii=True).split('\n'))
if old:
    start=txt.index('  {\n   "id": "%s"'%eid); end=txt.index('\n  }',start)+len('\n  }')
    open(R,'w').write(txt[:start]+body+txt[end:])
else:
    end='\n ]\n}\n'; assert txt.endswith('  }'+end)
    open(R,'w').write(txt[:-len(end)]+',\n'+body+end)
print(eid,fact)
