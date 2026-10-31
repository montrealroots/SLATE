// ltid3.js OUT: MIGRIS: open personal documents, expand every panel header naming the ID card, dump text
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ userAgent: 'SLATE-research/0.1 (playwright)' });
  await p.goto('https://www.migracija.lt/service/pilieciams', { waitUntil: 'networkidle', timeout: 90000 });
  await p.getByText('Asmens dokumentai', { exact: true }).first().click(); await p.waitForTimeout(2500);
  const h = p.locator('mat-expansion-panel-header', { hasText: 'Asmens tapatybės kortelė' });
  const n = await h.count(); console.error('headers', n);
  for (let i = 0; i < n; i++) { try { await h.nth(i).click({ timeout: 5000 }); await p.waitForTimeout(3000); } catch (e) { console.error('skip', i, e.name); } }
  require('fs').writeFileSync(process.argv[2], await p.innerText('body')); await b.close();
})();
