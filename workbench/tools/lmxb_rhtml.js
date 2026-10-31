// lmxb_rhtml.js URL OUT: render (honest UA), save the whole DOM as HTML (hidden accordion text included)
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ userAgent: 'SLATE-research/0.1 (playwright)' });
  const r = await p.goto(process.argv[2], { waitUntil: 'networkidle', timeout: 90000 });
  await p.waitForTimeout(4000);
  console.error('status', r && r.status());
  require('fs').writeFileSync(process.argv[3], await p.content());
  await b.close();
})();
