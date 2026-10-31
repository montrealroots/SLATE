// rall.js URL OUT: render (honest UA), open every <details>/accordion button, save body text
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ userAgent: 'SLATE-research/0.1 (playwright)' });
  const r = await p.goto(process.argv[2], { waitUntil: process.env.WAIT || 'networkidle', timeout: 60000 }); console.error('status', r && r.status());
  await p.$$eval('details', ds => ds.forEach(d => d.open = true));
  for (const btn of await p.$$('button[aria-expanded="false"]')) { try { await btn.click({ timeout: 2000 }); } catch (e) {} }
  await p.waitForTimeout(1500);
  require('fs').writeFileSync(process.argv[3], await p.innerText('body')); await b.close();
})();
