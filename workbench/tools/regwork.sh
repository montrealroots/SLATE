#!/bin/bash
# regvis.sh: register every visits research file (countries and shared lists) the register doesn't cite yet, or cites at another hash
S=/tmp/claude-0/-home-user-SLATE/c8b0b159-b4a5-540a-bbd6-18661cbe240c/scratchpad
cd /home/user/SLATE
python3 - <<'PY' | while IFS='|' read -r fact path sought; do python3 $S/bin/padd.py "$fact" "$path" "$sought" >/dev/null; done
import json,hashlib,os
reg=json.load(open('research/register.json'))
cited={e['value']['file']:e['value'].get('sha256') for e in reg['entries'] if e['fact'].startswith('papers.work.') and isinstance(e.get('value'),dict) and 'file' in e['value']}
names=json.load(open('src/world/gazetteer/countries.json'))
D='research/sources/papers/work'
for f in sorted(os.listdir(D+'/groups')):
    p=D+'/groups/'+f; sha=hashlib.sha256(open(p,'rb').read()).hexdigest()
    if cited.get(p)!=sha: print(f"papers.work.group.{f[:-5]}|{p}|The shared list of free movement {f[:-5]}: the passports that may live and work in the countries that keep it")
for f in sorted(os.listdir(D)):
    if not f.endswith('.json'): continue
    p=D+'/'+f; sha=hashlib.sha256(open(p,'rb').read()).hexdigest()
    if cited.get(p)==sha: continue
    d=json.load(open(p)); cc=d['country']; n=names[cc]['name'].strip()
    s=f"What a performer needs to live and work in {n}, by passport" + (f": the shared {d['group']} list it keeps" if 'group' in d else ", from its own list")
    print(f"papers.work.{cc}|{p}|{s}")
PY
