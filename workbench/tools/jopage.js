// jopage.js: walk the CSPD services guide's pages by its own pager links and print each entry's title and link
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ userAgent: 'SLATE-research/0.1 (playwright)' });
  await p.goto('https://www.cspd.gov.jo/EN/List/Services__Guide', { waitUntil: 'networkidle', timeout: 60000 });
  for (let n = 1; n <= 12; n++) {
    const rows = await p.$$eval('a[href*="ListDetails"]', as => as.map(a => { let e=a; for (let i=0;i<4 && e.parentElement && e.innerText.length<40;i++) e=e.parentElement; return a.getAttribute('href') + ' | ' + e.innerText.replace(/\s+/g,' ').slice(0,100); }));
    rows.forEach(r => console.log(n, r));
    const next = await p.$(`a:text-is("${n+1}")`);
    if (!next) break;
    await Promise.all([p.waitForLoadState('networkidle'), next.click()]); await p.waitForTimeout(1500);
  }
  await b.close();
})();
