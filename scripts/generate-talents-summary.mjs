// ============================================================================
// Regenerate the TALENTS summary table inside src/data/talents.ts.
//
// src/data/talents.ts used to claim "AUTO-GENERATED from genshin-db v5.2.13"
// while no script produced it, so it drifted: by 2026-09-21 it disagreed with
// the per-hit table on 88 fields, its `charged` was 0 for 21 bow characters,
// and its `normal` for a bow was a mix of the melee combo and every aimed-shot
// row.
//
// Only the `TALENTS` object is rewritten. `signatureTalent()`,
// `SIGNATURE_OVERRIDE` and `TALENT_KEYS` are policy, not data, and are left
// exactly as they are.
//
// Derivation, mirroring the file's own header:
//   normal  = sum of every damage row in group 'normal'  (the numbered combo)
//   charged = sum of every damage row in group 'charged' (a bow's ranged-shot
//             family, or a melee character's charged attack)
//   skill   = the single largest damage row in group 'skill'
//   burst   = the single largest damage row in group 'burst'
// All at talent level 10 (index 9). `hits` is applied, so a ×N attack counts N.
//
// Characters with no rows in the per-hit table (Aether, Lumine, Manekin,
// Manekina — genshin-db has no talent data for them) keep their existing entry
// rather than being dropped.
//
// Run: node scripts/generate-talents-summary.mjs
//      node scripts/generate-talents-summary.mjs --dry-run
// ============================================================================

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { summarize } from './lib/talent-rules.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const FILE = join(root, 'src/data/talents.ts');
const dryRun = process.argv.includes('--dry-run');

// ---------------------------------------------------------------------------
// Read the per-hit table.
// ---------------------------------------------------------------------------
function readTable() {
  const src = readFileSync(join(root, 'src/data/generated/talents.ts'), 'utf8');
  const start = src.indexOf('{', src.indexOf('export const TALENT_TABLE'));
  let depth = 0;
  let inStr = false;
  let esc = false;
  let end = -1;
  for (let p = start; p < src.length; p++) {
    const ch = src[p];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === '{' || ch === '[') depth++;
    else if (ch === '}' || ch === ']') {
      depth--;
      if (depth === 0) {
        end = p + 1;
        break;
      }
    }
  }
  return JSON.parse(src.slice(start, end));
}

// ---------------------------------------------------------------------------
// Read the character order + the existing entries (kept as fallbacks).
// ---------------------------------------------------------------------------
const charactersSrc = readFileSync(join(root, 'src/data/characters.ts'), 'utf8');
const ORDER = charactersSrc
  .split('\n')
  .map((l) => l.match(/^\s*\{ id: '([^']+)',/))
  .filter(Boolean)
  .map((m) => m[1]);

// Locate the line that closes the TALENTS object: a bare `}` or `};` on its
// own line. An `indexOf('\n};')` search overshoots when the map closes with a
// semicolon-less `}` (which is what this script itself used to emit) and eats
// the hand-written policy block that follows.
const MAP_CLOSE_RE = /\n\};?[ \t]*\r?\n/;
function mapClose(src, from) {
  const m = MAP_CLOSE_RE.exec(src.slice(from));
  if (!m) throw new Error('could not locate the TALENTS block in src/data/talents.ts');
  return { end: from + m.index, after: from + m.index + m[0].length };
}

const talentsSrc = readFileSync(FILE, 'utf8');
const blockStart = talentsSrc.indexOf('export const TALENTS: Record<string, CharacterTalents> = {');
if (blockStart < 0) throw new Error('could not locate the TALENTS block in src/data/talents.ts');
const blockClose = mapClose(talentsSrc, blockStart);

const existing = {};
for (const m of talentsSrc.slice(blockStart, blockClose.end).matchAll(/'([a-z0-9-]+)': \{ ([^}]+) \}/g)) {
  const o = {};
  for (const p of m[2].matchAll(/(\w+): (?:(\d+(?:\.\d+)?)|"([^"]*)")/g)) {
    o[p[1]] = p[3] !== undefined ? p[3] : Number(p[2]);
  }
  existing[m[1]] = o;
}

// ---------------------------------------------------------------------------
// Derive.
// ---------------------------------------------------------------------------
const table = readTable();
const derive = summarize;

const out = {};
const kept = [];
const changed = [];
for (const id of ORDER) {
  const rows = table[id];
  if (!rows || rows.length === 0) {
    if (existing[id]) {
      out[id] = existing[id];
      kept.push(id);
    } else {
      kept.push(`${id} (no data at all)`);
    }
    continue;
  }
  const next = derive(rows);
  out[id] = next;
  const before = existing[id];
  if (!before) {
    changed.push(`${id}: NEW`);
    continue;
  }
  const diffs = ['normal', 'charged', 'skill', 'burst'].filter((k) => Math.abs(next[k] - before[k]) > 5e-4);
  if (diffs.length || next.skillLabel !== before.skillLabel || next.burstLabel !== before.burstLabel) {
    changed.push(
      `${id.padEnd(20)} ${diffs.map((k) => `${k} ${before[k]}->${next[k]}`).join('  ')}` +
        (next.skillLabel !== before.skillLabel ? `  skillLabel "${before.skillLabel}"->"${next.skillLabel}"` : '') +
        (next.burstLabel !== before.burstLabel ? `  burstLabel "${before.burstLabel}"->"${next.burstLabel}"` : ''),
    );
  }
}

// ---------------------------------------------------------------------------
// Emit, preserving everything outside the TALENTS object.
// ---------------------------------------------------------------------------
const q = (s) => `"${s.replace(/"/g, '\\"')}"`;
const lines = Object.entries(out).map(
  ([id, t]) =>
    `  '${id}': { normal: ${t.normal}, charged: ${t.charged}, skill: ${t.skill}, skillLabel: ${q(t.skillLabel)}, burst: ${t.burst}, burstLabel: ${q(t.burstLabel)} },`,
);

const header = `// ============================================================================
// Talent multipliers — AUTO-GENERATED by scripts/generate-talents-summary.mjs.
//
// Derived from src/data/generated/talents.ts (per-hit rows), at talent level 10.
//   normal  = full Normal Attack combo (sum of the numbered N-Hit DMG rows)
//   charged = Charged Attack (sum of the charged rows; for a bow this is the
//             whole ranged-shot family — the aimed shot plus its payload)
//   skill   = Elemental Skill main hit (highest single multiplier)
//   burst   = Elemental Burst main hit (highest single multiplier)
//
// 0 means the talent deals no direct damage (e.g. Itto's burst is a buff).
// Do not edit by hand — run \`npm run gen:talents-summary\`.
// ============================================================================
`;

// Two independent edits, so nothing outside the data and its banner is touched:
//   1. the leading banner comment -> the new one
//   2. the TALENTS object literal -> the regenerated entries
// Everything between them (CharacterTalents, talentsFor, signatureTalent,
// SIGNATURE_OVERRIDE, TALENT_KEYS) is hand-written policy and is preserved
// byte-for-byte. Replacing "everything up to the TALENTS block" instead would
// delete the CharacterTalents interface sitting in that gap.
const bannerStart = talentsSrc.indexOf('// =====');
const interfaceStart = talentsSrc.indexOf('export interface CharacterTalents');
if (interfaceStart < 0) throw new Error('CharacterTalents interface not found — refusing to write');

const withNewBanner =
  (bannerStart >= 0 && bannerStart < interfaceStart ? talentsSrc.slice(0, bannerStart) : '') +
  header +
  talentsSrc.slice(interfaceStart);

// Re-locate the block in the new string (offsets shifted).
const nbStart = withNewBanner.indexOf('export const TALENTS: Record<string, CharacterTalents> = {');
if (nbStart < 0) throw new Error('TALENTS block not found after banner swap');
const nbClose = mapClose(withNewBanner, nbStart);

const newSrc =
  withNewBanner.slice(0, nbStart) +
  `export const TALENTS: Record<string, CharacterTalents> = {\n${lines.join('\n')}\n};\n` +
  withNewBanner.slice(nbClose.after);

console.log(`entries: ${Object.keys(out).length} (derived ${Object.keys(out).length - kept.length}, kept ${kept.length})`);
if (kept.length) console.log(`KEPT without per-hit data: ${kept.join(', ')}`);
console.log(`\nchanged: ${changed.length}`);
console.log(changed.join('\n'));

if (dryRun) {
  console.log('\n--dry-run: nothing written.');
} else {
  writeFileSync(FILE, newSrc);
  console.log('\nsrc/data/talents.ts rewritten.');
}
