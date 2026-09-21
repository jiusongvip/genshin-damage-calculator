// ============================================================================
// Sync src/data/characters.ts base stats + ascension with genshin-db.
//
// characters.ts is hand-maintained (it carries notes, skill names, weapon and
// artifact picks), so this script only rewrites four numeric fields per entry
// and leaves everything else untouched:
//
//   baseHP / baseATK / baseDEF   -> the level-90 curve value, so they agree
//                                   with levelStats.ts by construction
//   ascension.type               -> the real FIGHT_PROP_* mapping
//   ascension.value              -> the RAW ascension value (i.e. curve.spec
//                                   at level 90), NOT the bonus-only figure
//
// The ascension-value convention matters. lib/damage.ts does
//   statBag({ type, value: curve.spec - bakedBase })
// where bakedBase is 0.05 for CRIT Rate and 0.5 for CRIT DMG. That only works
// if `value` and `curve.spec` use the same convention. Before this script the
// file mixed three: CRIT DMG entries sometimes carried the raw total (0.884)
// and sometimes the bonus alone (0.384); CRIT Rate entries mostly carried the
// bonus (0.192) but a handful carried the raw total rounded (0.24); and Lauma
// carried 315 EM where the dataset says 115.2. `value` is only a fallback when
// a level curve is missing, so none of it changed a number on screen — but it
// was a landmine for anyone who trusted it.
//
// Run: node scripts/sync-character-stats.mjs            (writes the file)
//      node scripts/sync-character-stats.mjs --dry-run  (prints the diff only)
// ============================================================================

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const FILE = join(root, 'src/data/characters.ts');
const dryRun = process.argv.includes('--dry-run');

const truth = JSON.parse(readFileSync(join(root, '.audit/ascension-truth.json'), 'utf8'));
const byId = new Map(truth.map((r) => [r.id, r]));

const r4 = (n) => Math.round(n * 1e4) / 1e4;
const r6 = (n) => Math.round(n * 1e6) / 1e6;

const lines = readFileSync(FILE, 'utf8').split('\n');
const changes = [];
let rewritten = 0;

const out = lines.map((line) => {
  const idMatch = line.match(/^\s*\{ id: '([^']+)',/);
  if (!idMatch) return line;
  const id = idMatch[1];
  const t = byId.get(id);
  if (!t) {
    changes.push(`${id}: NO TRUTH — left alone`);
    return line;
  }

  const before = {
    hp: line.match(/baseHP: ([\d.]+)/)?.[1],
    atk: line.match(/baseATK: ([\d.]+)/)?.[1],
    def: line.match(/baseDEF: ([\d.]+)/)?.[1],
    type: line.match(/ascension: \{ type: '([\w%]+)'/)?.[1],
    value: line.match(/ascension: \{ type: '[\w%]+', value: ([\d.]+) \}/)?.[1],
  };
  if (before.hp === undefined || before.type === undefined) {
    changes.push(`${id}: fields not in the expected shape — left alone`);
    return line;
  }

  let next = line
    .replace(/baseHP: [\d.]+/, `baseHP: ${r4(t.hp90)}`)
    .replace(/baseATK: [\d.]+/, `baseATK: ${r4(t.atk90)}`)
    .replace(/baseDEF: [\d.]+/, `baseDEF: ${r4(t.def90)}`)
    .replace(/ascension: \{ type: '[\w%]+'/, `ascension: { type: '${t.type}'`)
    .replace(/(ascension: \{ type: '[\w%]+', value: )[\d.]+/, `$1${r6(t.value)}`);

  if (next !== line) {
    rewritten++;
    changes.push(
      `${id.padEnd(22)} hp ${String(before.hp).padStart(9)}->${String(r4(t.hp90)).padEnd(10)} ` +
        `atk ${String(before.atk).padStart(8)}->${String(r4(t.atk90)).padEnd(9)} ` +
        `def ${String(before.def).padStart(7)}->${String(r4(t.def90)).padEnd(9)} ` +
        `asc ${String(before.type).padEnd(9)} ${String(before.value).padStart(7)} -> ${t.type.padEnd(9)} ${r6(t.value)}`,
    );
  }
  return next;
});

const notFound = truth.filter((t) => !out.some((l) => l.includes(`id: '${t.id}',`))).map((t) => t.id);

console.log(`${rewritten} of ${truth.length} entries need updating`);
if (notFound.length) console.log(`NOT FOUND in characters.ts: ${notFound.join(', ')}`);
console.log('\n' + changes.join('\n'));

if (dryRun) {
  console.log('\n--dry-run: nothing written.');
} else {
  writeFileSync(FILE, out.join('\n'));
  console.log('\ncharacters.ts updated.');
}
