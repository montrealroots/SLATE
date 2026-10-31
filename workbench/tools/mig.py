# mig.py SPEC.py: migrate research files to the engine's form. SPEC defines M = {CC: (routes, pays, extra_note)}
# routes: list of (id, where, speed, within(n,unit)|None, label[, months]); pays: list per band (dict route->fee|None)
import json,sys,subprocess
R='/home/user/SLATE/research/sources/papers/passports/'
spec={}; exec(open(sys.argv[1]).read(),spec)
for cc,(routes,pays,extra) in spec['M'].items():
    p=R+cc+'.json'; d=json.load(open(p))
    assert len(pays)==len(d['passports']),(cc,len(pays),len(d['passports']))
    rs=[]
    for r in routes:
        o={'id':r[0],'where':r[1],'speed':r[2],'within':None if r[3] is None else {'n':r[3][0],'unit':r[3][1]},'label':r[4]}
        if len(r)>5: o['months']=r[5]
        rs.append(o)
    for b,pay in zip(d['passports'],pays):
        b.pop('fees',None); b['pay']=pay
    for k in ('standard','urgent','abroad','extras'):
        d.pop(k,None)
    if extra: d['note']=d['note'].rstrip()+' '+extra
    out={}
    for k in d:
        if k=='passports': out['routes']=rs
        out[k]=d[k]
    s=json.dumps(out,indent=1,ensure_ascii=False)
    # keep each route and band on one line, as the files were written
    import re
    s=re.sub(r'\{\n\s+"(id|for)"(.*?)\n\s+\}', lambda m: '{"'+m.group(1)+'"'+re.sub(r'\n\s*',' ',m.group(2))+'}', s, flags=re.S)
    open(p,'w').write(s+'\n')
    print(cc,'migrated')
