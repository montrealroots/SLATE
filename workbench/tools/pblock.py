#!/usr/bin/env python3
# pblock.py SPEC.json: add price blockers to the register (world.prices.blocked.<code>), formatting kept
import json,sys
R='/home/user/SLATE/research/register.json'
specs=json.load(open(sys.argv[1]))
for sp in specs:
    txt=open(R).read(); reg=json.loads(txt)
    fact=f"world.prices.blocked.{sp['code']}"
    assert not any(e['fact']==fact for e in reg['entries']), fact
    eid='R-%04d'%(max(int(e['id'][2:]) for e in reg['entries'])+1)
    entry={"id":eid,"fact":fact,"sought":sp['sought'],"status":"blocked","attempts":[{"method":m,"tried":t,"result":r,"date":"2026-10-28"} for m,t,r in sp['attempts']],"notModeled":"prices.unkept"}
    methods={a['method'] for a in entry['attempts']}
    assert methods=={'web-search','institution','official-register','trade-press','archive'},(sp['code'],methods)
    body='\n'.join('  '+l for l in json.dumps(entry,indent=1,ensure_ascii=True).split('\n'))
    end='\n ]\n}\n'
    assert txt.endswith('  }'+end)
    open(R,'w').write(txt[:-len(end)]+',\n'+body+end)
    print(eid,fact)
