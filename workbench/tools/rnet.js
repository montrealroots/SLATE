// rnet.js URL: render (honest UA), print JSON/XHR request URLs the page makes
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ userAgent: 'SLATE-research/0.1 (playwright)' });
  p.on('request', (r) => { if (['xhr', 'fetch'].includes(r.resourceType())) console.log(r.method(), r.url()); });
  await p.goto(process.argv[2], { waitUntil: 'networkidle', timeout: 60000 }).catch((e) => console.error(String(e)));
  await b.close();
})();
