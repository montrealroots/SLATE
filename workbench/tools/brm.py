#!/usr/bin/env python3
# brm.py FACT: remove one register entry by fact (a blocker superseded by research), keeping the file's layout
import json,sys
R='/home/user/SLATE/research/register.json'
txt=open(R).read(); reg=json.loads(txt)
e=[x for x in reg['entries'] if x['fact']==sys.argv[1]]; assert len(e)==1, 'no such fact'
eid=e[0]['id']
start=txt.index('  {\n   "id": "%s"'%eid); end=txt.index('\n  }',start)+len('\n  }')
if txt[end]==',': end+=1; start=start
else: start=txt.rindex(',',0,start)
new=(txt[:start]+txt[end:]).replace('},\n\n  {','},\n  {')
json.loads(new); open(R,'w').write(new); print('removed',eid)
