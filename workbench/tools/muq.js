const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('http://muqtafi.birzeit.edu/Legislation/LegSearch.aspx?mid=0', { timeout: 60000 });
  const inputs = await p.$$eval('input,select', es => es.map(e => [e.tagName, e.type, e.name, e.id, e.value].join('|')));
  console.log(inputs.join('\n'));
  await b.close();
})();
