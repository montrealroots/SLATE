# hoff.py "CODES ADDED" : rewrite the credit matrix line of HANDOFF.md from the coverage, appending codes to the researched list
import json,re,sys
p='/home/user/SLATE/HANDOFF.md'; s=open(p).read()
i=s.index("Matrix (2026-10-30): ", s.index("**Credit records**"))
j=s.index(" pending.",i)+len(" pending.")
old=s[i:j]
c=json.load(open('/home/user/SLATE/coverage/credit-countries.json'))['rows']
n={k:sum(1 for r in c if r['status']==k) for k in ('researched','proven','pending','blocked')}
m=re.match(r"Matrix \(2026-10-30\):\s+\d+\s+researched\s+\((.*)\),\s+\d+\s+proven,(?:\s+\d+\s+blocked,)?\s+\d+\s+pending\.$",old,re.S)
body=re.sub(r"\s+"," ",m.group(1))
add=sys.argv[1] if len(sys.argv)>1 else ''
if add: body=body.replace('; PR, GU', ', '+add+'; PR, GU',1)
blk=f", {n['blocked']} blocked" if n['blocked'] else ''
text=f"Matrix (2026-10-30): {n['researched']} researched ({body}), {n['proven']} proven{blk}, {n['pending']} pending."
# wrap at 118 with two-space indent
words=text.split(' '); lines=[]; cur=''
for w in words:
    if len(cur)+len(w)+1>114 and cur: lines.append(cur); cur=w
    else: cur=(cur+' '+w).strip()
lines.append(cur)
first_indent=s.rfind('\n',0,i)
s=s[:i]+'\n  '.join(lines)+s[j:]
open(p,'w').write(s); print(n)
