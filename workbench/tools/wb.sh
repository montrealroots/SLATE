#!/bin/bash
# wb.sh URL...: ask archive.org's availability API for each URL's closest snapshot
for u in "$@"; do r=$(curl -s -m 30 "https://archive.org/wayback/available?url=$(python3 -c 'import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1],safe=""))' "$u")"); echo "$u => $(echo "$r" | python3 -c 'import json,sys
try:
 d=json.load(sys.stdin); c=d.get("archived_snapshots",{}).get("closest")
 print(c["timestamp"]+" "+c["url"] if c else "no snapshot")
except Exception as e: print("no answer")')"; done
