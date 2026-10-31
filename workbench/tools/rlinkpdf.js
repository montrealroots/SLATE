// rlinkpdf.js URL OUT: render a page (honest UA) and save its text plus every link
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ userAgent: 'SLATE-research/0.1 (playwright)' });
  const r = await p.goto(process.argv[2], { waitUntil: 'networkidle', timeout: 60000 });
  console.error('status', r && r.status());
  const links = await p.$$eval('a[href]', as => as.map(a => a.textContent.trim().slice(0,80) + ' | ' + a.href));
  require('fs').writeFileSync(process.argv[3], (await p.innerText('body')) + '\n=====LINKS\n' + links.join('\n'));
  await b.close();
})();
