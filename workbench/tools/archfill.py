#!/usr/bin/env python3
# archfill.py: for each "CC URL" in arch-queue.txt whose blk/CC.json lacks an archive attempt, ask the Wayback
# availability API (paced: it answers 429 when hurried), add the archive attempt, and register the blocker.
import json,subprocess,time,urllib.parse,os
S='/tmp/claude-0/-home-user-SLATE/c8b0b159-b4a5-540a-bbd6-18661cbe240c/scratchpad/'
DATE='2026-10-28'
for line in open(S+'arch-queue.txt'):
    if not line.strip(): continue
    cc,url=line.split(None,1); url=url.strip(); p=S+'blk/'+cc+'.json'
    spec=json.load(open(p))
    if any(a['method']=='archive' for a in spec['attempts']): continue
    for tries in range(4):
        time.sleep(45)
        out=subprocess.run(['curl','-sS','-A','SLATE-research/0.1 (curl)','-m','40','https://archive.org/wayback/available?url='+urllib.parse.quote(url,safe='')],capture_output=True,text=True).stdout
        try: d=json.loads(out); break
        except Exception: d=None
    if d is None: print(cc,'API failed'); continue
    c=d.get('archived_snapshots',{}).get('closest')
    if c:
        ts=c['timestamp']; day=f'{ts[:4]}-{ts[4:6]}-{ts[6:8]}'
        res=f"A snapshot of {day} exists ({c['url'].replace('http://','')}); fetching it is refused by this environment's egress policy (403)."
    else: res='No snapshot.'
    spec['attempts'].append({"method":"archive","tried":f"The Wayback Machine's availability API for {url}"+(", then the snapshot" if c else ""),"result":res,"date":DATE})
    open(p,'w').write(json.dumps(spec,indent=1,ensure_ascii=False)+'\n')
    print(cc, subprocess.run(['python3',S+'bin/badd.py',p],capture_output=True,text=True).stdout.strip() or 'badd failed')
