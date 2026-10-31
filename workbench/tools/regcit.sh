#!/bin/bash
# regcit.sh: register every citizenship research file the register doesn't cite yet, or cites at another hash
S=/tmp/claude-0/-home-user-SLATE/c8b0b159-b4a5-540a-bbd6-18661cbe240c/scratchpad
cd /home/user/SLATE
python3 - <<'PY' | while IFS='|' read -r cc sought; do python3 $S/bin/padd.py "papers.citizenship.$cc" "research/sources/papers/citizenship/$cc.json" "$sought" >/dev/null; done
import json,hashlib,os
reg=json.load(open('research/register.json'))
cited={e['value']['file']:e['value'].get('sha256') for e in reg['entries'] if e['fact'].startswith('papers.citizenship.') and isinstance(e.get('value'),dict) and 'file' in e['value']}
names=json.load(open('src/world/gazetteer/countries.json'))
for f in sorted(os.listdir('research/sources/papers/citizenship')):
    p='research/sources/papers/citizenship/'+f
    sha=hashlib.sha256(open(p,'rb').read()).hexdigest()
    if cited.get(p)==sha: continue
    d=json.load(open(p)); cc=d['country']; n=names[cc]['name'].strip()
    if 'nationalityOf' in d: s=f"Whose nationality the people of {n} hold, and so whose rules on naturalisation and on keeping citizenship are theirs"
    else: s=f"{n}'s citizenship: the years of residence its ordinary naturalisation asks, whether other citizenships must be given up, and whether its citizens lose it on taking another"
    print(f"{cc}|{s}")
PY
