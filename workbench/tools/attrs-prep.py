import json,sys
S,role=sys.argv[1],sys.argv[2]; out=[]
for p in ('registers','judging','teaching'):
    for a in json.load(open(f'{S}/attrs/out/{role}-{p}.json'))['attributes']:
        out.append({'i':len(out),'name':a['name'],'meaning':a['meaning'],'from':p,'urls':sorted({s['url'] for s in a['sources']}),'ratings':[s['rating'] for s in a['sources'] if s.get('rating')]})
json.dump(out,open(f'{S}/attrs/all-{role}.json','w'),ensure_ascii=False,indent=0); print(role,len(out))
