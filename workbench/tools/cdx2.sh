#!/bin/bash
# cdx2.sh URLPATTERN [limit]: list archive.org CDX captures (collapsed by url), retrying
for i in 1 2 3 4 5 6; do r=$(curl -sS -m 60 "https://web.archive.org/cdx/search/cdx?url=$1&output=json&fl=timestamp,original,statuscode,mimetype&collapse=urlkey&limit=${2:-60}" 2>/dev/null); echo "$r" | grep -q '^\[\["timestamp' && { echo "$r" | tr -d '\n' | sed 's/\],\[/]\n[/g'; echo; return 0 2>/dev/null || exit 0; }; echo "$r" | grep -q '^\[\]' && { echo "$1: none"; exit 0; }; sleep 5; done; echo "$1: no answer"
