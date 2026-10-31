# ctx.py CC REGEX [N] [layout|raw]: show lines matching REGEX with N lines of context from each saved source of CC
import sys,glob,subprocess,re
S='/tmp/claude-0/-home-user-SLATE/c8b0b159-b4a5-540a-bbd6-18661cbe240c/scratchpad'
cc,rx=sys.argv[1],re.compile(sys.argv[2],re.I); n=int(sys.argv[3]) if len(sys.argv)>3 else 3
mode=sys.argv[4] if len(sys.argv)>4 else 'layout'
for p in sorted(glob.glob(f'{S}/dl/cards/{cc}_*')):
    b=open(p,'rb').read(5)
    if b.startswith(b'%PDF'):
        t=subprocess.run(['pdftotext']+(['-layout'] if mode=='layout' else [])+[p,'-'],capture_output=True,text=True).stdout
    else:
        import html as H
        t=open(p,encoding='utf-8',errors='replace').read(); t=re.sub(r'<script.*?</script>|<style.*?</style>','',t,flags=re.S); t=H.unescape(re.sub(r'<[^>]+>','\n',t))
    L=[l.rstrip() for l in t.split('\n') if l.strip()]
    shown=set()
    print('#####',p.split('/')[-1])
    for i,l in enumerate(L):
        if rx.search(l):
            for j in range(max(0,i-n),min(len(L),i+n+1)):
                if j not in shown: print(f'{j}: {L[j][:200]}'); shown.add(j)
            print('--')
