# pfmt.py CC...: rewrite passport files with one line per route and per band
import json,sys
R='/home/user/SLATE/research/sources/papers/passports/'
def dump(d):
    lines=['{']
    keys=list(d)
    for i,k in enumerate(keys):
        v=d[k]; comma=',' if i<len(keys)-1 else ''
        if k in ('routes','passports') and isinstance(v,list):
            lines.append(f' "{k}": [')
            for j,x in enumerate(v):
                lines.append('  '+json.dumps(x,ensure_ascii=False)+(',' if j<len(v)-1 else ''))
            lines.append(' ]'+comma)
        elif k=='sources':
            s=json.dumps(v,indent=1,ensure_ascii=False).split('\n')
            lines.append(f' "{k}": '+s[0]); lines+= [' '+x for x in s[1:-1]]; lines.append(' '+s[-1]+comma)
        else:
            lines.append(f' "{k}": '+json.dumps(v,ensure_ascii=False)+comma)
    lines.append('}')
    return '\n'.join(lines)+'\n'
for cc in sys.argv[1:]:
    p=R+cc+'.json'; d=json.load(open(p)); open(p,'w').write(dump(d))
