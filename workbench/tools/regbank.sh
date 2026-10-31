#!/bin/bash
# regbank.sh: register every banks research file the register doesn't cite yet, or cites at another hash
S=/tmp/claude-0/-home-user-SLATE/c8b0b159-b4a5-540a-bbd6-18661cbe240c/scratchpad
cd /home/user/SLATE
python3 - <<'PY' | while IFS='|' read -r fact path sought; do python3 $S/bin/padd.py "$fact" "$path" "$sought" >/dev/null; done
import json,hashlib,os
reg=json.load(open('research/register.json'))
cited={e['value']['file']:e['value'].get('sha256') for e in reg['entries'] if e['fact'].startswith('money.banks.') and isinstance(e.get('value'),dict) and 'file' in e['value']}
names=json.load(open('src/world/gazetteer/countries.json'))
D='research/sources/money/banks'
for f in sorted(os.listdir(D)):
    if not f.endswith('.json'): continue
    p=D+'/'+f; sha=hashlib.sha256(open(p,'rb').read()).hexdigest()
    if cited.get(p)==sha: continue
    cc=json.load(open(p))['country']; n=names[cc]['name'].strip()
    print(f"money.banks.{cc}|{p}|The banks of {n} and what their everyday account costs, as each bank publishes it")
PY
