// render2.js URL OUT [waitMs]: like render.js, but waits for the page's content to settle after network idle
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ userAgent: 'SLATE-research/0.1 (playwright)' });
  const r = await p.goto(process.argv[2], { waitUntil: 'networkidle', timeout: 90000 });
  await p.waitForTimeout(Number(process.argv[4] || 8000));
  console.log('status', r.status());
  require('fs').writeFileSync(process.argv[3], await p.innerText('body'));
  await b.close();
})();
