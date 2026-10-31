import { readFileSync } from 'node:fs';
import { compileCountry } from '/home/user/SLATE/tools/money/cards/compile.ts';
for (const cc of process.argv.slice(2)) {
  try { const cards = compileCountry(cc, JSON.parse(readFileSync(`/home/user/SLATE/research/sources/money/cards/${cc}.json`, 'utf8'))); console.log(cc, 'ok', cards.length, cards.map((c) => `${c.bank}: ${c.card}`).join('; ').slice(0, 150)); }
  catch (e) { console.log(cc, 'FAIL', (e as Error).message); }
}
