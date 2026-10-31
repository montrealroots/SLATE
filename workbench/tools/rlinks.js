// rlinks.js URL PATTERN: render (honest UA), print links whose text or href matches PATTERN
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ userAgent: 'SLATE-research/0.1 (playwright)' });
  const r = await p.goto(process.argv[2], { waitUntil: 'networkidle', timeout: 60000 });
  console.error('status', r && r.status());
  const re = new RegExp(process.argv[3], 'i');
  const links = await p.$$eval('a', (as) => as.map((a) => [a.innerText.trim(), a.href]));
  for (const [t, h] of links) if (re.test(t) || re.test(h)) console.log(t.slice(0, 60), '|', h);
  await b.close();
})();
