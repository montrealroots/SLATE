import { chromium } from '/home/user/1221/node_modules/playwright/index.mjs';
import { launchOptions } from '/home/user/1221/tools/browser.mjs';
const OUT = process.argv[2];
const browser = await chromium.launch(launchOptions());
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
page.on('console', (m) => { if (/^STEPS/.test(m.text())) console.log(m.text()); });
const wait = (ms) => page.waitForTimeout(ms);
const shot = (n) => page.screenshot({ path: `${OUT}/${n}.png`, fullPage: true });
await page.goto('http://localhost:5199', { waitUntil: 'domcontentloaded' });
await page.evaluate(() => localStorage.clear());
await page.evaluate(() => new Promise((r) => { const q = indexedDB.deleteDatabase('slate'); q.onsuccess = q.onerror = q.onblocked = () => r(); }));
await page.reload({ waitUntil: 'domcontentloaded' });
await page.getByRole('button', { name: /^New Save$/ }).first().waitFor({ timeout: 30000 }); await wait(300);
await page.getByRole('button', { name: /^New Save$/ }).first().click(); await wait(1200);
// Fill Identity so the steps can be walked, and the mock shows chosen values.
await page.getByRole('group', { name: 'Billed As' }).getByRole('button', { name: 'Actress' }).click();
await page.locator('#born-search').fill('New York'); await wait(800);
await page.getByRole('listbox', { name: 'Matching Places' }).getByRole('option').first().click(); await wait(500);
await page.getByRole('button', { name: /^Same As Your Place Of Birth: / }).click(); await wait(400);
// Walk to step 3 to copy the Languages card, then come back.
await page.getByRole('button', { name: /^Continue$/ }).first().click(); await wait(900);
await page.getByRole('button', { name: /^Continue$/ }).first().click(); await wait(900);
const languagesHtml = await page.evaluate(() => [...document.querySelectorAll('.creation .card')].find((c) => c.querySelector('h2')?.textContent === 'Languages').innerHTML);
await page.getByRole('button', { name: /^Back$/ }).first().click(); await wait(600);
await page.getByRole('button', { name: /^Back$/ }).first().click(); await wait(900);

const fixSteps = (active) => page.evaluate((active) => {
  const strip = document.querySelector('.creation-steps');
  const template = strip.querySelector('.creation-step');
  const names = ['Identity', 'Background', 'Genres', 'Starting Point', 'Review'];
  strip.innerHTML = '';
  let seen = false;
  for (const name of names) {
    const el = template.cloneNode(false); el.textContent = name;
    if (name === active) { el.setAttribute('data-state', 'active'); seen = true; } else if (!seen) el.setAttribute('data-state', 'done'); else el.removeAttribute('data-state');
    strip.appendChild(el);
  }
  const p = document.querySelector('.creation .row-between p.muted.small'); if (p) p.textContent = 'SLATE is a life simulator. Here you create the person you’ll play.';
}, active);

// ---- Identity, in the decided order.
await fixSteps('Identity');
await page.evaluate((languagesHtml) => {
  const card = document.querySelector('.creation > .card');
  const kids = () => [...card.children];
  // The School's and the career's sentences go from Billed As and from Race Or Ethnicity.
  for (const el of [...card.querySelectorAll('p, span, div')]) { if (el.children.length) continue; const t = el.textContent; if (/at school you’re cast/.test(t)) el.textContent = 'With They/Them, you choose. Actor and Actress are two words for the same craft, and neither counts for more.'; if (/nothing in the game uses it/.test(t)) el.textContent = 'Choose as many as are true. Leave it blank if you’d rather not say.'; }
  // The age line moves under the birth date.
  const birth = kids().find((k) => k.querySelector && k.querySelector('#birth-year'));
  const age = kids().find((k) => k.classList.contains('callout') && /when you start/.test(k.textContent));
  birth.after(age);
  // Race or Ethnicity moves to the end, after Languages.
  const race = kids().find((k) => k.querySelector && k.querySelector('[aria-label="Race Or Ethnicity"]'));
  const hrBefore = race.previousElementSibling; if (hrBefore && hrBefore.tagName === 'HR') hrBefore.remove();
  race.remove();
  // Languages comes in after Citizenship.
  const cit = kids().find((k) => k.querySelector && k.querySelector('#citizenship'));
  const hr1 = document.createElement('hr'); hr1.className = 'divider';
  const lang = document.createElement('div'); lang.innerHTML = languagesHtml;
  const h2 = lang.querySelector('h2'); if (h2) { const h3 = document.createElement('h3'); h3.textContent = 'Languages'; h2.replaceWith(h3); }
  const lp = lang.querySelector('.panel-head p'); if (lp) lp.textContent = 'The languages you speak, and how well.';
  const hr2 = document.createElement('hr'); hr2.className = 'divider';
  cit.after(hr1, lang, hr2, race);
  // The step's needs list loses the Billed As line.
}, languagesHtml);
await page.evaluate(() => { for (const p of document.querySelectorAll('.creation .panel-head p')) if (/before Yale/.test(p.textContent)) p.textContent = 'Where you were born, which isn’t always where you live now. It’s what you tell people when they ask. It doesn’t decide your citizenship: you say that yourself.'; });
console.log('strip', await page.evaluate(() => [...document.querySelectorAll('.creation-step')].map((s) => s.textContent.trim() + ':' + (s.getAttribute('data-state') || '-')).join(' | ')));
await wait(300); await shot('02-identity-new');
const pickerHtml = await page.evaluate(() => { const card = document.querySelector('.creation > .card'); const kids = [...card.children]; const start = kids.findIndex((k) => /Place Of Birth/.test(k.textContent) && k.classList.contains('panel-head')); const end = kids.findIndex((k) => k.querySelector && k.querySelector('#citizenship')); return kids.slice(start + 1, end).map((k) => k.outerHTML).join(''); });

// ---- Background, three cards.
await page.getByRole('button', { name: /^Continue$/ }).first().click(); await wait(900);
await page.getByRole('button', { name: /^Continue$/ }).first().click(); await wait(900);
await fixSteps('Background');
const genresHtml = await page.evaluate(() => [...document.querySelectorAll('.creation .col.gap-5 > .card')].find((c) => c.querySelector('h2')?.textContent === 'Genres').outerHTML);
await page.evaluate(() => {
  const col = document.querySelector('.creation .col.gap-5');
  const cards = [...col.querySelectorAll(':scope > .card')];
  const byH2 = (t) => cards.find((c) => c.querySelector('h2')?.textContent === t);
  byH2('Genres')?.remove(); byH2('Background')?.remove(); byH2('Languages')?.remove();
  const fam = byH2('Your Family');
  fam.querySelector('h2').textContent = 'The Family You Were Born Into';
  fam.querySelector('.panel-head p').textContent = 'The family you come from decides the money in your name on the first morning.';
  const ps = fam.querySelectorAll('.callout p'); if (ps[1]) ps[1].remove();
  // What your family did.
  const did = fam.cloneNode(true);
  did.querySelector('h2').textContent = 'What Your Family Did';
  did.querySelector('.panel-head p').textContent = 'The work your family lived by.';
  did.querySelector('label').textContent = 'Their Work'; did.querySelector('label').htmlFor = 'family-did';
  const sel = did.querySelector('select'); sel.id = 'family-did'; sel.innerHTML = '';
  for (const o of ['Choose', 'Farming or fishing', 'A trade', 'A shop or a restaurant', 'An office', 'Teaching', 'Medicine or nursing', 'The law', 'The arts', 'Public service', 'The military', 'Nothing steady']) { const e = document.createElement('option'); e.textContent = o; sel.appendChild(e); }
  did.querySelector('.callout')?.remove();
  // Where you grew up.
  const grew = fam.cloneNode(true);
  grew.querySelector('h2').textContent = 'Where You Grew Up';
  grew.querySelector('.panel-head p').textContent = 'Where you spent the years that gave you your accent, if that isn’t where you were born.';
  grew.querySelector('.field').remove(); grew.querySelector('.callout')?.remove();
  const row = document.createElement('div'); row.className = 'row gap-2';
  const b1 = document.createElement('button'); b1.className = 'btn btn-primary'; b1.textContent = 'Same As Where You Were Born: New York';
  const b2 = document.createElement('button'); b2.className = 'btn'; b2.textContent = 'Somewhere Else';
  row.append(b1, b2); grew.append(row);
  col.append(did, grew);
});
console.log('strip', await page.evaluate(() => [...document.querySelectorAll('.creation-step')].map((s) => s.textContent.trim() + ':' + (s.getAttribute('data-state') || '-')).join(' | ')));
await wait(300); await shot('03-background-new');
await page.evaluate((pickerHtml) => { const cards = [...document.querySelectorAll('.creation .col.gap-5 > .card')]; const grew = cards.find((c) => /Where You Grew Up/.test(c.querySelector('h2')?.textContent || '')); const [b1, b2] = grew.querySelectorAll('.row.gap-2 button'); b1.className = 'btn'; b2.className = 'btn btn-primary'; const wrap = document.createElement('div'); wrap.className = 'col gap-3'; wrap.style.marginTop = 'var(--s4)'; wrap.innerHTML = pickerHtml; const bar = wrap.querySelector('.worldmap-readout'); if (bar) bar.textContent = 'United States · 17,342 places'; const search = wrap.querySelector('input'); if (search) { search.placeholder = 'Start typing a town name'; search.value = ''; } const results = wrap.querySelector('.picker-results'); if (results) results.remove(); for (const sel of wrap.querySelectorAll('select')) { const o = [...sel.options].find((x) => /United States|Anywhere In The United States/.test(x.textContent)); if (o) o.selected = true; } grew.append(wrap); }, pickerHtml);
await wait(300); await shot('03b-background-somewhere-else');
// ---- Genres, step 3: every genre, no dot (a genre with nothing to read it isn't offered in the new build).
await fixSteps('Genres');
await page.evaluate((genresHtml) => { const col = document.querySelector('.creation .col.gap-5'); col.innerHTML = genresHtml; for (const chip of col.querySelectorAll('.chip')) chip.textContent = chip.textContent.replace(/\s*·\s*$/, ''); const p = col.querySelector('.panel-head p'); if (p) p.textContent = 'The genres you love. Pick as many as are true.'; }, genresHtml);
await wait(300); await shot('04-genres-new');
// ---- Starting Point: Your Money alone.
await page.getByRole('button', { name: /^Continue$/ }).first().click(); await wait(900);
await fixSteps('Starting Point');
await page.evaluate(() => { const col = document.querySelector('.creation .col.gap-5'); for (const c of [...col.querySelectorAll(':scope > .card')]) if (!/Your Money/.test(c.querySelector('h2')?.textContent || '')) c.remove(); const money = col.querySelector('.card'); money.querySelector('.callout')?.remove(); });
await wait(300); await shot('05-starting-point-new');

// ---- Review, re-formed around the kept steps.
await page.getByRole('button', { name: /^Continue$/ }).first().click(); await wait(900);
await fixSteps('Review');
await page.evaluate(() => {
  const cards = [...document.querySelectorAll('.creation .card')];
  const byEyebrow = (t) => cards.find((c) => c.querySelector('.eyebrow')?.textContent.trim().toUpperCase() === t.toUpperCase());
  const lines = (card) => [...card.querySelectorAll('.review-line, .row-between, .line')].filter((l) => l.children.length >= 2);
  const lineOf = (card, label) => lines(card).find((l) => l.firstElementChild.textContent.trim() === label);
  // The top line: home is open; the mock shows the birthplace.
  for (const el of document.querySelectorAll('.creation .card *')) if (el.children.length === 0 && /New Haven/.test(el.textContent)) el.textContent = el.textContent.replace('New Haven', 'New York');
  const identity = byEyebrow('Identity'), start = byEyebrow('Starting Point'), disp = byEyebrow('Dispositions & Traits'), gb = byEyebrow('Genres & Background'), guide = byEyebrow('The Guide');
  disp?.remove();
  // Starting Point keeps the money only.
  for (const label of ['School', 'Where You Live', 'Food Each Month']) lineOf(start, label)?.remove();
  start.querySelector('.eyebrow').textContent = 'Money';
  // Identity: languages after citizenship, race last.
  const race = lineOf(identity, 'Race Or Ethnicity'); const langs = lineOf(gb, 'Languages'); const cit = lineOf(identity, 'Citizenship');
  if (cit && langs) cit.after(langs); if (race) identity.append(race);
  // Background and Genres as their own cards, from the old joint card.
  const bg = gb; bg.querySelector('.eyebrow').textContent = 'Background';
  const genres = lineOf(bg, 'Genres'); lineOf(bg, 'In Your Own Words')?.remove();
  const fam = lineOf(bg, 'Family'); if (fam) fam.lastElementChild.textContent = 'Wealthy';
  const did = fam.cloneNode(true); did.firstElementChild.textContent = 'What Your Family Did'; did.lastElementChild.textContent = '—';
  const grew = fam.cloneNode(true); grew.firstElementChild.textContent = 'Where You Grew Up'; grew.lastElementChild.textContent = 'New York, United States';
  fam.after(did, grew);
  guide?.remove();
  const gcard = bg.cloneNode(false); const eb = bg.querySelector('.eyebrow').cloneNode(true); eb.textContent = 'Genres'; gcard.append(eb, genres); bg.after(gcard);
});
await wait(300); await shot('06-review-new');
await page.getByRole('button', { name: /^Begin$/ }).click();
await page.getByRole('group', { name: 'Time Controls' }).first().waitFor({ timeout: 30000 }); await wait(3000);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.getByRole('button', { name: /^Continue$/ }).first().waitFor({ timeout: 30000 }); await wait(600);
await page.evaluate(() => { const t = document.querySelector('.slot .muted.small'); if (t) t.textContent = '24 · New York'; for (const st of document.querySelectorAll('.slot .stat')) if (/Location/.test(st.textContent)) st.querySelector('.small').textContent = 'New York'; });
await shot('01-slots-new');
await browser.close();
