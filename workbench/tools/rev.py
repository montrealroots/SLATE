#!/usr/bin/env python3
# rev.py ID...: a lead's claimed account and fee, and the fee lines its fetched page holds
import json,sys,subprocess,re
S='/tmp/claude-0/-home-user-SLATE/c8b0b159-b4a5-540a-bbd6-18661cbe240c/scratchpad'
leads=json.load(open(S+'/leads.json')); st={l.split('\t')[0]:l.strip().split('\t') for l in open(S+'/lead/status.tsv')}
K=r'(monthly|per month|a month|/month|maintenance|service (fee|charge)|account fee|ledger fee|frais (de )?tenue|tenue de compte|mensuel|par mois|/mois|cuota|comisi[oó]n|mantenimiento|mensual|al mes|Geb[üu]hr|monatl|Kontof[üu]hrung|tarifa|taxa|manuten|mensal|ao m[eê]s|月|수수료|ежемес|обслуживан|abonament|miesi|měsí|mesečn|havi|kuukau|månad|maand|commissione|canone|mensile)'
for i in sys.argv[1:]:
    cc,n=i.split('_'); b=leads[cc][int(n)]
    print('=====',i,b['bank'],'|',b['current']['name'],'| fee',b['current'].get('fee'),'|',(b['current'].get('note') or '')[:200])
    s=st.get(i); print('   ',s[1:] if s else None)
    if not s or not s[1].startswith('200'): continue
    t=subprocess.run([S+'/bin/tx',S+'/lead/'+i],capture_output=True,text=True).stdout
    hits=[m.start() for m in re.finditer(K,t,re.I)][:8]
    last=-999
    for h in hits:
        if h-last<250: continue
        print('   >',t[max(0,h-160):h+200].replace('\n',' ')); last=h
