import re,sys,html
t=open(sys.argv[1],errors='replace').read()
t=re.sub(r'(?s)<(script|style).*?</\1>','',t); t=re.sub(r'<[^>]+>','\n',t); t=html.unescape(t)
lines=[l.strip() for l in t.split('\n') if l.strip()]
print('\n'.join(lines))
