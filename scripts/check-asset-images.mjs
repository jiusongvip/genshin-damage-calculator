// ============================================================================
// Verify that every image the UI asks for actually exists under public/images.
//
// The UI builds image paths from data ids, so a missing file shows up only as a
// silent 404 in the browser. Run this after adding characters, weapons or
// artifact sets — or after touching the icon generators.
//
// Run: node scripts/check-asset-images.mjs
// Exits non-zero when anything is missing, so it can gate a build.
// ============================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const IMG = join(root, 'public/images');
const DATA = join(root, 'src/data');

const read = (f) => fs.readFileSync(join(DATA, f), 'utf8');
const exists = (p) => fs.existsSync(join(IMG, p));

/** Rows written as `{ id: 'x', name: ... }` on a single line. */
const idsFrom = (file) => [...read(file).matchAll(/^\s*\{ id: '([^']+)', name:/gm)].map((m) => m[1]);

/** artifactSets.ts writes one property per line and mixes ' and " quoting. */
const setIdsFrom = (file) =>
  [...read(file).matchAll(/\{\s*id: '([^']+)',\s*name: (?:'([^']+)'|"([^"]+)")/g)].map((m) => m[1]);

const PIECES = ['flower', 'plume', 'sands', 'goblet', 'circlet'];
const ELEMENTS = ['pyro', 'hydro', 'electro', 'cryo', 'anemo', 'geo', 'dendro'];
const OFFICIAL_SUFFIXES = ['-450', '-540', '-720', ''];

const missing = [];
/** Weapon art missing from every upstream source (genshin.jmp.blue lags new
 *  patches) — ScenarioBar falls back to a glyph, so these are reported but
 *  tolerated. Every other asset type must have its file. */
const tolerable = [];
const check = (p, label, soft = false) => {
  if (!exists(p)) (soft ? tolerable : missing).push(`${label} → /images/${p}`);
};

const characters = idsFrom('characters.ts');
const weapons = idsFrom('weapons.ts');
const sets = setIdsFrom('artifactSets.ts');
const featured = idsFrom('media.ts');

for (const id of characters) check(`portraits/${id}.webp`, `character ${id}`);
for (const id of weapons) check(`weapons/${id}.webp`, `weapon ${id}`, true);
for (const id of sets)
  for (const piece of PIECES) check(`artifact-sets/${id}-${piece}.webp`, `artifact set ${id}`);
for (const id of featured)
  for (const suffix of OFFICIAL_SUFFIXES) check(`official/${id}${suffix}.webp`, `featured ${id}`);
for (const el of ELEMENTS) check(`element-${el}.webp`, `element ${el}`);

const total = characters.length + weapons.length + sets.length * PIECES.length + featured.length * OFFICIAL_SUFFIXES.length + ELEMENTS.length;
console.log(
  `checked ${total} paths — ${characters.length} portraits, ${weapons.length} weapons, ` +
    `${sets.length} artifact sets × ${PIECES.length} pieces, ${featured.length} featured, ${ELEMENTS.length} elements`,
);

if (missing.length === 0) {
  if (tolerable.length) {
    console.log(`\n${tolerable.length} weapon icons not in any upstream source yet — UI falls back to a glyph:`);
    for (const m of tolerable) console.log(`  ~ ${m}`);
  }
  console.log('all required image references resolve.');
  process.exit(0);
}

console.log(`\n${missing.length} MISSING:`);
for (const m of missing) console.log(`  - ${m}`);
process.exit(1);
