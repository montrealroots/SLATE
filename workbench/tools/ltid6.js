// ltid6.js OUT: MIGRIS: open the personal documents group, expand the ID card panel, click the plain "Asmens tapatybės kortelė" item (a.last-item), dump the text
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ userAgent: 'SLATE-research/0.1 (playwright)' });
  await p.goto('https://www.migracija.lt/service/pilieciams', { waitUntil: 'networkidle', timeout: 90000 });
  await p.getByText('Asmens dokumentai', { exact: true }).first().click(); await p.waitForTimeout(2500);
  await p.locator('mat-panel-title', { hasText: 'Asmens tapatybės kortelė' }).first().click(); await p.waitForTimeout(2500);
  await p.locator('a.last-item', { has: p.getByText('Asmens tapatybės kortelė', { exact: true }) }).first().click(); await p.waitForTimeout(5000);
  require('fs').writeFileSync(process.argv[2], p.url() + '\n' + await p.innerText('body'));
  require('fs').writeFileSync(process.argv[2] + '.html', await p.content()); await b.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
