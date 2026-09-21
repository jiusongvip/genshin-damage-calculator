// ============================================================================
// Generate src/data/weapons.ts from genshin-db.
//
// Emits every 4★ / 5★ weapon: level-90 base ATK plus the secondary stat,
// rounded to the shipped convention (baseATK integer, percentage to three
// decimals, Elemental Mastery integer). 3★ weapons stay out, per the file
// header.
//
// The committed file doubles as the ordering seed: its entries keep their
// exact position, new weapons are appended per section (5★ before 4★, then
// alphabetical). That is what lets `--check` prove the generator reproduces
// the hand-cross-checked data before it is allowed to extend it.
//
// Run:  node scripts/generate-weapons.mjs            (regenerate)
//       node scripts/generate-weapons.mjs --check    (verify current file only)
// ============================================================================

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const gdb = require('genshin-db');
const outPath = join(root, 'src/data/weapons.ts');

const TYPE_MAP = {
  WEAPON_SWORD_ONE_HAND: 'sword',
  WEAPON_CLAYMORE: 'claymore',
  WEAPON_BOW: 'bow',
  WEAPON_CATALYST: 'catalyst',
  WEAPON_POLE: 'polearm',
};

/** FIGHT_PROP_* -> SecondaryStatType. Unknown enums abort the run: silently
 *  inventing a member is exactly the "wrong over missing" failure the data
 *  files warn about. */
const STAT_MAP = {
  FIGHT_PROP_CRITICAL: 'critRate',
  FIGHT_PROP_CRITICAL_HURT: 'critDMG',
  FIGHT_PROP_ATTACK_PERCENT: 'atk%',
  FIGHT_PROP_HP_PERCENT: 'hp%',
  FIGHT_PROP_DEFENSE_PERCENT: 'def%',
  FIGHT_PROP_CHARGE_EFFICIENCY: 'er',
  FIGHT_PROP_ELEMENT_MASTERY: 'em',
  FIGHT_PROP_PHYSICAL_ADD_HURT: 'physical',
};

const parseCommitted = (src) =>
  [...src.matchAll(/\{ id: '([^']+)', name: "([^"]+)", weaponType: '(\w+)', rarity: (\d), baseATK: (\d+), secondary: \{ type: '([^']+)', value: ([\d.]+) \} \}/g)].map(
    (m) => ({
      id: m[1],
      name: m[2],
      weaponType: m[3],
      rarity: Number(m[4]),
      baseATK: Number(m[5]),
      secondary: { type: m[6], value: Number(m[7]) },
    }),
  );

/**
 * genshin-db has no slug field; ids are the name normalised below, with these
 * exceptions kept from the hand-checked original so icons, characters'
 * bestWeapon references and the URL state stay stable.
 */
const ID_OVERRIDES = {
  'Staff of the Scarlet Sands': 'staff-of-scarlet-sands',
  "Crimson Moon's Semblance": 'crimson-moon-semblance',
  "Astral Vulture's Crimson Plumage": 'astral-vulture',
  'Tome of the Eternal Flow': 'tome-of-eternal-flow',
  'Lost Prayer to the Sacred Winds': 'lost-prayer',
  "Jadefall's Splendor": 'jadefall-splendor',
};
const NAME_OVERRIDES = {
  "Crimson Moon's Semblance": 'Crimson Moon Semblance',
};

/** Apostrophes vanish (Wolf's → wolfs); other punctuation is a dash. */
const slug = (name) => name.replace(/['’]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** One weapon from genshin-db, in the shipped shape. */
function fromGDB(w) {
  const weaponType = TYPE_MAP[w.weaponType];
  const type = STAT_MAP[w.mainStatType];
  if (!weaponType || !type) {
    console.error(`Unmapped enum for "${w.name}": weaponType=${w.weaponType} mainStatType=${w.mainStatType}`);
    process.exit(1);
  }
  const s = w.stats(90, '6');
  const value = type === 'em' ? Math.round(s.specialized) : Number(s.specialized.toFixed(3));
  return {
    id: ID_OVERRIDES[w.name] ?? slug(w.name),
    // Some dataset names ship wrapped in literal quotes ("The Catch"); the
    // shipped convention strips them.
    name: (NAME_OVERRIDES[w.name] ?? w.name).replace(/^"|"$/g, ''),
    weaponType,
    rarity: w.rarity,
    baseATK: Math.round(s.attack),
    secondary: { type, value },
  };
}

const committed = parseCommitted(readFileSync(outPath, 'utf8'));
const seen = new Set();
const all = gdb
  .weapons('names', { matchCategories: true })
  .map((name) => gdb.weapons(name))
  .filter((w) => w && (w.rarity === 4 || w.rarity === 5))
  .map(fromGDB)
  // genshin-db carries three identically-named "Prized Isshin Blade" records;
  // one entry per id, first wins.
  .filter((w) => !seen.has(w.id) && (seen.add(w.id), true));

if (process.argv.includes('--check')) {
  const byId = new Map(all.map((w) => [w.id, w]));
  const diffs = [];
  for (const c of committed) {
    const g = byId.get(c.id);
    if (!g) diffs.push(`${c.id}: missing from genshin-db`);
    else if (g.baseATK !== c.baseATK || g.secondary.type !== c.secondary.type || g.secondary.value !== c.secondary.value || g.name !== c.name)
      diffs.push(`${c.id}: committed ${c.baseATK}/${c.secondary.type} ${c.secondary.value} vs generated ${g.baseATK}/${g.secondary.type} ${g.secondary.value}`);
  }
  console.log(`checked ${committed.length} committed weapons against genshin-db — ${diffs.length ? `${diffs.length} DIFFS` : 'identical'}`);
  for (const d of diffs) console.log('  ' + d);
  process.exit(diffs.length ? 1 : 0);
}

const SECTION_ORDER = ['polearm', 'bow', 'sword', 'catalyst', 'claymore'];
const SECTION_LABEL = { polearm: 'Polearms', bow: 'Bows', sword: 'Swords', catalyst: 'Catalysts', claymore: 'Claymores' };
const seedOrder = new Map(committed.map((w, i) => [w.id, i]));
const byId = new Map(all.map((w) => [w.id, w]));

// Keep committed ids on their committed values where genshin-db agrees (it
// must — --check runs in CI); anything new sorts after them.
const forSection = (type) => {
  const inSection = all.filter((w) => w.weaponType === type);
  const seeded = inSection
    .filter((w) => seedOrder.has(w.id))
    .sort((a, b) => seedOrder.get(a.id) - seedOrder.get(b.id));
  const fresh = inSection
    .filter((w) => !seedOrder.has(w.id))
    .sort((a, b) => b.rarity - a.rarity || a.name.localeCompare(b.name));
  return [...seeded, ...fresh];
};

const row = (w) =>
  `  { id: '${w.id}', name: "${w.name}", weaponType: '${w.weaponType}', rarity: ${w.rarity}, baseATK: ${w.baseATK}, secondary: { type: '${w.secondary.type}', value: ${w.secondary.value} } },`;

const sections = SECTION_ORDER.map((t) => `  // ---- ${SECTION_LABEL[t]} ----\n${forSection(t).map(row).join('\n')}`);

const banner = `// ============================================================================
// Weapon data — AUTO-GENERATED by scripts/generate-weapons.mjs from genshin-db v${require('genshin-db/package.json').version}.
//
// Level-90 base ATK and secondary stat, cross-checked against genshin-db
// (datamined). 3-star weapons are omitted (rarity is 4 | 5 only).
// Do not edit by hand — regenerate from the source dataset.
// ============================================================================

import type { WeaponData } from '../lib/damage';

export const WEAPONS: WeaponData[] = [
${sections.join('\n\n')}\n\n];\n`;

const helpers = `
export function getWeapon(id: string): WeaponData | undefined {
  return WEAPONS.find((w) => w.id === id);
}

export function weaponsForType(weaponType: string): WeaponData[] {
  return WEAPONS.filter((w) => w.weaponType === weaponType);
}
`;

writeFileSync(outPath, banner + helpers);
console.log(`wrote ${all.length} weapons (${committed.length} seeded + ${all.length - committed.length} new)`);
