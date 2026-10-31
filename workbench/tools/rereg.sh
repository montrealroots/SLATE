#!/bin/bash
# rereg.sh CC...: refresh each passport file's register entry (sha and sources), keeping its sought
cd /home/user/SLATE
for cc in "$@"; do
  sought=$(python3 -c "import json;print(next(e['sought'] for e in json.load(open('research/register.json'))['entries'] if e['fact']=='papers.passports.$cc'))")
  python3 /tmp/claude-0/-home-user-SLATE/c8b0b159-b4a5-540a-bbd6-18661cbe240c/scratchpad/bin/padd.py papers.passports.$cc research/sources/papers/passports/$cc.json "$sought"
done
