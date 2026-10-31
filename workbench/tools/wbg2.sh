#!/bin/bash
# wbg2.sh TIMESTAMP URL NAME: fetch archive.org snapshot raw (id_) into dl/cr16b/NAME with up to 6 retries
S=/tmp/claude-0/-home-user-SLATE/c8b0b159-b4a5-540a-bbd6-18661cbe240c/scratchpad
f=$S/dl/cr16b/$3
for i in 1 2 3 4 5 6; do code=$(curl -sS -L -m 120 -A "SLATE-research/0.1 (curl)" -o "$f" -w "%{http_code}" "https://web.archive.org/web/$1id_/$2" 2>/dev/null); [ "$code" = 200 ] && break; sleep 4; done
echo "$3: $code $(stat -c %s "$f" 2>/dev/null)"
