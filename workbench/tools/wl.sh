#!/bin/bash
# wl.sh CC Article [n]: fetch like wiki.sh, then print the lead sentence(s) after the navbox and n chars from the first policy section
S=/tmp/claude-0/-home-user-SLATE/c8b0b159-b4a5-540a-bbd6-18661cbe240c/scratchpad
bash $S/bin/wiki.sh $1 $2 1 >/dev/null
cc=$(echo $1 | tr A-Z a-z)
python3 -I - $S/dl/${cc}_wiki.txt ${3:-3000} <<'PY'
import sys,re
t=open(sys.argv[1]).read(); n=int(sys.argv[2])
if 'Too many requests' in t[:3000]: print('RATE LIMITED'); sys.exit()
m=re.search(r'Visa policy map \[ edit \]',t); i=m.start() if m else 0
j=t.rfind(' v t e ',0,i); print('LEAD:',t[j+7:i][-700:])
k=t.find('[ edit ]',i+25); print('BODY:',t[k-40:k+n])
PY
