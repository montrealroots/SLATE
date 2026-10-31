// l9b_xk.js URL OUT: render (honest UA), click the act's document link (a postback), save what opens (page or download)
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ userAgent: 'SLATE-research/0.1 (playwright)', acceptDownloads: true }); const p = await ctx.newPage();
  await p.goto(process.argv[2], { waitUntil: 'networkidle', timeout: 60000 });
  const dl = p.waitForEvent('download', { timeout: 30000 }).catch(() => null);
  const pop = ctx.waitForEvent('page', { timeout: 30000 }).catch(() => null);
  await p.locator('[id*="lblAn"]').first().click();
  const d = await Promise.race([dl, pop, p.waitForTimeout(25000).then(() => null)]);
  if (d && d.saveAs) { await d.saveAs(process.argv[3]); console.log('download', d.url()); }
  else if (d && d.url) { await d.waitForLoadState('networkidle').catch(()=>{}); console.log('popup', d.url()); fs.writeFileSync(process.argv[3], await d.content()); }
  else { console.log('same', p.url()); fs.writeFileSync(process.argv[3], await p.content()); }
  await b.close();
})();
