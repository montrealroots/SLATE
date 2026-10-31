// rhref.js URL TEXT: render (honest UA) and print the href of the link whose text is TEXT
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const p = await b.newPage({ userAgent: 'SLATE-research/0.1 (playwright)' });
  await p.goto(process.argv[2], { waitUntil: 'networkidle', timeout: 60000 });
  const hs = await p.$$eval('a', (as, t) => as.filter(a => a.innerText.trim() === t).map(a => a.href), process.argv[3]);
  console.log(hs.join('\n')); await b.close(); })();
