#!/usr/bin/env python3
# unblock.py: drop every register entry `<engine>.blocked.<KEY>` whose `<engine>.<KEY>` is now researched, keeping the
# file's formatting (each entry is a block of lines).
import json,re
R='/home/user/SLATE/research/register.json'
txt=open(R).read(); reg=json.loads(txt)
facts={e['fact'] for e in reg['entries']}
drop=[e for e in reg['entries'] if '.blocked.' in e['fact'] and e['fact'].replace('.blocked.','.') in facts]
for e in drop:
    i=txt.index('"id": "%s"'%e['id']); start=txt.rfind('\n  {\n',0,i); end=txt.index('\n  }',i)+len('\n  }')
    # remove the entry and the comma joining it to its neighbour
    if txt[end]==',': txt=txt[:start+1]+txt[end+2:]
    else: txt=txt[:start-1]+txt[end:] if txt[start-1]==',' else txt[:start+1]+txt[end:]
    print('unblocked',e['fact'])
json.loads(txt); open(R,'w').write(txt)
