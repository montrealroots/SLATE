// render.js URL OUT: render a page that answers curl 200 but needs JS, honest UA, save text
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ userAgent: 'SLATE-research/0.1 (playwright)' });
  const r = await p.goto(process.argv[2], { waitUntil: 'networkidle', timeout: 60000 });
  console.error('status', r && r.status());
  require('fs').writeFileSync(process.argv[3], await p.innerText('body'));
  await b.close();
})();
