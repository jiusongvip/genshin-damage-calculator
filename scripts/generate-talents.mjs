// ============================================================================
// Generate src/data/generated/talents.ts from genshin-db.
//
// For every released character we walk the three combat talents (combat1 =
// Normal/Charged/Plunge, combat2 = Elemental Skill, combat3 = Elemental Burst)
// and turn each attribute label into a damage row carrying the full 15-level
// multiplier table. The site's damage table is built from these rows, so the
// per-hit numbers are datamined rather than hand-typed.
//
// Derivation rules (kept explicit on purpose — see the README section at the
// bottom of this file for what is auto-derived vs curated):
//   • label/values/format  — read straight from `attributes.labels` +
//                            `attributes.parameters` (param{N} placeholders)
//   • damage vs non-damage — a label mention of "DMG" (or the few damage
//                            labels that omit it) is damage; everything else
//                            (Cost, Duration, CD, Interval, Instances, HP
//                            Restored/Loss, buffs) is kept as a display row
//   • element              — parsed from the coloured "<color>…DMG</color>"
//                            spans in descriptionRaw; a melee Normal combo
//                            with no element span is Physical
//   • scaling stat         — NOT in the dataset. Normal/Charged fall back to
//                            ATK unless listed in AltScalingAttacks, and
//                            Skill/Burst use the character's `scaling` field,
//                            mirroring src/lib/damage.ts exactly
//   • hit count (×N)       — NOT in the dataset. A curated HitCountOverride
//                            table covers the multi-instance attacks we know;
//                            anything unlisted is a single hit
//
// Run: node scripts/generate-talents.mjs
// ============================================================================

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const gdb = require('genshin-db');

// ---------------------------------------------------------------------------
// Source data: the character roster (id -> name / element / scaling) and the
// AltScalingAttacks table, read out of the hand-maintained TS so this script
// never drifts from what the engine uses.
// ---------------------------------------------------------------------------

const charactersSrc = readFileSync(join(root, 'src/data/characters.ts'), 'utf8');
const ROSTER = charactersSrc
  .split('\n')
  .map((line) => line.match(/\{ id: '([^']+)', name: '([^']+)',.*?element: '(\w+)', weaponType: '(\w+)'.*?scaling: '(\w+)'/))
  .filter(Boolean)
  .map((m) => ({ id: m[1], name: m[2], element: m[3], weaponType: m[4], scaling: m[5] }));

const damageSrc = readFileSync(join(root, 'src/lib/damage.ts'), 'utf8');
const ALT_BLOCK = damageSrc.match(/ALT_SCALING_ATTACKS[^=]*=\s*\{([\s\S]*?)\n\};/);
const ALT_SCALING = {};
if (ALT_BLOCK) {
  for (const m of ALT_BLOCK[1].matchAll(/([a-z0-9-]+):\s*\{([^}]*)\}/g)) {
    const entry = {};
    for (const pair of m[2].matchAll(/(normal|charged):\s*'(\w+)'/g)) entry[pair[1]] = pair[2];
    ALT_SCALING[m[1]] = entry;
  }
}

// ---------------------------------------------------------------------------
// Curated hit counts for multi-instance attacks (×N). The multiplier stored in
// the dataset is a single instance, so the table multiplies by this count.
// Keys are `${characterId}:${label}`. Extend as attacks are verified in-game.
// ---------------------------------------------------------------------------
const HIT_COUNT_OVERRIDE = {
  'klee:Jumpy Dumpty DMG': 3,
  'klee:Mine DMG': 8,
  "klee:Sparks 'n' Splash DMG": 19,
};

// ---------------------------------------------------------------------------
// Element parsing. The coloured damage-type spans are the only reliable signal
// in the dataset; a melee Normal combo has none and is Physical.
// ---------------------------------------------------------------------------
const ELEMENT_WORDS = [
  ['pyro', 'Pyro'],
  ['hydro', 'Hydro'],
  ['electro', 'Electro'],
  ['cryo', 'Cryo'],
  ['anemo', 'Anemo'],
  ['geo', 'Geo'],
  ['dendro', 'Dendro'],
  ['physical', 'Physical'],
];

function elementFromDescription(raw) {
  if (!raw) return null;
  for (const span of raw.matchAll(/<color=#[0-9A-Fa-f]{8}>([^<]+)<\/color>/g)) {
    const text = span[1];
    if (!/DMG/i.test(text)) continue;
    for (const [slug, word] of ELEMENT_WORDS) {
      if (text.includes(word)) return slug;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Label classification.
// ---------------------------------------------------------------------------
const NON_DAMAGE = /(Cost|Duration|Interval|Instances|Regeneration|Restored|HP Loss|Increase|Bonus|SPD|Energy|Stamina|Absorption|^CD$|Activation|Stacks?|Charges)/i;

function isDamageLabel(label) {
  if (NON_DAMAGE.test(label)) return false;
  return (
    /DMG/i.test(label) ||
    /Equitable Judgment/i.test(label) ||
    /Aimed Shot/i.test(label) ||
    /Blood Blossom/i.test(label) ||
    /^Charged Attack$/i.test(label)
  );
}

function groupFor(label, combatKey) {
  if (combatKey === 'combat2') return 'skill';
  if (combatKey === 'combat3') return 'burst';
  if (/Plunge/i.test(label)) return 'plunge';
  if (/Charged|Equitable Judgment/i.test(label)) return 'charged';
  return 'normal';
}

function isPercentFormat(fmt) {
  return /P\b/.test(fmt); // F1P / P / P1 all end in a percentage token
}

function sumValues(params, parameters) {
  const out = new Array(15).fill(0);
  for (const p of params) {
    const vals = parameters[p];
    if (!vals) continue;
    for (let i = 0; i < 15; i++) out[i] += vals[i] ?? 0;
  }
  return out.map((n) => Math.round(n * 1e6) / 1e6);
}

// ---------------------------------------------------------------------------
// Build the table.
// ---------------------------------------------------------------------------
const table = {};
const report = { characters: 0, rows: 0, missing: [] };

for (const char of ROSTER) {
  let talents;
  try {
    talents = gdb.talents(char.name);
  } catch {
    talents = null;
  }
  if (!talents) {
    report.missing.push(`${char.id} (${char.name})`);
    continue;
  }
  report.characters++;

  const rows = [];
  for (const combatKey of ['combat1', 'combat2', 'combat3']) {
    const combat = talents[combatKey];
    if (!combat?.attributes) continue;

    const groupElement =
      combatKey === 'combat1'
        ? elementFromDescription(combat.descriptionRaw) ?? 'physical'
        : elementFromDescription(combat.descriptionRaw) ?? char.element;

    const labels = combat.attributes.labels ?? [];
    const parameters = combat.attributes.parameters ?? {};

    labels.forEach((rawLabel, index) => {
      const [label, fmt = ''] = rawLabel.split('|');
      const params = (fmt.match(/param\d+/g) ?? []).map((p) => p);
      if (params.length === 0) return;

      const group = groupFor(label, combatKey);
      const isDamage = isDamageLabel(label);

      const emit = (finalLabel, paramList) => {
        const id = `${combatKey}-${index}-${finalLabel}`.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
        rows.push({
          id,
          label: finalLabel,
          group,
          values: sumValues(paramList, parameters),
          percent: isPercentFormat(fmt),
          isDamage,
          hits: HIT_COUNT_OVERRIDE[`${char.id}:${finalLabel}`] ?? 1,
          scaling:
            group === 'normal' || group === 'charged'
              ? ALT_SCALING[char.id]?.[group] ?? 'atk'
              : group === 'skill' || group === 'burst'
                ? char.scaling
                : 'atk',
          element: groupElement,
        });
      };

      // "Low/High Plunge DMG" packs two different hits into one label.
      if (/Low\/High/i.test(label) && params.length >= 2) {
        emit(label.replace(/Low\/High/i, 'Low'), [params[0]]);
        emit(label.replace(/Low\/High/i, 'High'), [params[1]]);
      } else {
        emit(label, params);
      }
    });
  }

  table[char.id] = rows;
  report.rows += rows.length;
}

// ---------------------------------------------------------------------------
// Emit the module.
// ---------------------------------------------------------------------------
const outDir = join(root, 'src/data/generated');
mkdirSync(outDir, { recursive: true });

const banner = `// ============================================================================
// AUTO-GENERATED by scripts/generate-talents.mjs — DO NOT EDIT BY HAND.
//
// Per-hit talent table for every released character, from genshin-db.
// Each row is one attribute of a combat talent with its full 15-level
// multiplier table (index 0 = talent level 1). \`values\` are fractions.
// Reference: ${report.characters} characters, ${report.rows} rows.
// ============================================================================
`;

const body = `import type { ElementType, ScalingStat } from '../../lib/damage';

export type TalentGroup = 'normal' | 'charged' | 'plunge' | 'skill' | 'burst';

export interface TalentRow {
  id: string;
  label: string;
  group: TalentGroup;
  /** Fraction per talent level 1..15; empty for non-damage rows. */
  values: number[];
  /** True when the value is a percentage; false for flat numbers (s, energy). */
  percent: boolean;
  isDamage: boolean;
  /** Number of instances this row represents (a single-instance value × hits). */
  hits: number;
  scaling: ScalingStat;
  element: ElementType;
}

export const TALENT_TABLE: Record<string, TalentRow[]> = ${JSON.stringify(table, null, 0)};

export function talentRowsFor(id: string): TalentRow[] | undefined {
  return TALENT_TABLE[id];
}
`;

writeFileSync(join(outDir, 'talents.ts'), banner + body);

console.log(`characters: ${report.characters}/${ROSTER.length}, rows: ${report.rows}`);
if (report.missing.length) console.log(`MISSING (${report.missing.length}): ${report.missing.join(', ')}`);
