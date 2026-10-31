// pdfjs-text.js URL OUT: render a page holding a pdf.js viewer (honest UA) and save the PDF's text, page by page
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ userAgent: 'SLATE-research/0.1 (playwright)' });
  await p.goto(process.argv[2], { waitUntil: 'networkidle', timeout: 120000 }).catch(e => console.error(String(e)));
  await p.waitForFunction(() => window.PDFViewerApplication && window.PDFViewerApplication.pdfDocument, null, { timeout: 120000 });
  const text = await p.evaluate(async () => {
    const d = window.PDFViewerApplication.pdfDocument; const out = [];
    for (let i = 1; i <= d.numPages; i++) { const c = await (await d.getPage(i)).getTextContent(); out.push('=== page ' + i + '\n' + c.items.map(x => x.str).join(' ')); }
    return out.join('\n');
  });
  require('fs').writeFileSync(process.argv[3], text);
  await b.close();
})();
