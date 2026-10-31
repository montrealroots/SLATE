// clickget.js URL TEXT OUT: render URL, click the element whose text is exactly TEXT, save the resulting page (honest UA)
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ userAgent: 'SLATE-research/0.1 (playwright)' });
  await p.goto(process.argv[2], { waitUntil: 'networkidle', timeout: 60000 }).catch(e => console.error(e.message));
  await p.getByText(process.argv[3], { exact: true }).first().click();
  await p.waitForTimeout(5000);
  console.log(p.url()); fs.writeFileSync(process.argv[4], await p.content()); await b.close();
})();
