// rca.js URL OUT waitMs CAFILE: render with an extra CA bundle (AIA-completed chain), honest UA
const { chromium } = require('playwright'); const fs=require('fs');
(async () => {
  const b = await chromium.launch({ args: [] });
  const ctx = await b.newContext({ userAgent: 'SLATE-research/0.1 (playwright)' });
  const p = await ctx.newPage();
  try { await p.goto(process.argv[2], { waitUntil: 'networkidle', timeout: 60000 }); } catch (e) { console.error(e.message); }
  await p.waitForTimeout(+(process.argv[4]||5000));
  fs.writeFileSync(process.argv[3], await p.content()); await b.close();
})();
