#!/usr/bin/env python3
# cup.py CC: load research/sources/papers/citizenship/CC.json into $S/cup/CC.json for editing; cup.py --write CC: verify and write it back
import json,sys,subprocess,os
S='/tmp/claude-0/-home-user-SLATE/c8b0b159-b4a5-540a-bbd6-18661cbe240c/scratchpad'
R='/home/user/SLATE/research/sources/papers/citizenship/'
os.makedirs(S+'/cup',exist_ok=True)
if sys.argv[1]=='--write':
    subprocess.run(['python3',S+'/bin/cw.py',S+'/cup/%s.json'%sys.argv[2]])
else:
    d=json.load(open(R+sys.argv[1]+'.json')); json.dump(d,open(S+'/cup/%s.json'%sys.argv[1],'w'),ensure_ascii=False,indent=1)
