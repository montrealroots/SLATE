#!/bin/bash
# wiki.sh CC "Title_of_article": fetch the Wikipedia visa-policy article to dl/<cc>_wiki and its sup-less text to dl/<cc>_wiki.txt; print the ordinary-passport section
S=/tmp/claude-0/-home-user-SLATE/c8b0b159-b4a5-540a-bbd6-18661cbe240c/scratchpad
cc=$(echo $1 | tr A-Z a-z)
T=60 $S/bin/get "https://en.wikipedia.org/wiki/$2" ${cc}_wiki >/dev/null 2>&1
python3 -I -c "
import bs4,re,sys
s=bs4.BeautifulSoup(open(sys.argv[1],'rb').read(),'lxml')
for t in s(['script','style','noscript','sup']): t.decompose()
t=re.sub(r'\s+',' ',s.get_text(' ')); open(sys.argv[1]+'.txt','w').write(t)
k=[m.start() for m in re.finditer(r'\[ edit \]',t)]
i=t.find('Visa exemption [ edit ]'); i=i if i>=0 else (k[0] if k else 0)
print(t[i:i+int(sys.argv[2])])" $S/dl/${cc}_wiki ${3:-5000}
