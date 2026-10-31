// shot.js URL out.png [waitms]: screenshot a page with an honest UA
const { chromium } = require('playwright');
(async () => {
  const [url, out, wait] = process.argv.slice(2);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1400, height: 2000 } });
  const r = await p.goto(url, { waitUntil: 'networkidle', timeout: 90000 }).catch(e => null);
  await p.waitForTimeout(+wait || 5000);
  // collect image URLs on the page
  const imgs = await p.$$eval('img', xs => xs.map(x => x.src).filter(s => s.includes('isu.pub')));
  console.log('status', r && r.status(), imgs.slice(0, 20).join('\n'));
  await p.screenshot({ path: out, fullPage: false });
  await b.close();
})();
