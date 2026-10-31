#!/bin/bash
# regids.sh: register every ID research file the register doesn't cite yet, or cites at another hash
S=/tmp/claude-0/-home-user-SLATE/c8b0b159-b4a5-540a-bbd6-18661cbe240c/scratchpad
cd /home/user/SLATE
python3 - <<'PY' | while IFS='|' read -r cc sought; do python3 $S/bin/padd.py "papers.ids.$cc" "research/sources/papers/ids/$cc.json" "$sought"; done
import json,hashlib,os
reg=json.load(open('research/register.json'))
cited={e['value']['file']:e['value'].get('sha256') for e in reg['entries'] if e['fact'].startswith('papers.ids.') and isinstance(e.get('value'),dict) and 'file' in e['value']}
names=json.load(open('src/world/gazetteer/countries.json'))
for f in sorted(os.listdir('research/sources/papers/ids')):
    p='research/sources/papers/ids/'+f
    sha=hashlib.sha256(open(p,'rb').read()).hexdigest()
    if cited.get(p)==sha: continue
    d=json.load(open(p)); cc=d['country']; n=names[cc]['name']
    if 'none' in d: s=f"Whether {n} issues a national identity card, from its own law or government"
    elif 'issuedBy' in d: s=f"Whose national identity card the people of {n} hold, and at what fee"
    else: s=f"{n}'s national identity card: its name, fees by age and route, and validity, from the issuing authority"
    print(f"{cc}|{s}")
PY
