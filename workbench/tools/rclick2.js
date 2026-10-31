// rclick2.js URL OUT TEXT1 TEXT2 ...: render (honest UA), click each exact text in turn, save body text
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ userAgent: 'SLATE-research/0.1 (playwright)' });
  const r = await p.goto(process.argv[2], { waitUntil: 'networkidle', timeout: 60000 });
  console.error('status', r && r.status());
  for (const a of process.argv.slice(4)) { const [t, n] = a.split("#"); await p.getByText(t, { exact: true }).nth(Number(n || 0)).click(); await p.waitForTimeout(2000); }
  console.error('url', p.url());
  require('fs').writeFileSync(process.argv[3], await p.innerText('body'));
  await b.close();
})();
