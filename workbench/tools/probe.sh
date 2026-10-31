#!/bin/bash
# probe.sh URL [regex]: fetch a page honestly, report status, size, any bot check, and lines matching regex
S=/tmp/claude-0/-home-user-SLATE/c8b0b159-b4a5-540a-bbd6-18661cbe240c/scratchpad
u="$1"; re="${2:-years|ans|años|anos|jahre|anni}"; f=$S/dl/probe/$(echo "$u" | md5sum | cut -c1-10)
mkdir -p $S/dl/probe
code=$(curl $CURLX -s -L -m ${T:-40} -A "SLATE-research/0.1 (curl)" -o "$f" -w "%{http_code}" "$u" 2>/dev/null)
size=$(stat -c %s "$f" 2>/dev/null || echo 0)
bot=$(grep -o -i -E "cloudflare|captcha|incapsula|akamai|Request Rejected|Just a moment" "$f" 2>/dev/null | head -1)
hits=$(python3 -I -c "
import re,html,sys
try: s=open(sys.argv[1],encoding='utf-8',errors='replace').read()
except: s=''
s=html.unescape(re.sub(r'<[^>]+>',' ',s)); s=re.sub(r'\s+',' ',s)
print(len(re.findall(sys.argv[2],s,re.I)))" "$f" "$re" 2>/dev/null)
echo "$u | $code | ${size}B | ${bot:-no check} | matches:$hits"
