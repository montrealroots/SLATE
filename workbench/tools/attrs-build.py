import json,sys,re,collections,hashlib
S,role,parts,out,note=sys.argv[1],sys.argv[2],sys.argv[3].split(','),sys.argv[4],sys.argv[5]
T=json.load(open(f'{S}/attrs/titles.json')) if role=='screenwriter' else {}
entries=[];blockers=[];excluded=[]
for p in parts:
    d=json.load(open(f'{S}/attrs/out/{p}.json'))
    entries+=d['attributes']; blockers+=[dict(b,part=p.split('-')[-1]) for b in d.get('blockers',[])]
    if d.get('excluded'): excluded.append(dict(d['excluded'],part=p.split('-')[-1]))
G=json.load(open(f'{S}/attrs/{"groups" if role=="screenwriter" else "groups-"+role}.json'))['groups']
src=collections.OrderedDict(); said=collections.defaultdict(list)
def sid(s):
    u=s['url']
    if u not in src:
        q=s.get('quotes'); extra=''
        if q:
            m=re.match(r'(https?://\S+)\s*(.*)',q); q,extra=m.group(1),m.group(2).strip()
        title=s.get('title') or T.get(u,{}).get('title')
        assert title, u
        if extra: title=f'{title} {extra}'.strip()
        e={'url':u,'title':title,'read':'2026-10-31','kind':s.get('kind','primary')}
        if s.get('kind')=='secondary': e['quotes']=q
        src[u]=e
    if s['said'] not in said[u]: said[u].append(s['said'])
    return list(src).index(u)
attrs=[]
for g in G:
    terms=[]
    for i in g['members']:
        a=entries[i]
        t={'term':a['name'],'meaning':a['meaning'],'judgedBy':a.get('judged_by',''),'sources':[]}
        for s in a['sources']:
            x={'src':sid(s),'said':s['said']}
            if s.get('rating'): x['rating']=s['rating']
            t['sources'].append(x)
        terms.append(t)
    attrs.append({'name':g['label'],'category':g['category'],'terms':terms})
sources=[dict(v,said=' … '.join(said[u])) for u,v in src.items()]
doc={'role':role,'read':'2026-10-31','note':note,'sources':sources,'attributes':attrs,'blockers':blockers}
if excluded: doc['excluded']=excluded
txt=json.dumps(doc,ensure_ascii=False,indent=1)+'\n'; open(out,'w').write(txt)
print(role,'attributes',len(attrs),'terms',sum(len(a['terms']) for a in attrs),'sources',len(sources),'secondary',sum(s['kind']=='secondary' for s in sources),'blockers',len(blockers),'sha',hashlib.sha256(txt.encode()).hexdigest())
