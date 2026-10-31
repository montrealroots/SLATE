// dlclick.js URL TEXT OUT: render (honest UA), click the first element whose text contains TEXT, save the download to OUT
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ userAgent: 'SLATE-research/0.1 (playwright)', acceptDownloads: true });
  const p = await ctx.newPage();
  await p.goto(process.argv[2], { waitUntil: 'networkidle', timeout: 60000 });
  await p.waitForTimeout(4000);
  const [d] = await Promise.all([p.waitForEvent('download', { timeout: 30000 }), p.getByText(process.argv[3]).first().click()]);
  await d.saveAs(process.argv[4]); console.error('saved', d.suggestedFilename());
  await b.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
