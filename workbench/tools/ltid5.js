// ltid5.js OUT: MIGRIS: open the personal documents group, expand the ID card panel, click the plain ID card service inside it, dump the text
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ userAgent: 'SLATE-research/0.1 (playwright)' });
  await p.goto('https://www.migracija.lt/service/pilieciams', { waitUntil: 'networkidle', timeout: 90000 });
  await p.getByText('Asmens dokumentai', { exact: true }).first().click(); await p.waitForTimeout(2500);
  const panel = p.locator('mat-expansion-panel', { hasText: 'Asmens tapatybės kortelė' }).first();
  await panel.locator('mat-expansion-panel-header').click(); await p.waitForTimeout(2500);
  const items = panel.locator('.mat-expansion-panel-body *', { hasText: /^\s*Asmens tapatybės kortelė\s*$/ });
  console.error('items', await items.count());
  await items.last().click(); await p.waitForTimeout(5000);
  require('fs').writeFileSync(process.argv[2], p.url() + '\n' + await p.innerText('body')); await b.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
