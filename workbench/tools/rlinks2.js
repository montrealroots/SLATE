// rlinks2.js URL: render and print links with their text
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const p = await b.newPage({ userAgent: 'SLATE-research/0.1 (playwright)' });
  await p.goto(process.argv[2], { waitUntil: process.env.WAIT || 'networkidle', timeout: 60000 });
  for (const a of await p.$$eval('a', as => as.map(a => a.innerText.trim().slice(0,80) + ' | ' + a.href))) console.log(a);
  await b.close(); })();
