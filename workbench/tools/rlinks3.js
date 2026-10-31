// rlinks3.js URL [waitMs]: render (honest UA) and print every link's href and text
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ userAgent: 'SLATE-research/0.1 (playwright)' });
  await p.goto(process.argv[2], { waitUntil: 'networkidle', timeout: 90000 });
  await p.waitForTimeout(Number(process.argv[3] || 4000));
  for (const [h, t] of await p.$$eval('a', as => as.map(a => [a.href, a.innerText.trim().slice(0, 90)]))) console.log(h, '|', t);
  await b.close();
})();
