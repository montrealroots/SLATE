// ltdom.js: MIGRIS: open the personal documents group and print the outer HTML around each ID card label
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ userAgent: 'SLATE-research/0.1 (playwright)' });
  await p.goto('https://www.migracija.lt/service/pilieciams', { waitUntil: 'networkidle', timeout: 90000 });
  await p.getByText('Asmens dokumentai', { exact: true }).first().click(); await p.waitForTimeout(3000);
  const html = await p.$$eval('*', ns => ns.filter(n => n.children.length === 0 && /Asmens tapatybės kortelė/.test(n.textContent)).map(n => (n.parentElement?.parentElement?.outerHTML || '').slice(0, 600)));
  console.log(html.join('\n-----\n')); await b.close();
})();
