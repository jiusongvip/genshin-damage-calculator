// ============================================================================
// Generate src/data/levelStats.ts from genshin-db.
//
// For each character we sample the level curve at both sides of every
// ascension breakpoint, so the engine can linearly interpolate between them
// and still see each ascension jump:
//   1, 20, 21, 40, 41, 50, 51, 60, 61, 70, 71, 80, 81, 90
//
// `spec` is the ascension ("specialized") stat exactly as the dataset reports
// it — which means two things that used to be got wrong:
//   • CRIT Rate / CRIT DMG include the base every character has (0.05 / 0.5),
//     so Hu Tao's CRIT DMG runs 0.5 -> 0.884 rather than 0 -> 0.384. The engine
//     strips the base back out (see BASE_CRIT_RATE in lib/damage.ts).
//   • Elemental Mastery is a flat stat, not a fraction: Kazuha's curve is
//     0 -> 28.8 -> 57.6 -> 86.4 -> 115.2 EM points, and Healing Bonus is
//     0 -> 0.2215. Do NOT divide these by 100.
//
// Precision: `spec` is written to 6 dp because ascension steps are small
// (Baizhu's is 0.288, Qiqi's Healing Bonus 0.2215). Rounding these to 2 dp —
// which the previous hand-committed table did — inflated Baizhu's HP by 0.7%
// and handed Qiqi 22% ATK she does not have.
//
// Run: node scripts/generate-level-stats.mjs
//      node scripts/generate-level-stats.mjs --ascension-report
//        prints the true ascension type/value per character (used to audit
//        characters.ts; see scripts/sync-character-stats.mjs)
// ============================================================================

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const gdb = require('genshin-db');

const BREAKPOINTS = [1, 20, 21, 40, 41, 50, 51, 60, 61, 70, 71, 80, 81, 90];

// ---------------------------------------------------------------------------
// genshin-db's FIGHT_PROP_* enum -> the site's SecondaryStatType.
//
// The element-DMG entries all collapse to the generic `dmg%`, which is the
// closest the engine can get: it tracks one DMG-bonus bucket and does not know
// whether the attack's element matches the bonus. That overstates a character
// whose bonus element differs from the attack being modelled (Razor's Physical
// bonus applied to his Electro skill, Aloy's Cryo bonus on a physical hit).
// ---------------------------------------------------------------------------
const SUBSTAT_MAP = {
  FIGHT_PROP_ATTACK_PERCENT: 'atk%',
  FIGHT_PROP_HP_PERCENT: 'hp%',
  FIGHT_PROP_DEFENSE_PERCENT: 'def%',
  FIGHT_PROP_CRITICAL: 'critRate',
  FIGHT_PROP_CRITICAL_HURT: 'critDMG',
  FIGHT_PROP_ELEMENT_MASTERY: 'em',
  FIGHT_PROP_CHARGE_EFFICIENCY: 'er',
  FIGHT_PROP_HEAL_ADD: 'heal%',
  FIGHT_PROP_PHYSICAL_ADD_HURT: 'physical',
  FIGHT_PROP_FIRE_ADD_HURT: 'dmg%',
  FIGHT_PROP_WATER_ADD_HURT: 'dmg%',
  FIGHT_PROP_ELEC_ADD_HURT: 'dmg%',
  FIGHT_PROP_ICE_ADD_HURT: 'dmg%',
  FIGHT_PROP_WIND_ADD_HURT: 'dmg%',
  FIGHT_PROP_ROCK_ADD_HURT: 'dmg%',
  FIGHT_PROP_GRASS_ADD_HURT: 'dmg%',
};

const charactersSrc = readFileSync(join(root, 'src/data/characters.ts'), 'utf8');
const ROSTER = charactersSrc
  .split('\n')
  .map((line) => line.match(/\{ id: '([^']+)', name: '([^']+)',.*?element: '(\w+)', weaponType: '(\w+)'.*?scaling: '(\w+)'/))
  .filter(Boolean)
  .map((m) => ({ id: m[1], name: m[2] }));

const r4 = (n) => Math.round(n * 1e4) / 1e4;
const r6 = (n) => Math.round(n * 1e6) / 1e6;

// ---------------------------------------------------------------------------
// Ascension report mode — the truth table for characters.ts.
// ---------------------------------------------------------------------------
if (process.argv.includes('--ascension-report')) {
  const rows = [];
  for (const char of ROSTER) {
    const c = gdb.characters(char.name);
    if (!c) continue;
    const s90 = c.stats(90);
    const s1 = c.stats(1);
    rows.push({
      id: char.id,
      name: char.name,
      prop: c.substatType,
      type: SUBSTAT_MAP[c.substatType] ?? null,
      value: r6(s90.specialized),
      level1: r6(s1.specialized),
      hp90: r4(s90.hp),
      atk90: r4(s90.attack),
      def90: r4(s90.defense),
    });
  }
  const unmapped = rows.filter((r) => !r.type);
  console.log(JSON.stringify(rows, null, 2));
  if (unmapped.length) console.error(`\nUNMAPPED substatType (${unmapped.length}): ${[...new Set(unmapped.map((r) => r.prop))].join(', ')}`);
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Build the level curves.
// ---------------------------------------------------------------------------
const curves = {};
const missing = [];
const warnings = [];

for (const char of ROSTER) {
  const c = gdb.characters(char.name);
  if (!c) {
    missing.push(`${char.id} (${char.name})`);
    continue;
  }

  const levels = [];
  const hp = [];
  const atk = [];
  const def = [];
  const spec = [];

  for (const lv of BREAKPOINTS) {
    const s = c.stats(lv);
    if (!s) {
      warnings.push(`${char.id}: no stats(${lv})`);
      continue;
    }
    levels.push(lv);
    hp.push(r4(s.hp));
    atk.push(r4(s.attack));
    def.push(r4(s.defense));
    spec.push(r6(s.specialized));
  }

  if (levels.length !== BREAKPOINTS.length) {
    warnings.push(`${char.id}: only ${levels.length}/${BREAKPOINTS.length} breakpoints`);
  }
  curves[char.id] = { levels, hp, atk, def, spec };
}

// ---------------------------------------------------------------------------
// Emit the module.
// ---------------------------------------------------------------------------
const outDir = join(root, 'src/data');
mkdirSync(outDir, { recursive: true });

const banner = `// ============================================================================
// AUTO-GENERATED by scripts/generate-level-stats.mjs — DO NOT EDIT BY HAND.
//
// Base HP / ATK / DEF and the ascension "specialized" stat at these levels:
//   1, 20, 21, 40, 41, 50, 51, 60, 61, 70, 71, 80, 81, 90
// (both sides of every ascension, so the ascension jumps are captured).
// Values between breakpoints are linearly interpolated by the engine.
//
// \`spec\` is the raw dataset value, which for CRIT Rate / CRIT DMG INCLUDES the
// base every character has (0.05 / 0.5) — lib/damage.ts subtracts it back out.
// Elemental Mastery and Healing Bonus are flat, not fractions.
//
// Reference: ${Object.keys(curves).length} characters, genshin-db v5.2.13.
// ============================================================================
`;

const lines = Object.entries(curves).map(([id, c]) => {
  const arr = (a) => `[${a.join(', ')}]`;
  return `  '${id}': { levels: ${arr(c.levels)}, hp: ${arr(c.hp)}, atk: ${arr(c.atk)}, def: ${arr(c.def)}, spec: ${arr(c.spec)} },`;
});

const body = `export interface LevelCurve {
  levels: number[];
  hp: number[];
  atk: number[];
  def: number[];
  /** ascension / secondary stat value at each breakpoint (raw dataset value) */
  spec: number[];
}

export const LEVEL_CURVES: Record<string, LevelCurve> = {
${lines.join('\n')}
};

/** Linearly interpolate a character's base stats at any level 1-90. */
export function baseStatsAt(id: string, level: number): { hp: number; atk: number; def: number; spec: number } | undefined {
  const c = LEVEL_CURVES[id];
  if (!c) return undefined;
  const lv = Math.min(90, Math.max(1, Math.round(level)));
  const L = c.levels;
  if (lv <= L[0]) return { hp: c.hp[0], atk: c.atk[0], def: c.def[0], spec: c.spec[0] };
  if (lv >= L[L.length - 1]) {
    const i = L.length - 1;
    return { hp: c.hp[i], atk: c.atk[i], def: c.def[i], spec: c.spec[i] };
  }
  let i = 0;
  while (i < L.length - 1 && L[i + 1] <= lv) i++;
  const lo = L[i];
  const hi = L[i + 1];
  const t = (lv - lo) / (hi - lo);
  const lerp = (a: number, b: number) => a + (b - a) * t;
  return { hp: lerp(c.hp[i], c.hp[i + 1]), atk: lerp(c.atk[i], c.atk[i + 1]), def: lerp(c.def[i], c.def[i + 1]), spec: lerp(c.spec[i], c.spec[i + 1]) };
}
`;

writeFileSync(join(outDir, 'levelStats.ts'), banner + body);

console.log(`levelStats.ts written — ${Object.keys(curves).length}/${ROSTER.length} characters, ${BREAKPOINTS.length} breakpoints each`);
if (missing.length) console.log(`MISSING (${missing.length}): ${missing.join(', ')}`);
if (warnings.length) console.log(`WARNINGS (${warnings.length}):\n  ${warnings.join('\n  ')}`);
