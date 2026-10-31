#!/bin/bash
# arch.sh URL...: the Wayback availability API's closest snapshot for each URL (the API only; web.archive.org itself resets)
for u in "$@"; do
  r=$(curl -sS -A "SLATE-research/0.1 (curl)" -m 30 "https://archive.org/wayback/available?url=$u" 2>&1)
  echo "$u => $(echo "$r" | python3 -c "import json,sys
try:
  d=json.load(sys.stdin)['archived_snapshots'].get('closest')
  print(d['url'],d['timestamp']) if d else print('no snapshot')
except Exception as e: print('error',e)")"
done
