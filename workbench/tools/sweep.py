import json,glob,subprocess,re,os,sys
S='/tmp/claude-0/-home-user-SLATE/c8b0b159-b4a5-540a-bbd6-18661cbe240c/scratchpad'
KW=re.compile(r'(?i)credit card|kreditkart|carte de cr[ée]dit|cartes? de cr[ée]dit|tarjeta de cr[ée]dito|cart[ãa]o de cr[ée]dito|carta di credito|creditcard|kredittkort|kreditkort|luottokort|kreditn[ií] kart|karta kredytow|кредитн|бизнес карт|بطاقة ائتمان|بطاقات الائتمان|信用卡|クレジット|신용카드|kredi kart|visa classic|mastercard standard|annual fee|cotisation annuelle|cuota anual|anuidade|jahresgeb|jahresentgelt|årsavgift|vuosimaksu|taux d.int[ée]r[êe]t|tasa de inter[ée]s|taxa de juros|sollzins|purchase rate|\bapr\b')
for f in sorted(glob.glob('/home/user/SLATE/research/sources/money/banks/*.json')):
    d=json.load(open(f)); cc=d['country']
    out=f'{S}/cards/{cc}.txt'
    if os.path.exists(out): continue
    lines=[]
    for i,s in enumerate(d['sources']):
        u=s['url']; p=f'{S}/dl/cards/{cc}_{i}'
        r=subprocess.run(['curl','-sS','-L','-m','60','--compressed','-A','SLATE-research/0.1 (curl)','-o',p,'-w','%{http_code}',u],capture_output=True,text=True)
        code=r.stdout
        try:
            head=open(p,'rb').read(5)
        except Exception: lines.append(f'## {u} FAIL {code}'); continue
        if head.startswith(b'%PDF'):
            t=subprocess.run(['pdftotext','-layout',p,'-'],capture_output=True,text=True).stdout
        else:
            t=open(p,encoding='utf-8',errors='replace').read(); t=re.sub(r'<script.*?</script>|<style.*?</style>','',t,flags=re.S); t=re.sub(r'<[^>]+>','\n',t)
        hits=[l.strip()[:220] for l in t.split('\n') if KW.search(l)]
        lines.append(f'## {u} {code} hits={len(hits)}'); lines+=hits[:40]
    open(out,'w').write('\n'.join(lines)+'\n')
    print(cc, len(lines), flush=True)
