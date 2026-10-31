// rclick.js URL TEXT OUT: render (honest UA), click the element with TEXT, save body text
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ userAgent: 'SLATE-research/0.1 (playwright)' });
  const r = await p.goto(process.argv[2], { waitUntil: 'networkidle', timeout: 60000 });
  console.error('status', r && r.status());
  await p.getByText(process.argv[3], { exact: true }).first().click();
  await p.waitForTimeout(1500);
  require('fs').writeFileSync(process.argv[4], await p.innerText('body'));
  await b.close();
})();
