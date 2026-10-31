#!/usr/bin/env python3
# gcgen.py: write research/sources/papers/citizenship/<CC>.json for every state in GLOBALCIT v3.0 (2024), verbatim rows quoted
import csv,json,re,sys
S='/tmp/claude-0/-home-user-SLATE/c8b0b159-b4a5-540a-bbd6-18661cbe240c/scratchpad'
D=S+'/globalcit/v3/GLOBALCIT Citizenship Law v3/Data'
OUT='/home/user/SLATE/research/sources/papers/citizenship/'
countries=json.load(open('/home/user/SLATE/src/world/gazetteer/countries.json'))
raw={f:open(D+'/'+f,encoding='utf-8-sig').read() for f in ['data_v3.0_country-year-mode_acq.csv','data_v3.0_country-year-mode_loss.csv']}
norm=lambda s: re.sub(r'\s+',' ',s)
rawn={k:norm(v) for k,v in raw.items()}
cy={}
for r in csv.DictReader(open(D+'/data_v3.0_country-year.csv',encoding='utf-8-sig')):
    if r['year']!='2024': continue
    old=cy.get(r['iso3'])
    if old is None or (not old['A06a_yrs_cat'].isdigit() and r['A06a_yrs_cat'].isdigit()): cy[r['iso3']]=r
# The years the coded number reads wrong, as the minimum residence the provision quoted asks.
OVER={'CA':(3,"the 3 of 5 years the provision asks"),'IN':(12,"the 12 months before the application and 11 of the 14 years before them"),'KN':(15,"the 12 months before the application and the 14 years before them"),'DM':(8,"the 12 months before the application and the 7 years before them"),'LC':(8,"the 12 months before the application and the 7 years before them"),'BS':(7,"the 12 months before the application and 6 of the 9 years before them"),'MT':(5,"the 5 of the past 7 years the provision asks")}
SKIP={'AD','MC','SM','VA','MV','UY','CS'}
acq={(r['iso3'],r['mode_id']):r for r in csv.DictReader(open(D+'/data_v3.0_country-year-mode_acq.csv',encoding='utf-8-sig')) if r['year']=='2024'}
loss={(r['iso3'],r['mode_id']):r for r in csv.DictReader(open(D+'/data_v3.0_country-year-mode_loss.csv',encoding='utf-8-sig')) if r['year']=='2024'}
URL='https://cadmus.eui.eu/bitstreams/3b166501-e695-48d7-9e27-d7bef061573a/download'
only=set(sys.argv[1:])
n=0
for iso3,r in sorted(cy.items()):
    cc=r['iso2']
    if cc not in countries or cc in SKIP or (only and cc not in only): continue
    name=countries[cc]['name']
    yrs=r['A06a_yrs_cat']; b=r['A06b_cat']; l=r['L05_cat']
    if b=='9': years='none'; renounce=None
    else:
        years=int(yrs) if yrs.isdigit() else None
        renounce=True if b in ('2','3') else False if b in ('0','1') else None
    lapses=True if l in ('1','2','4','5') else False if l in ('0','3','6') else None
    over=OVER.get(cc)
    if over: years=over[0]
    parts=[]; arts=[]
    for key,src,f in [((iso3,'A06a'),acq,'data_v3.0_country-year-mode_acq.csv'),((iso3,'A06b'),acq,'data_v3.0_country-year-mode_acq.csv'),((iso3,'L05'),loss,'data_v3.0_country-year-mode_loss.csv')]:
        row=src.get(key)
        if row is None: continue
        sp=row['specification'].strip()
        if sp and norm(sp) in rawn[f]: parts.append(sp); arts.append(f"{key[1]} {row['article']}")
    desc=[]
    if years=='none': desc.append("no ordinary naturalisation by residence")
    elif years is None: desc.append("an ordinary naturalisation whose years of residence the dataset doesn't give")
    else: desc.append(f"ordinary naturalisation after {years} years' residence" + (f" ({over[1]}; the dataset's own count is {yrs})" if over else ""))
    if years!='none':
        desc.append({True:"the applicant must give up other citizenships",False:"no renunciation of other citizenships required",None:"whether other citizenships must be given up isn't coded"}[renounce]+(" (with major exceptions)" if b=='2' else ""))
    desc.append({True:"a citizen loses the citizenship on voluntarily taking another"+(" (with exceptions)" if l in ('2','5') else ""),False:"a citizen keeps it on taking another"+(" (loss applies only to naturalised citizens, not modelled)" if l in ('3','6') else ""),None:"whether a citizen keeps it on taking another isn't coded"}[lapses])
    note=(f"GLOBALCIT's Citizenship Law Dataset v3.0 (EUI, 2025), coding the law in force on 1 January 2024 ({'; '.join(arts) if arts else 'no row quoted'}): "
          + '; '.join(desc) + ". Reforms after that date are checked in the file's later sources, where a later source is given.")
    src={"url":URL,"title":f"GLOBALCIT Citizenship Law Dataset v3.0 (Vink, van der Baaren, Bauböck, Dzankic, Honohan, Manby; EUI Research Data, 2025), country-year-mode files, {r['country']}, 2024","read":"2026-10-29","kind":"secondary","quotes":"https://globalcit.eu/national-citizenship-laws/","said":' ... '.join(parts) if parts else f"{r['country']}"}
    d={"country":cc,"years":years,"renounce":renounce,"lapses":lapses,"note":note,"sources":[src]}
    open(OUT+cc+'.json','w').write(json.dumps(d,indent=1,ensure_ascii=False)+'\n')
    n+=1
print(n,'written')
