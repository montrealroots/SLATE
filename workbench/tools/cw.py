#!/usr/bin/env python3
# vw.py SPEC.json: write research/sources/papers/visits/<CC>.json (or groups/<name>.json for a spec with "group" and no
# "country") from a spec whose sources carry "page" (a saved page), checking every ' ... ' part of each said against its page.
import json,sys,subprocess,unicodedata,re,html
sys.path.insert(0,'/tmp/claude-0/-home-user-SLATE/c8b0b159-b4a5-540a-bbd6-18661cbe240c/scratchpad/bin')
spec=json.load(open(sys.argv[1])); specs=spec if isinstance(spec,list) else [spec]
def text(path):
    if b'%PDF-' in open(path,'rb').read(4096):
        a=subprocess.run(['pdftotext','-layout',path,'-'],capture_output=True,text=True).stdout
        b=subprocess.run(['pdftotext',path,'-'],capture_output=True,text=True).stdout
        s=a+'\n'+b
    else:
        s=open(path,encoding='utf-8',errors='replace').read()
        if '<' in s[:3000]:
            s=re.sub(r'<script.*?</script>|<style.*?</style>','',s,flags=re.S); s=html.unescape(re.sub(r'<[^>]+>',' ',s))
    return unicodedata.normalize('NFC',re.sub(r'\s+',' ',re.sub(r'-\n(?=\w)','',s.replace('\u00ad',''))))
R='/home/user/SLATE/research/sources/money/cards/'
for d in specs:
    ok=True; name=d.get('country') or d['group']
    for s in d['sources']:
        if any(c in s['url'] for c in ' "<>') or not s['url'].startswith(('https://','http://')): ok=False; print(name,'BAD URL:',s['url'])
        pg=s.pop('page',None)
        if pg is None: continue
        t=text(pg)
        for p in s['said'].split(' ... '):
            if unicodedata.normalize('NFC',re.sub(r'\s+',' ',p.strip())) not in t: ok=False; print(name,'MISSING:',p[:90])
    if ok:
        path=R+(d['country'] if 'country' in d else 'groups/'+d['group'])+'.json'
        open(path,'w').write(json.dumps(d,indent=1,ensure_ascii=False)+'\n'); print(name,'written')
