// expand.js URL OUT PATTERN: render honestly, click each element whose text matches PATTERN (FAQ toggles), save text
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ userAgent: 'SLATE-research/0.1 (playwright)' });
  await p.goto(process.argv[2], { waitUntil: 'networkidle', timeout: 60000 });
  const re = new RegExp(process.argv[4], 'i');
  const els = await p.$$('button, summary, [role=button], h3, h4, h5, .accordion-header, .faq-question, a');
  for (const e of els) { try { const t = await e.innerText(); if (re.test(t) && t.length < 200) { await e.click({ timeout: 2000 }); await p.waitForTimeout(300); } } catch (_) {} }
  require('fs').writeFileSync(process.argv[3], await p.innerText('body'));
  await b.close();
})();
