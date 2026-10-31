// rreq.js URL PATTERN: render (honest UA) and print the URLs of requests matching PATTERN
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ userAgent: 'SLATE-research/0.1 (playwright)' });
  const re = new RegExp(process.argv[3], 'i');
  p.on('request', r => { if (re.test(r.url())) console.log(r.method(), r.url()); });
  await p.goto(process.argv[2], { waitUntil: 'networkidle', timeout: 90000 }).catch(e => console.error(String(e)));
  await p.waitForTimeout(3000);
  await b.close();
})();
