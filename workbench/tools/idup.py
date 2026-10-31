#!/usr/bin/env python3
# idup.py CC: load research/sources/papers/ids/CC.json into $S/up/CC.json for editing; idup.py --write CC: run idw.py on it
import json,sys,subprocess,os
S='/tmp/claude-0/-home-user-SLATE/c8b0b159-b4a5-540a-bbd6-18661cbe240c/scratchpad'
R='/home/user/SLATE/research/sources/papers/ids/'
os.makedirs(S+'/up',exist_ok=True)
if sys.argv[1]=='--write':
    subprocess.run(['python3',S+'/bin/idw.py',S+'/up/%s.json'%sys.argv[2]])
else:
    d=json.load(open(R+sys.argv[1]+'.json')); json.dump(d,open(S+'/up/%s.json'%sys.argv[1],'w'),ensure_ascii=False,indent=1)
