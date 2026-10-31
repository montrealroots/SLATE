// ltid7.js OUT: as ltid6, then open the validity and age questions and dump the text
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ userAgent: 'SLATE-research/0.1 (playwright)' });
  await p.goto('https://www.migracija.lt/service/pilieciams', { waitUntil: 'networkidle', timeout: 90000 });
  await p.getByText('Asmens dokumentai', { exact: true }).first().click(); await p.waitForTimeout(2500);
  await p.locator('mat-panel-title', { hasText: 'Asmens tapatybės kortelė' }).first().click(); await p.waitForTimeout(2500);
  await p.locator('a.last-item', { has: p.getByText('Asmens tapatybės kortelė', { exact: true }) }).first().click(); await p.waitForTimeout(5000);
  for (const q of ['Asmens tapatybės kortelės galiojimas', 'Asmens dokumento išdavimas ir (ar) keitimas asmenims iki 2 m. amžiaus', 'Asmens dokumento išdavimas ir (ar) keitimas asmenims nuo 2 iki 16 m. amžiaus', 'Asmens dokumento išdavimas ir (ar) keitimas asmenims nuo 16 m. amžiaus', 'Asmens tapatybės kortelės išdavimas ar keitimas skubos tvarka']) {
    await p.getByText(q, { exact: true }).first().click(); await p.waitForTimeout(1500);
  }
  require('fs').writeFileSync(process.argv[2], p.url() + '\n' + await p.innerText('body'));
  require('fs').writeFileSync(process.argv[2] + '.html', await p.content()); await b.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
