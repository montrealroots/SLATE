// l9b_gh.js: render DVLA Ghana's fees page (honest UA), type a search as a reader would, save the page and the XHRs
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ userAgent: 'SLATE-research/0.1 (playwright)' });
  p.on('response', async (r) => { if (r.url().includes('/api/')) { try { fs.appendFileSync(process.argv[3] + '.api', r.url() + '\n' + (await r.text()) + '\n'); } catch (e) {} } });
  await p.goto('https://dvla.gov.gh/fees-and-charges', { waitUntil: 'networkidle', timeout: 60000 });
  const box = p.locator('input').first(); await box.fill(process.argv[2]); await box.press('Enter');
  await p.waitForTimeout(8000);
  fs.writeFileSync(process.argv[3], await p.content()); await b.close();
})();
