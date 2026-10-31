#!/usr/bin/env python3
# idw.py SPEC.json: write research/sources/papers/ids/<CC>.json from a spec whose sources carry "page" (a saved page),
# check every ' ... ' part of each said against its page, and refuse to write if one isn't found.
import json,re,html,sys,subprocess,unicodedata
spec=json.load(open(sys.argv[1]))
specs=spec if isinstance(spec,list) else [spec]
PUA={0xf70a:'่',0xf70b:'้',0xf70c:'๊',0xf70d:'๋',0xf70e:'์',0xf702:'ี',0xf701:'ิ',0xf703:'ึ',0xf704:'ื',0xf710:'ั',0xf712:'็',0xf713:'่',0xf714:'้'}
def text(path):
    if path.endswith('.pdf'):
        a=subprocess.run(['pdftotext','-layout',path,'-'],capture_output=True,text=True).stdout
        b=subprocess.run(['pdftotext',path,'-'],capture_output=True,text=True).stdout
        s=a+'\n'+b
    else:
        s=open(path,encoding='utf-8',errors='replace').read()
        if '<' in s[:3000]:
            s=re.sub(r'<script.*?</script>|<style.*?</style>','',s,flags=re.S); s=html.unescape(re.sub(r'<[^>]+>',' ',s)); s=re.sub(r'<br ?/?>',' ',s)  # markup escaped in the page's text
    s=s.translate(PUA)  # Thai fonts' private-use glyphs for the tone marks and vowels above
    return unicodedata.normalize('NFC',re.sub(r'\s+',' ',re.sub(r'-\n(?=\w)','',s)))  # one form for letters with a nukta
for d in specs:
    ok=True
    for s in d['sources']:
        if any(c in s['url'] for c in ' "<>') or not s['url'].startswith('https://') and not s['url'].startswith('http://'): ok=False; print(d['country'],'BAD URL:',s['url'])
        pg=s.pop('page',None)
        if pg is None: continue
        t=text(pg)
        for p in s['said'].split(' ... '):
            if unicodedata.normalize('NFC',p.strip()) not in t: ok=False; print(d['country'],'MISSING:',p[:90])
    if ok:
        open('/home/user/SLATE/research/sources/papers/ids/%s.json'%d['country'],'w').write(json.dumps(d,indent=1,ensure_ascii=False)+'\n')
        print(d['country'],'written')
