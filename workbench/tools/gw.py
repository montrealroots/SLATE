#!/usr/bin/env python3
# gw.py ENGINE SPEC.json: write research/sources/<ENGINE>/<key>.json (ENGINE e.g. papers/numbers, money/banks) for each
# entry of a spec (one object or a list), each keyed by its "key" (popped; else its "country"), after checking every
# ' ... ' part of each source's said against its saved "page" (popped). An entry whose source lacks "page" is written
# only if it says read_by_eye: True (popped). Loads nothing else.
import json,sys,subprocess,unicodedata,re,html,os
engine=sys.argv[1]; spec=json.load(open(sys.argv[2])); specs=spec if isinstance(spec,list) else [spec]
R='/home/user/SLATE/research/sources/'+engine+'/'
os.makedirs(R,exist_ok=True)
def text(path):
    if b'%PDF-' in open(path,'rb').read(4096):
        s=subprocess.run(['pdftotext','-layout',path,'-'],capture_output=True,text=True).stdout+'\n'+subprocess.run(['pdftotext',path,'-'],capture_output=True,text=True).stdout
    else:
        s=open(path,encoding='utf-8',errors='replace').read()
        if '<' in s[:3000]:
            s=re.sub(r'<script.*?</script>|<style.*?</style>','',s,flags=re.S); s=html.unescape(re.sub(r'<[^>]+>',' ',s))
    return unicodedata.normalize('NFC',re.sub(r'\s+',' ',re.sub(r'-\n(?=\w)','',s.replace('­',''))))
for d in specs:
    key=d.pop('key',None) or d['country']; ok=True
    for s in d.get('sources',[]):
        if any(c in s['url'] for c in ' "<>') or not s['url'].startswith(('https://','http://')): ok=False; print(key,'BAD URL:',s['url'])
        if s.get('kind')=='secondary' and not s.get('quotes'): ok=False; print(key,'SECONDARY WITHOUT quotes:',s['url'])
        for f in ('url','title','read','said'):
            if not s.get(f): ok=False; print(key,'SOURCE LACKS',f)
        eye=s.pop('read_by_eye',False)
        pg=s.pop('page',None)
        if pg is None:
            if not eye: ok=False; print(key,'NO PAGE (and not read_by_eye):',s['url'])
            continue
        t=text(pg)
        for p in s['said'].split(' ... '):
            if unicodedata.normalize('NFC',re.sub(r'\s+',' ',p.strip())) not in t: ok=False; print(key,'MISSING:',p[:90])
    if ok:
        open(R+key+'.json','w').write(json.dumps(d,indent=1,ensure_ascii=False)+'\n'); print(key,'written')
