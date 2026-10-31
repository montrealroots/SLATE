// chk.ts ENGINE KEY...: compile each research file of an engine (papers/numbers, papers/residence, papers/licence,
// papers/passports, papers/ids, papers/citizenship, money/banks, money/formats, money/means, money/cards) as its read does.
import { readFileSync } from 'node:fs';
const [engine, ...keys] = process.argv.slice(2);
const m = await import(`/home/user/SLATE/tools/${engine}/compile.ts`);
const numbers = await import('/home/user/SLATE/tools/papers/numbers/compile.ts');
const pick = (key: string, f: Record<string, unknown>): unknown => {
  switch (engine) {
    case 'papers/numbers': return 'issuedBy' in f ? m.compileIssued(key, f, 'numbers') : 'none' in f ? m.compileNone(key, f) : m.compileNumber(key, f);
    case 'papers/residence': return 'issuedBy' in f ? numbers.compileIssued(key, f, 'permits') : m.compileResidence(key, f);
    case 'papers/licence': return m.compileLicence(key, f);
    case 'papers/passports': return 'issuedBy' in f ? m.compileIssued(key, f) : m.compilePassport(key, f);
    case 'papers/ids': return 'issuedBy' in f ? m.compileIssued(key, f) : 'none' in f ? m.compileNone(key, f) : m.compileCard(key, f);
    case 'papers/citizenship': return 'nationalityOf' in f ? m.compileOf(key, f) : m.compileState(key, f);
    case 'papers/ages': return m.compileAges(key, f);
    default: return m.compileCountry(key, f);
  }
};
for (const key of keys) {
  try { const out = pick(key, JSON.parse(readFileSync(`/home/user/SLATE/research/sources/${engine}/${key}.json`, 'utf8')) as Record<string, unknown>); console.log(key, 'ok', JSON.stringify(out).slice(0, 160)); }
  catch (e) { console.log(key, 'FAIL', (e as Error).message); }
}
