// clicktext.js URL TEXT OUT waitMs: open a page, click the first element whose text is TEXT (as a reader would), save the result
const { chromium } = require('playwright'); const fs=require('fs');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ userAgent: 'SLATE-research/0.1 (playwright)' });
  await p.goto(process.argv[2], { waitUntil: 'networkidle', timeout: 60000 });
  await p.getByText(process.argv[3], { exact: true }).first().click();
  await p.waitForTimeout(+(process.argv[5]||4000));
  fs.writeFileSync(process.argv[4], await p.content()); console.log(p.url()); await b.close();
})();
