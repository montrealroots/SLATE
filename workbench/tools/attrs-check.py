import json,sys,re,html,os,unicodedata
S=sys.argv[1]; f=sys.argv[2]
d=json.load(open(f))
def norm(t):
    t=html.unescape(t).replace('\u00ad',''); t=unicodedata.normalize('NFKC',t)
    t=t.replace('’',"'").replace('‘',"'").replace('“','"').replace('”','"').replace(' ',' ').replace('–','-').replace('—','-')
    t=re.sub(r'\s+',' ',t); t=re.sub(r' ([,.:;!?)])',r'\1',t); t=re.sub(r'([(]) ',r'\1',t)
    return t.strip().lower()
cache={}
def page(p):
    if p in cache: return cache[p]
    fp=os.path.join(S,p)
    if not os.path.exists(fp): cache[p]=None; return None
    if fp.endswith('.pdf'):
        raw=' \n '.join(open(fp[:-4]+x,errors='replace').read() for x in ('.txt','.raw.txt') if os.path.exists(fp[:-4]+x))
    else:
        raw=open(fp,errors='replace').read()
        raw=re.sub(r'(?s)<(script|style)[^>]*>.*?</\1>',' ',raw) if not fp.endswith('.txt') else raw
        raw=re.sub(r'<[^>]+>',' ',raw)
    cache[p]=norm(raw); return cache[p]
bad=[];n=0;missing=set();sec=0
for a in d['attributes']:
    for s in a['sources']:
        n+=1; sec+= s.get('kind')=='secondary'
        if s.get('kind')=='secondary' and not s.get('quotes'): bad.append(('no-quotes',a['name'],s.get('url')))
        p=page(s['saved'])
        if p is None: missing.add(s['saved']); continue
        q=norm(s['said'])
        parts=[x.strip() for x in re.split(r'\s*(?:…|\.\.\.)\s*',q) if x.strip()]
        if not all(x in p for x in parts): bad.append(('notfound',a['name'],s['saved'],s['said'][:90]))
print(f, 'attributes',len(d['attributes']),'citations',n,'secondary',sec,'blockers',len(d.get('blockers',[])))
print('missing files',sorted(missing))
print('bad',len(bad))
for b in bad[:40]: print(' ',b)
