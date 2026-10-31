import sys,bs4,re
s=bs4.BeautifulSoup(open(sys.argv[1],'rb').read(),'lxml')
for t in s(['script','style','noscript','nav','header','footer']): t.decompose()
m=s.find('main') or s.find('article') or s
print(re.sub(r'\n\s*\n+','\n',m.get_text('\n'))[:int(sys.argv[2]) if len(sys.argv)>2 else 6000])
