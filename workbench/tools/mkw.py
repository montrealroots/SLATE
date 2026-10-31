# mkw.py: build a visits spec whose source is a Wikipedia visa-policy article (secondary, quoting the named primary).
# usage from python: mk(cc, rules, others, note, title, said, quotes, extra_sources=[])
import json,subprocess
S='/tmp/claude-0/-home-user-SLATE/c8b0b159-b4a5-540a-bbd6-18661cbe240c/scratchpad/'
def rule(entry,codes,days=None,within=None,months=None):
    r={"entry":entry}
    if days: r['days']=days
    if within: r['within']=within
    if months: r['months']=months
    r['passports']=sorted(set(codes.split() if isinstance(codes,str) else codes)); return r
def mk(cc,rules,others,note,article,said,quotes,extra=()):
    src=[{"url":f"https://en.wikipedia.org/wiki/{article}","title":f"Wikipedia, {article.replace('_',' ')}","read":"2026-10-29","kind":"secondary","quotes":quotes,"said":said,"page":S+f"dl/{cc.lower()}_wiki.txt"}]+list(extra)
    seen=set()
    for r in rules:
        for p in r['passports']:
            assert p not in seen,(cc,p); seen.add(p)
    spec={"country":cc,"rules":rules,"others":others,"note":note,"sources":src}
    json.dump(spec,open(S+f'vis/{cc.lower()}.json','w'),ensure_ascii=False,indent=1)
    print(subprocess.run(['python3',S+'bin/vw.py',S+f'vis/{cc.lower()}.json'],capture_output=True,text=True).stdout.strip())
