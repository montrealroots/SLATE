#!/usr/bin/env python3
"""addc.py SPEC.json: add a country's holidays (rules, source file, register entry), or a blocker.
spec: {"code","name","rules"?,"sources"?,"lists"?, "blocked"?: {"fact","sought","attempts","notModeled"}}"""
import json,sys,hashlib,re,subprocess
R='/home/user/SLATE/'
dump=lambda o: json.dumps(o,indent=1,ensure_ascii=False)+"\n"
import os,time
while os.path.exists('/tmp/claude-0/-home-user-SLATE/c8b0b159-b4a5-540a-bbd6-18661cbe240c/scratchpad/commit.lock'): time.sleep(3)
spec=json.load(open(sys.argv[1]))
code=spec['code']
reg=json.load(open(R+'research/register.json'))
ents=reg['entries']
nid=lambda: 'R-%04d'%(max(int(e['id'][2:]) for e in ents)+1)
def put(entry):
    for i,e in enumerate(ents):
        if e['fact']==entry['fact']:
            entry['id']=e['id']; ents[i]=entry; return
    entry={'id':nid(),**entry}; ents.append(entry)
for b in spec.get('blocked',[]):
    put({'fact':b['fact'],'sought':b['sought'],'status':'blocked','attempts':b['attempts'],'notModeled':b['notModeled']})
added=0
if 'rules' in spec:
    src={'country':code,'sources':spec['sources'],'lists':spec['lists']}
    path=f'research/sources/holidays/{code}.json'
    old=0
    try: old=sum(len(l.get('regions') or [0]) for l in json.load(open(R+path))['lists'])
    except FileNotFoundError: pass
    text=dump(src); open(R+path,'w').write(text)
    added=sum(len(l.get('regions') or [0]) for l in spec['lists'])-old
    years=sorted({l['year'] for l in spec['lists']})
    ys=str(years[0]) if len(years)==1 else f'{years[0]}-{years[-1]}'
    srcs=[{'kind':s.get('kind','primary'),**{k:v for k,v in s.items() if k!='kind'}} for s in spec['sources']]
    put({'fact':f'world.holidays.{code}','sought':f"{spec['name']}{chr(39) if spec['name'].endswith('s') else chr(39)+'s'} public holidays, the days off its law or its government's list names, nationally and in each first-level region that keeps its own",
         'status':'found' if any(s['kind']=='primary' for s in srcs) else 'secondary',
         'value':{'file':path,'sha256':hashlib.sha256(text.encode()).hexdigest(),'lists':len(spec['lists']),'years':ys},'sources':srcs})
    c=json.load(open(R+'src/world/holidays/countries.json'))
    c[code]=spec['rules']; c=dict(sorted(c.items()))
    open(R+'src/world/holidays/countries.json','w').write(dump(c))
open(R+'research/register.json','w').write(dump(reg))
if added:
    t=R+'tests/world/holidays/holidays.test.ts'; s=open(t).read()
    n=int(re.search(r'expect\(read\)\.toBe\((\d+)\)',s).group(1))
    open(t,'w').write(s.replace(f'expect(read).toBe({n})',f'expect(read).toBe({n+added})'))
    print('lists',n,'->',n+added)
subprocess.run(['npx','tsx','tools/holidays/build.ts'],cwd=R,check=True)
