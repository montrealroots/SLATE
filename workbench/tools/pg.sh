#!/bin/bash
# pg.sh NAME URL PATTERN [N]: fetch URL honestly into pp/NAME.html, print status and N matches of PATTERN in its text
S=/tmp/claude-0/-home-user-SLATE/c8b0b159-b4a5-540a-bbd6-18661cbe240c/scratchpad
cd $S/pp || exit 1
curl -sSL --compressed --http1.1 -m 40 ${CA:+--cacert $CA} -A "SLATE-research/0.1 (curl)" -o "$1.html" -w "$1 %{http_code} %{size_download}\n" "$2"
python3 -I - "$1.html" "$3" "${4:-6}" <<'PY'
import re,html,sys
s=open(sys.argv[1],encoding='utf-8',errors='replace').read()
t=re.sub(r'<script.*?</script>|<style.*?</style>','',s,flags=re.S); t=html.unescape(re.sub(r'<[^>]+>',' ',t)); t=re.sub(r'\s+',' ',t)
ms=list(re.finditer(sys.argv[2],t))[:int(sys.argv[3])]
for m in ms: print('>>',t[max(0,m.start()-230):m.start()+170])
if not ms: print('NO MATCH:', t[:200])
PY
