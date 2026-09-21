// ============================================================================
// Download weapon icons into public/images/weapons/{id}.webp.
//
// Primary source: genshin.jmp.blue — the icon slug is the weapon's English
// name lower-cased with runs of non-alphanumerics turned into "-" (so
// "Dragon's Bane" -> "dragon-s-bane"). A few names differ between the game
// and this dataset; those are handled by OVERRIDES.
//
// The jmp.blue index stalls at ~189 weapons and has no Natlan/Fontaine
// craftables, so anything it 404s falls back to Enka's UI icon CDN via the
// dataset's filename_icon (same route the artifact-icon generator uses),
// converted to webp with sharp. Weapons missing from BOTH sources are
// reported — the UI falls back to a glyph (WeaponIcon).
//
// Run: node scripts/fetch-weapon-icons.mjs
// ============================================================================

import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'src/data/weapons.ts'), 'utf8');
const outDir = join(root, 'public/images/weapons');
mkdirSync(outDir, { recursive: true });

const gdb = require('genshin-db');
const sharp = require('sharp');

// Dataset name -> API slug, only where the two disagree.
const OVERRIDES = {
  'crimson-moon-semblance': 'crimson-moon-s-semblance',
  'tome-of-eternal-flow': 'tome-of-the-eternal',
};

// Generated file quotes plain names with ' and names containing an apostrophe
// with "; match both.
const weapons = [...source.matchAll(/\{\s*id: '([^']+)',\s*name: (?:'([^']+)'|"([^"]+)")/g)].map((m) => ({
  id: m[1],
  name: m[2] ?? m[3],
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
  // 1) jmp.blue serves a ready webp at /icon.
  try {
    const res = await fetch(`https://genshin.jmp.blue/weapons/${slugFor(w)}/icon`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
    saved++;
    console.log(`ok     ${w.id}  (jmp.blue ${slugFor(w)})`);
    continue;
  } catch (err) {
    // fall through to Enka
  }
  // 2) Enka: dataset icon filename → PNG → webp, matching the shipped 128px spec.
  try {
    const icon = gdb.weapons(w.name)?.images?.filename_icon;
    if (!icon) throw new Error('no filename_icon in genshin-db');
    const res = await fetch(`https://enka.network/ui/${icon}.png`);
    if (!res.ok) throw new Error(`enka HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const webp = await sharp(buf).resize(128, 128, { fit: 'inside' }).webp({ quality: 90 }).toBuffer();
    writeFileSync(dest, webp);
    saved++;
    console.log(`ok-enka ${w.id}  (${icon})`);
  } catch (err) {
    missing.push({ id: w.id, name: w.name, slug: slugFor(w), reason: String(err.message || err) });
  }
}

console.log(`\nsaved ${saved}, skipped ${skipped}, missing ${missing.length}`);
for (const m of missing) console.log(`MISSING ${m.id} | ${m.name} | ${m.slug} | ${m.reason}`);
