#!/usr/bin/env python3
# appendblk.py ENGINE-NAME [ENGINE-NAME...]: append each $S/w7/blk/<engine>/<KEY>.json's attempts to the register's
# <prefix>.blocked.<KEY> (earlier attempts kept), or add the entry where the engine is new to blockers; a key whose
# fact is researched now is skipped.
import json,os,sys
S='/tmp/claude-0/-home-user-SLATE/c8b0b159-b4a5-540a-bbd6-18661cbe240c/scratchpad'
R='/home/user/SLATE/research/register.json'
P={'holidays':'world.holidays','weather':'world.weather','prices':'world.prices','credit':'money.credit','cards':'money.cards','banks':'money.banks','work':'papers.work','passports':'papers.passports','ids':'papers.ids','rates':'money.rates','numbers':'papers.numbers','residence':'papers.residence','licence':'papers.licence','citizenship':'papers.citizenship','means':'money.means','formats':'money.formats','units':'money.units','ages':'papers.ages','roles':'person.roles'}
LINE={'formats':'formats.unkept','numbers':'numbers.unkept','residence':'residence.unkept','licence':'licence.unkept','citizenship':'citizenship.unkept','ages':'ages.unkept'}
METHODS={'institution','official-register','web-search','trade-press','archive'}
names=json.load(open('/home/user/SLATE/src/world/gazetteer/countries.json'))
txt=open(R).read(); reg=json.loads(txt)
facts={e['fact']:e for e in reg['entries']}
def body(e): return '\n'.join('  '+l for l in json.dumps(e,indent=1,ensure_ascii=True).split('\n'))
for eng in sys.argv[1:]:
    d=f'{S}/{os.environ.get("WAVE","w7")}/blk/{eng}'
    for f in sorted(os.listdir(d)) if os.path.isdir(d) else []:
        key=f[:-5]; spec=json.load(open(f'{d}/{f}')); fact=f'{P[eng]}.blocked.{key}'
        # A file of the ages may leave fields null, each held by its blocker beside it.
        if f'{P[eng]}.{key}' in facts and eng!='ages': print('skip, researched:',key); continue
        att=spec['attempts']; assert {a['method'] for a in att}>=METHODS, (eng,key,'needs every method')
        for a in att: assert a.get('tried') and a.get('result') and a.get('date'), (eng,key)
        old=facts.get(fact)
        if old:
            new=dict(old); new['attempts']=old['attempts']+[a for a in att if a not in old['attempts']]
            i=txt.index('"id": "%s"'%old['id']); start=txt.rfind('\n  {\n',0,i)+1; end=txt.index('\n  }',start)+len('\n  }')
            txt=txt[:start]+body(new)+txt[end:]
        else:
            ids=[int(e['id'][2:]) for e in json.loads(txt)['entries']]
            cc=key.split('.')[0]
            new={'id':'R-%04d'%(max(ids)+1),'fact':fact,'sought':spec.get('sought') or f'{P[eng]} for {names[cc]["name"].strip()}','status':'blocked','attempts':att,'notModeled':spec.get('notModeled') or LINE.get(eng,eng+'.unkept')}
            end='\n ]\n}\n'; assert txt.endswith('  }'+end); txt=txt[:-len(end)]+',\n'+body(new)+end
        print(eng,key,'appended' if old else 'added')
json.loads(txt); open(R,'w').write(txt)
