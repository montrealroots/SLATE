// ltid2.js OUT: MIGRIS citizens' page: list the personal-documents items, click each ID card one, dump text
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ userAgent: 'SLATE-research/0.1 (playwright)' });
  await p.goto('https://www.migracija.lt/service/pilieciams', { waitUntil: 'networkidle', timeout: 90000 });
  await p.getByText('Asmens dokumentai', { exact: true }).first().click(); await p.waitForTimeout(2500);
  const els = await p.$$('a, button, li, [role=button]');
  let out = '';
  for (const e of els) {
    const t = (await e.innerText().catch(() => '')).trim();
    if (!/^Asmens tapatybės kortelė/.test(t) || !(await e.isVisible())) continue;
    const tag = await e.evaluate(n => n.tagName + ' ' + (n.getAttribute('href') || '') + ' ' + n.className);
    console.error('el', tag, '|', t.slice(0, 60));
  }
  const li = p.locator('li', { hasText: /^Asmens tapatybės kortelė$/ });
  console.error('li', await li.count());
  for (let i = 0; i < await li.count(); i++) {
    try { await li.nth(i).click({ timeout: 5000 }); await p.waitForTimeout(4000); out += `\n===== li ${i}\n` + await p.innerText('body'); } catch (e) { console.error('skip', i, e.name); }
  }
  require('fs').writeFileSync(process.argv[2], out); await b.close();
})();
