# sp.py FILE: decode a SharePoint page with its content embedded as escaped JSON into FILE.txt (unicode escapes, entities, tags stripped)
import re,html,sys
s=open(sys.argv[1],encoding='utf-8').read()
s=re.sub(r'\\u([0-9a-fA-F]{4})',lambda m:chr(int(m.group(1),16)),s).replace('\\n',' ').replace('\\t',' ').replace('\\"','"')
s=html.unescape(html.unescape(s)); s=re.sub(r'<script.*?</script>|<style.*?</style>','',s,flags=re.S); s=re.sub(r'<[^>]+>',' ',s); s=re.sub(r'\s+',' ',s)
open(sys.argv[1]+'.txt','w').write(s)
