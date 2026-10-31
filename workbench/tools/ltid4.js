// ltid4.js OUT: MIGRIS: after expanding the ID card panel, click every visible leaf element whose own text is exactly the ID card's name, dump text after each
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ userAgent: 'SLATE-research/0.1 (playwright)' });
  await p.goto('https://www.migracija.lt/service/pilieciams', { waitUntil: 'networkidle', timeout: 90000 });
  await p.getByText('Asmens dokumentai', { exact: true }).first().click(); await p.waitForTimeout(2500);
  await p.locator('mat-expansion-panel-header', { hasText: 'Asmens tapatybės kortelė' }).first().click(); await p.waitForTimeout(2500);
  const leaves = await p.$$eval('*', ns => ns.filter(n => n.children.length === 0 && n.textContent.trim() === 'Asmens tapatybės kortelė').map(n => { const r = n.getBoundingClientRect(); return [n.tagName, n.className, r.x, r.y, r.width]; }));
  console.error(JSON.stringify(leaves));
  let out = '';
  for (const [tag, cls, x, y, w] of leaves) { if (!w) continue; await p.mouse.click(x + 5, y + 5); await p.waitForTimeout(4000); out += `\n===== ${tag} ${cls} ${p.url()}\n` + await p.innerText('body'); }
  require('fs').writeFileSync(process.argv[2], out); await b.close();
})();
