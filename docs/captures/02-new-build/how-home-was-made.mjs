import { chromium } from '/home/user/1221/node_modules/playwright/index.mjs';
import { launchOptions } from '/home/user/1221/tools/browser.mjs';
const OUT = process.argv[2];
const browser = await chromium.launch(launchOptions());
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
const wait = (ms) => page.waitForTimeout(ms);
const shot = (n) => page.screenshot({ path: `${OUT}/${n}.png`, fullPage: true });
await page.goto('http://localhost:5199', { waitUntil: 'domcontentloaded' });
await page.evaluate(() => localStorage.clear());
await page.evaluate(() => new Promise((r) => { const q = indexedDB.deleteDatabase('slate'); q.onsuccess = q.onerror = q.onblocked = () => r(); }));
await page.reload({ waitUntil: 'domcontentloaded' });
await page.getByRole('button', { name: /^New Save$/ }).first().waitFor({ timeout: 30000 }); await wait(300);
await page.getByRole('button', { name: /^New Save$/ }).first().click(); await wait(1200);
await page.getByRole('group', { name: 'Billed As' }).getByRole('button', { name: 'Actress' }).click();
await page.locator('#born-search').fill('New York'); await wait(800);
await page.getByRole('listbox', { name: 'Matching Places' }).getByRole('option').first().click(); await wait(500);
await page.getByRole('button', { name: /^Same As Your Place Of Birth: / }).click(); await wait(400);
for (let i = 0; i < 4; i += 1) { await page.getByRole('button', { name: /^Continue$/ }).first().click(); await wait(900); }
await page.getByText(/I Know SLATE/).first().click(); await wait(300);
await page.getByRole('button', { name: /^Begin$/ }).click();
await page.getByRole('group', { name: 'Time Controls' }).first().waitFor({ timeout: 30000 }); await wait(2500);
await shot('07-home-no-tutorial');
await page.evaluate(() => {
  const gone = (el) => el && el.remove();
  // The menu: School and Career go with their groups.
  for (const el of document.querySelectorAll('#rail *, nav *, aside *')) {
    if (el.children.length === 0 && /^(Your Training|Your Work|School|Career)$/.test(el.textContent.trim())) { const row = el.closest('li, a, button, div'); gone(row); }
  }
  // Home: the town is open; the mock shows the birthplace.
  for (const el of document.querySelectorAll('main *, .main *')) if (el.children.length === 0 && /^(New Haven|Connecticut)$/.test(el.textContent.trim())) el.textContent = 'New York';
  // Up Next: the term's events go; nothing is on the calendar yet.
  const panels = [...document.querySelectorAll('main .panel, .main .panel, main section, .main section, main .card, .main .card')];
  const byTitle = (t) => panels.find((p) => (p.querySelector('h2, h3')?.textContent || '').trim() === t);
  const up = byTitle('Up Next');
  if (up) { for (const el of [...up.querySelectorAll('*')]) { if (el.children.length === 0 && /Registration|Fall Term|Meeting|Building|Courses|in \d+[hd]|August 24, 2026 at/.test(el.textContent)) { const row = el.closest('li, a, .row-between, div'); if (row && row !== up) row.remove(); } } const what = up.querySelector('p'); if (what) what.textContent = 'Nothing on the calendar yet.'; }
  // Recent Updates: the School's welcome goes.
  const ru = byTitle('Recent Updates');
  if (ru) { for (const el of [...ru.querySelectorAll('*')]) if (el.children.length === 0 && /Welcome To The Class|School · now|16 actors|Mark 1 Read|Go There|Mark Read/.test(el.textContent)) { const row = el.closest('li, article, .row-between, div'); if (row && row !== ru) row.remove(); } const p = ru.querySelector('p'); if (p) p.textContent = 'Nothing yet.'; }
  // How You Are: readiness went with the attributes.
  const hya = byTitle('How You Are');
  if (hya) { const bar = hya.querySelector('[role=meter][aria-label="Readiness"]'); if (bar) bar.parentElement.remove(); for (const el of [...hya.querySelectorAll('*')]) if (el.children.length === 0 && /costing readiness/.test(el.textContent)) el.textContent = 'Nourishment at 75.'; }
});
await page.evaluate(() => {
  const panels = [...document.querySelectorAll('main .panel, .main .panel, main section, .main section, main .card, .main .card')];
  const hya = panels.find((p) => (p.querySelector('h2, h3')?.textContent || '').trim() === 'How You Are'); if (hya) hya.remove();
  for (const b of document.querySelectorAll('header button, .topbar button, [role=group] button, nav button, button')) if (/^Look After Yourself/.test(b.textContent.trim())) { const wrap = b.closest('[role=group], .row, div'); (wrap && wrap.children.length <= 2 ? wrap : b).remove(); }
});
await page.evaluate(() => { for (const el of [...document.querySelectorAll('button, a')]) if (/^How .* Works?$|^How This Works$|^Guide$/.test(el.textContent.trim())) el.remove(); });
await wait(300); await shot('07-home-new');
// Close the guide if it's open, to see Home itself.
const dialog = page.locator('[role=dialog]');
if (await dialog.count()) { await page.keyboard.press('Escape'); await wait(500); }
console.log('guide-ish', await page.evaluate(() => [...document.querySelectorAll('button, a')].map((b) => b.textContent.trim()).filter((t) => /Guide|How .* Works|Read/.test(t)).join(' | ')));
console.log(JSON.stringify({ dialogs: await page.locator('[role=dialog]').count(), url: page.url() }));
await browser.close();
