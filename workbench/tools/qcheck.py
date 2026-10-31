# qcheck.py FILE.json IDX PAGE(html|txt|pdf-txt): each ' ... '-separated part of source IDX's said is in the page text
import json,re,html,sys
s=open(sys.argv[3],encoding='utf-8',errors='replace').read()
if '<' in s[:2000]:
    s=re.sub(r'<script.*?</script>|<style.*?</style>','',s,flags=re.S); s=html.unescape(re.sub(r'<[^>]+>',' ',s))
t=re.sub(r'\s+',' ',re.sub(r'-\n(?=\w)','',s))
said=json.load(open(sys.argv[1]))['sources'][int(sys.argv[2])]['said']
for p in said.split(' ... '): print(p.strip() in t, p[:50])
