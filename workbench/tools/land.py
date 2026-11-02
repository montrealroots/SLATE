#!/usr/bin/env python3
# land.py OUT.json DEST.json TOPIC NOTE: turn a research subagent's output (sources nested under each figure or genre)
# into a research file (sources listed once, each figure or genre citing them by index), keeping any extra data keys.
import json, sys
out, dest, topic, note = sys.argv[1:5]
d = json.load(open(out))
read = d.get('read', '2026-11-01')
sources, index = [], {}

def cite(s):
    key = (s['url'], s.get('saved'))
    if key not in index:
        e = {'url': s['url'], 'title': s['title'], 'read': s.get('read', read), 'kind': s.get('kind', 'primary')}
        for k in ('quotes', 'basis'):
            if s.get(k):
                e[k] = s[k]
        e['said'] = s['said']
        index[key] = len(sources)
        sources.append(e)
    else:
        prev = sources[index[key]]
        if s['said'] not in prev['said']:
            prev['said'] += ' … ' + s['said']
    return {'src': index[key], 'said': s['said']}

res = {'topic': topic, 'read': read, 'note': note}
for listed in ('figures', 'genres'):
    if listed in d:
        res[listed] = [{**{k: v for k, v in x.items() if k != 'sources'}, 'sources': [cite(s) for s in x['sources']]} for x in d[listed]]
for k, v in d.items():
    if k not in ('part', 'read', 'figures', 'genres', 'blockers'):
        res[k] = v
res['sources'] = sources
res['blockers'] = d.get('blockers', [])
json.dump(res, open(dest, 'w'), indent=1, ensure_ascii=False)
open(dest, 'a').write('\n')
print(dest, len(sources), 'sources')
