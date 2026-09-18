// ============================================================================
// Download weapon icons into public/images/weapons/{id}.webp.
//
// Source: genshin.jmp.blue — the icon slug is the weapon's English name
// lower-cased with runs of non-alphanumerics turned into "-" (so "Dragon's
// Bane" -> "dragon-s-bane"). A few names differ between the game and this
// dataset, and a handful of brand-new weapons are not on the API yet; those
// are handled by OVERRIDES / reported as missing (the UI falls back to a tile).
//
// Run: node scripts/fetch-weapon-icons.mjs
// ============================================================================

import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'src/data/weapons.ts'), 'utf8');
const outDir = join(root, 'public/images/weapons');
mkdirSync(outDir, { recursive: true });

// Dataset name -> API slug, only where the two disagree.
const OVERRIDES = {
  'crimson-moon-semblance': 'crimson-moon-s-semblance',
  'tome-of-eternal-flow': 'tome-of-the-eternal',
};

const weapons = [...source.matchAll(/\{ id: '([^']+)', name: "([^"]+)"/g)].map((m) => ({
  id: m[1],
  name: m[2],
}));

const slugFor = (w) =>
  OVERRIDES[w.id] ?? w.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

let saved = 0;
let skipped = 0;
const missing = [];

for (const w of weapons) {
  const dest = join(outDir, `${w.id}.webp`);
  if (existsSync(dest)) {
    skipped++;
    continue;
  }
  const url = `https://genshin.jmp.blue/weapons/${slugFor(w)}/icon`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    writeFileSync(dest, buf);
    saved++;
    console.log(`ok   ${w.id}  (${slugFor(w)})`);
  } catch (err) {
    missing.push({ id: w.id, name: w.name, slug: slugFor(w), reason: String(err.message || err) });
  }
}

console.log(`\nsaved ${saved}, skipped ${skipped}, missing ${missing.length}`);
for (const m of missing) console.log(`MISSING ${m.id} | ${m.name} | ${m.slug} | ${m.reason}`);
