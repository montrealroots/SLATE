// ltid.js OUT: MIGRIS citizens' page, open personal documents, then each item named like the ID card, dumping text after each
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ userAgent: 'SLATE-research/0.1 (playwright)' });
  await p.goto('https://www.migracija.lt/service/pilieciams', { waitUntil: 'networkidle', timeout: 90000 });
  await p.getByText('Asmens dokumentai', { exact: true }).first().click(); await p.waitForTimeout(2500);
  const items = p.getByText('Asmens tapatybės kortelė', { exact: true });
  const n = await items.count(); console.error('items', n);
  let out = '';
  for (let i = 0; i < n; i++) {
    try { if (!(await items.nth(i).isVisible())) continue; await items.nth(i).click({ timeout: 5000 }); await p.waitForTimeout(4000);
      out += `\n===== item ${i} ${p.url()}\n` + await p.innerText('body'); } catch (e) { console.error('skip', i, e.name); }
  }
  require('fs').writeFileSync(process.argv[2], out); await b.close();
})();
