// pdfget.js URL OUT: fetch a file through the browser (for hosts that refuse curl's TLS/HTTP2 fingerprint), honest UA
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ userAgent: 'SLATE-research/0.1 (playwright)', acceptDownloads: true });
  const p = await ctx.newPage();
  const dl = p.waitForEvent('download', { timeout: 60000 }).catch(() => null);
  let resp = null;
  try { resp = await p.goto(process.argv[2], { timeout: 60000 }); } catch (e) { console.error(e.message.split('\n')[0]); }
  const d = await dl;
  if (d) { await d.saveAs(process.argv[3]); console.log('download saved'); }
  else if (resp) { fs.writeFileSync(process.argv[3], await resp.body()); console.log('body', resp.status()); }
  await b.close();
})();
