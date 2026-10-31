import sys,re,html,unicodedata,subprocess
def text(path):
    if b'%PDF-' in open(path,'rb').read(4096):
        s=subprocess.run(['pdftotext','-layout',path,'-'],capture_output=True,text=True).stdout+'\n'+subprocess.run(['pdftotext',path,'-'],capture_output=True,text=True).stdout
    else:
        s=open(path,encoding='utf-8',errors='replace').read()
        if '<' in s[:3000]:
            s=re.sub(r'<script.*?</script>|<style.*?</style>','',s,flags=re.S); s=html.unescape(re.sub(r'<[^>]+>',' ',s))
    return unicodedata.normalize('NFC',re.sub(r'\s+',' ',re.sub(r'-\n(?=\w)','',s.replace('­',''))))
t=text(sys.argv[1]); w=int(sys.argv[3]) if len(sys.argv)>3 else 300
for m in list(re.finditer(sys.argv[2],t))[:int(sys.argv[4]) if len(sys.argv)>4 else 5]: print('>>',t[max(0,m.start()-w//3):m.start()+w])
