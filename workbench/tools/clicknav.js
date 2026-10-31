// clicknav.js URL TEXT1 TEXT2 OUT: click TEXT1, then TEXT2 (partial text), following a new tab if one opens; save it (honest UA)
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ userAgent: 'SLATE-research/0.1 (playwright)' }); let p = await ctx.newPage();
  await p.goto(process.argv[2], { waitUntil: 'networkidle', timeout: 60000 }).catch(e => console.error(e.message));
  await p.getByText(process.argv[3], { exact: true }).first().click(); await p.waitForTimeout(2000);
  const pop = ctx.waitForEvent('page', { timeout: 8000 }).catch(() => null);
  await p.getByText(process.argv[4]).first().click(); const np = await pop; if (np) p = np;
  await p.waitForLoadState('networkidle').catch(() => {}); await p.waitForTimeout(5000);
  console.log(p.url()); fs.writeFileSync(process.argv[5], await p.content()); await b.close();
})();
