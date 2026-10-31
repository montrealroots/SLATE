#!/bin/bash
# regrates.sh: register every exchange-rate research file the register doesn't cite yet, or cites at another hash
S=/tmp/claude-0/-home-user-SLATE/c8b0b159-b4a5-540a-bbd6-18661cbe240c/scratchpad
cd /home/user/SLATE
python3 - <<'PY' | while IFS='|' read -r fact path sought; do python3 $S/bin/padd.py "$fact" "$path" "$sought" >/dev/null; done
import json,hashlib,os
reg=json.load(open('research/register.json'))
cited={e['value']['file']:e['value'].get('sha256') for e in reg['entries'] if e['fact'].startswith('money.rates.') and isinstance(e.get('value'),dict) and 'file' in e['value']}
cur=json.load(open('src/core/money/currencies.json'))['currencies']
D='research/sources/money/rates'
for f in sorted(os.listdir(D)):
    if not f.endswith('.json'): continue
    p=D+'/'+f; sha=hashlib.sha256(open(p,'rb').read()).hexdigest()
    if cited.get(p)==sha: continue
    c=json.load(open(p))['currency']; n=cur[c]['name'] if isinstance(cur,dict) and isinstance(cur.get(c),dict) and 'name' in cur[c] else c
    print(f"money.rates.{c}|{p}|The exchange rate of the {n} ({c}) against the US dollar")
PY
