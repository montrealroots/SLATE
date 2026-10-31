#!/bin/bash
# integrate.sh: register every research file the register doesn't cite at its hash, append wave 7's blocker attempts,
# drop blockers whose fact is now researched, and rebuild every engine the research feeds.
S=/tmp/claude-0/-home-user-SLATE/c8b0b159-b4a5-540a-bbd6-18661cbe240c/scratchpad
cd /home/user/SLATE
bash $S/bin/regall.sh
for x in regcredit regcard regwork regids regrates; do bash $S/bin/$x.sh >/dev/null 2>&1; done
bash $S/bin/regx.sh prices world.prices "{name}'s price level: its 2021 benchmark carried to 2025 by its own consumer price index" >/dev/null
bash $S/bin/regx.sh money/formats money.formats "How banks in {name} number their accounts: the account number's structure and the bank's place in it" >/dev/null
bash $S/bin/regx.sh papers/ages papers.ages "What a person may do at what age in {name}, and what their sex changes there: the age of majority, the working age and a young performer's permit, military service by sex and age" >/dev/null
bash $S/bin/regx.sh money/means money.means "The means of a family in {name}: average net wealth and post-tax income per adult by band of the population" >/dev/null
for f in research/sources/money/units/*.json; do [ -f "$f" ] || continue; k=$(basename $f .json); python3 - "$k" "$f" <<'PY' | while IFS='|' read -r fact path sought; do python3 $S/bin/padd.py "$fact" "$path" "$sought" >/dev/null || echo "FAIL $fact"; done
import json,hashlib,sys
k,p=sys.argv[1:3]
reg=json.load(open('research/register.json'))
cited={e['value']['file']:e['value'].get('sha256') for e in reg['entries'] if isinstance(e.get('value'),dict) and 'file' in e['value']}
if cited.get(p)!=hashlib.sha256(open(p,'rb').read()).hexdigest():
    name=json.load(open(p)).get('name',k)
    print(f"money.units.{k}|{p}|The official value of the {name} ({k}) by date, as its publisher gives it")
PY
done
python3 $S/bin/appendblk.py holidays credit numbers residence licence prices weather work passports ids cards banks | grep -v "appended\|added" | head
WAVE=w8 python3 $S/bin/appendblk.py numbers residence licence formats | grep -v "appended\|added" | head
WAVE=w9 python3 $S/bin/appendblk.py numbers residence licence formats | grep -v "appended\|added" | head
WAVE=w10 python3 $S/bin/appendblk.py numbers residence licence formats | grep -v "appended\|added" | head
WAVE=w11 python3 $S/bin/appendblk.py numbers residence banks | grep -v "appended\|added" | head
WAVE=w12 python3 $S/bin/appendblk.py licence banks | grep -v "appended\|added" | head
WAVE=w13 python3 $S/bin/appendblk.py licence numbers residence formats units | grep -v "appended\|added" | head
WAVE=w14 python3 $S/bin/appendblk.py licence | grep -v "appended\|added" | head
WAVE=w15 python3 $S/bin/appendblk.py licence numbers residence formats | grep -v "appended\|added" | head
WAVE=w16 python3 $S/bin/appendblk.py holidays credit numbers residence licence prices weather work passports ids cards banks formats means | grep -v "appended\|added" | head
WAVE=w17 python3 $S/bin/appendblk.py licence cards passports | grep -v "appended\|added" | head
mkdir -p $S/w18/blk/ages && cp $S/ages/blk/*.json $S/w18/blk/ages/ 2>/dev/null; WAVE=w18 python3 $S/bin/appendblk.py ages | grep -v "appended\|added" | head
python3 $S/bin/unblock.py | wc -l
for e in money/units money/credit money/cards money/banks money/rates papers/work papers/passports papers/ids papers/numbers papers/residence papers/licence papers/citizenship prices money/formats money/means papers/ages holidays money/units; do npx tsx tools/$e/build.ts 2>&1 | grep -E "Error" | head -1; done
