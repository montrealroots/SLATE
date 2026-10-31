#!/usr/bin/env python3
# scan.py NAME HOME LINKRE TEXTRE: fetch HOME, follow its own same-host links whose URL or text matches LINKRE (max 40),
# count TEXTRE matches in each page's text; pages saved in pp/NAME/. Honest UA; reads only what the site links to.
import re,html,sys,subprocess,os,urllib.parse
S='/tmp/claude-0/-home-user-SLATE/c8b0b159-b4a5-540a-bbd6-18661cbe240c/scratchpad'
name,home,linkre,textre=sys.argv[1:5]; d=f'{S}/pp/{name}'; os.makedirs(d,exist_ok=True)
def get(u,f):
    subprocess.run(['curl','-sSL','-m','25','-A','SLATE-research/0.1 (curl)','-o',f,u],capture_output=True)
    try: return open(f,encoding='utf-8',errors='replace').read()
    except: return ''
def text(s):
    t=re.sub(r'<script.*?</script>|<style.*?</style>','',s,flags=re.S); return re.sub(r'\s+',' ',html.unescape(re.sub(r'<[^>]+>',' ',t)))
h=get(home,f'{d}/home.html'); host=urllib.parse.urlparse(home).netloc
links={}
for m in re.finditer(r'<a[^>]+href="([^"#]+)"[^>]*>(.*?)</a>',h,re.S):
    u=urllib.parse.urljoin(home,html.unescape(m.group(1))); t=text(m.group(2)).strip()
    if urllib.parse.urlparse(u).netloc==host and (re.search(linkre,u,re.I) or re.search(linkre,t,re.I)): links.setdefault(u,t)
for i,(u,t) in enumerate(list(links.items())[:40]):
    s=get(u,f'{d}/{i}.html'); n=len(re.findall(textre,text(s)))
    print(i,n,t[:50],'|',u)
