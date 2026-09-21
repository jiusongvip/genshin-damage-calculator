// ============================================================================
// Download artifact-set icons (all five pieces per set) into
// public/images/artifact-sets/{id}-{flower|plume|sands|goblet|circlet}.webp, so
// the Artifacts panel reads visually regardless of the UI language.
// Source: genshin-db icon filename → Enka's UI icon CDN → webp via sharp.
//
// Existing files are skipped, so re-running only fills in what is missing.
// Run: node scripts/generate-artifact-icons.mjs
// ============================================================================

import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const gdb = require('genshin-db');
const sharp = require('sharp');

const src = readFileSync(join(root, 'src/data/artifactSets.ts'), 'utf8');
// `name` may be quoted with ' or " — names containing an apostrophe
// (Gladiator's Finale, Shimenawa's Reminiscence, Wanderer's Troupe) use ".
const sets = [...src.matchAll(/\{\s*id: '([^']+)',\s*name: (?:'([^']+)'|"([^"]+)")/g)].map((m) => ({
  id: m[1],
  name: m[2] ?? m[3],
}));

const outDir = join(root, 'public/images/artifact-sets');
mkdirSync(outDir, { recursive: true });

const PIECES = ['flower', 'plume', 'sands', 'goblet', 'circlet'];

let saved = 0;
let skipped = 0;
const missing = [];

for (const set of sets) {
  const data = gdb.artifacts(set.name);
  for (const piece of PIECES) {
    const icon = data?.images?.[`filename_${piece}`];
    if (!icon) {
      missing.push(`${set.id} ${piece} — no icon filename`);
      continue;
    }
    const dest = join(outDir, `${set.id}-${piece}.webp`);
    if (existsSync(dest)) {
      skipped++;
      continue;
    }
    try {
      const res = await fetch(`https://enka.network/ui/${icon}.png`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      const webp = await sharp(buf).resize(128, 128, { fit: 'inside' }).webp({ quality: 90 }).toBuffer();
      writeFileSync(dest, webp);
      saved++;
    } catch (err) {
      missing.push(`${set.id} ${piece} (${icon}) — ${err.message}`);
    }
  }
}

console.log(`saved ${saved}, skipped ${skipped}, missing ${missing.length}`);
for (const m of missing) console.log(`MISSING ${m}`);
