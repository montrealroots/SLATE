#!/usr/bin/env python3
# padd.py FACT FILE SOUGHT [extra-value-json]: add or refresh a register entry citing a source file's sources and sha256
import json,hashlib,sys,re
R='/home/user/SLATE/research/register.json'
fact,file,sought=sys.argv[1:4]
extra=json.loads(sys.argv[4]) if len(sys.argv)>4 else {}
txt=open(R).read()
reg=json.loads(txt)
path='/home/user/SLATE/'+file
data=json.load(open(sys.argv[5])) if len(sys.argv)>5 else json.load(open(path))
sha=hashlib.sha256(open(path,'rb').read()).hexdigest()
srcs=[]
for s in data.get('sources',[]):
    e={"kind":s.get('kind','primary'),"url":s['url'],"title":s['title'],"read":s['read'],"said":s['said']}
    if 'quotes' in s: e['quotes']=s['quotes']
    srcs.append(e)
value={"file":file,"sha256":sha,**extra}
ids=[e['id'] for e in reg['entries']]
old=[e for e in reg['entries'] if e['fact']==fact]
if old:
    eid=old[0]['id']
    # an update rewrites that entry's block in place, keeping the rest of the file's formatting
    eid=old[0]['id']
    entry={"id":eid,"fact":fact,"sought":sought,"status":("found" if any(x["kind"]=="primary" for x in srcs) else "secondary"),"value":value,"sources":srcs}
    body='\n'.join('  '+l for l in json.dumps(entry,indent=1,ensure_ascii=True).split('\n'))
    start=txt.index('  {\n   "id": "%s"'%eid)
    end=txt.index('\n  }',start)+len('\n  }')
    open(R,'w').write(txt[:start]+body+txt[end:])
else:
    eid='R-%04d'%(max(int(i[2:]) for i in ids)+1)
    entry={"id":eid,"fact":fact,"sought":sought,"status":("found" if any(x["kind"]=="primary" for x in srcs) else "secondary"),"value":value,"sources":srcs}
    body='\n'.join('  '+l for l in json.dumps(entry,indent=1,ensure_ascii=True).split('\n'))
    end='\n ]\n}\n'
    assert txt.endswith('  }'+end)
    open(R,'w').write(txt[:-len(end)]+',\n'+body+end)
print(eid,fact,sha)
