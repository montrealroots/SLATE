#!/bin/bash
# regx.sh ENGINE PREFIX "SOUGHT TEMPLATE with {name}": register every research file under research/sources/ENGINE the
# register doesn't cite at its current hash, as fact PREFIX.<key>.
S=/tmp/claude-0/-home-user-SLATE/c8b0b159-b4a5-540a-bbd6-18661cbe240c/scratchpad
cd /home/user/SLATE
python3 - "$1" "$2" "$3" <<'PY' | while IFS='|' read -r fact path sought; do python3 $S/bin/padd.py "$fact" "$path" "$sought" >/dev/null || echo "FAIL $fact"; done
import json,hashlib,os,sys
engine,prefix,tmpl=sys.argv[1:4]
reg=json.load(open('research/register.json'))
cited={e['value']['file']:e['value'].get('sha256') for e in reg['entries'] if isinstance(e.get('value'),dict) and 'file' in e['value']}
sought={e['fact']:e['sought'] for e in reg['entries']}
names=json.load(open('src/world/gazetteer/countries.json')); regions=json.load(open('src/world/gazetteer/regions.json'))
D='research/sources/'+engine
for f in sorted(os.listdir(D)):
    if not f.endswith('.json'): continue
    p=D+'/'+f
    if cited.get(p)==hashlib.sha256(open(p,'rb').read()).hexdigest(): continue
    key=f[:-5]; cc=key.split('.')[0]
    n=names[cc]['name'].strip()
    if '.' in key:
        r=regions.get(key); rn=(r.get('name') if isinstance(r,dict) else r) or key
        n=f"{rn}, {n}"
    fact=f"{prefix}.{key}"
    print(f"{fact}|{p}|{sought.get(fact) or tmpl.replace('{name}',n)}")
PY
