// clickdl.js URL SELECTOR OUT: render URL, click SELECTOR, save the download it starts (honest UA)
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ userAgent: 'SLATE-research/0.1 (playwright)', acceptDownloads: true });
  const p = await ctx.newPage();
  await p.goto(process.argv[2], { waitUntil: 'networkidle', timeout: 60000 }).catch(e => console.error(e.message));
  const [d] = await Promise.all([p.waitForEvent('download', { timeout: 60000 }), p.click(process.argv[3])]);
  await d.saveAs(process.argv[4]); console.log('saved', d.suggestedFilename()); await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
