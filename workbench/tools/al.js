// al.js LOC: walk IdentiTek's passport selector for a location, printing every age/status/procedure result
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const p = await b.newPage({ userAgent: 'SLATE-research/0.1 (playwright)' });
  const loc = process.argv[2];
  const open = async () => { await p.goto('https://identitek.al/aplikimet', { waitUntil: 'load', timeout: 60000 }); await p.waitForTimeout(1500);
    await p.click('text=Aplikim për Pasaportë'); await p.waitForTimeout(800); await p.click(`#locationButtons button[data-value="${loc}"]`); await p.waitForTimeout(800); };
  await open();
  const ages = await p.$$eval('#ageButtons button', bs => bs.map(x => x.dataset.value));
  console.log('ages', JSON.stringify(ages));
  for (const age of ages) {
    await open(); await p.click(`#ageButtons button[data-value="${age}"]`); await p.waitForTimeout(800);
    const sts = await p.$$eval('#statusButtons button', bs => bs.map(x => x.dataset.value));
    for (const st of sts) {
      await open(); await p.click(`#ageButtons button[data-value="${age}"]`); await p.waitForTimeout(600);
      await p.click(`#statusButtons button[data-value="${st}"]`); await p.waitForTimeout(600);
      await p.click('#searchButton'); await p.waitForTimeout(1500);
      const procs = await p.$$eval('#procedureButtons button', bs => bs.map(x => x.dataset.value || x.innerText.trim()));
      for (const pr of procs.length ? procs : [null]) {
        if (pr) { await p.click(`#procedureButtons button >> text="${pr}"`).catch(()=>{}); await p.waitForTimeout(1200); }
        const t = await p.innerText('#resultsSection').catch(()=> '');
        console.log(`=== ${loc} | ${age} | ${st} | ${pr}\n${t.replace(/\n+/g,' | ')}`);
      }
    }
  }
  await b.close(); })().catch(e => console.log('ERR', e.message));
