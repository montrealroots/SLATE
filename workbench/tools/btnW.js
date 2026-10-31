// btnW.js URL TEXT: render (honest UA), click the element whose text is TEXT, print every URL opened or requested after the click
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ userAgent: 'SLATE-research/0.1 (playwright)', acceptDownloads: true }); const p = await ctx.newPage();
  await p.goto(process.argv[2], { waitUntil: 'networkidle', timeout: 60000 }).catch(e => console.error(e.message));
  ctx.on('request', r => console.log('REQ', r.url())); ctx.on('page', np => console.log('PAGE', np.url()));
  p.on('download', d => console.log('DL', d.url()));
  await p.getByText(process.argv[3], { exact: true }).first().click().catch(e => console.error(e.message));
  await p.waitForTimeout(6000);
  console.log('URL', p.url()); for (const pg of ctx.pages()) console.log('OPEN', pg.url()); await b.close();
})();
