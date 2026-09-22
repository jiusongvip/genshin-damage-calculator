// ============================================================================
// Baseline data audit — our hand-maintained tables vs genshin-db.
//
// The site ships three hand-maintained data files that are supposed to mirror
// the game exactly:
//
//   src/data/characters.ts   baseHP / baseATK / baseDEF / ascension value
//   src/data/levelStats.ts   the per-level curve (hp/atk/def/spec)
//   src/data/talents.ts      the level-10 talent summary (normal/charged/skill/burst)
//
// Every one of those is a transcription of genshin-db, so any drift is a
// transcription bug rather than a modelling choice. This script re-derives all
// three from genshin-db v5.2.13 and prints only the rows that disagree.
//
// Run: node scripts/verify-baseline.mjs            (all characters, mismatches only)
//      node scripts/verify-baseline.mjs baizhu     (one character, full detail)
// ============================================================================

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const gdb = require('genshin-db');

import {
  HIT_COUNT_OVERRIDE,
  NO_TALENT_DATA,
  TALENT_NAME_OVERRIDE,
  groupFor,
  isDamageLabel,
  isPercentFormat,
  parseHits,
  summarize,
} from './lib/talent-rules.mjs';

const focus = (process.argv[2] ?? '').toLowerCase();
const showAll = process.argv.includes('--all');
const LIMIT = showAll ? Infinity : focus ? 50 : 12;

// ---------------------------------------------------------------------------
// Read the three hand-maintained files.
// ---------------------------------------------------------------------------

const charactersSrc = readFileSync(join(root, 'src/data/characters.ts'), 'utf8');
const ROSTER = charactersSrc
  .split('\n')
  .map((line) =>
    line.match(
      /\{ id: '([^']+)', name: '([^']+)', rarity: (\d), element: '(\w+)', weaponType: '(\w+)', baseHP: ([\d.]+), baseATK: ([\d.]+), baseDEF: ([\d.]+), ascension: \{ type: '([\w%]+)', value: ([\d.]+) \}/,
    ),
  )
  .filter(Boolean)
  .map((m) => ({
    id: m[1],
    name: m[2],
    rarity: Number(m[3]),
    element: m[4],
    weaponType: m[5],
    baseHP: Number(m[6]),
    baseATK: Number(m[7]),
    baseDEF: Number(m[8]),
    ascType: m[9],
    ascValue: Number(m[10]),
  }));

const levelSrc = readFileSync(join(root, 'src/data/levelStats.ts'), 'utf8');
const LEVELS = {};
for (const m of levelSrc.matchAll(
  /'([a-z0-9-]+)':\s*\{ levels: \[([^\]]*)\],\s*hp: \[([^\]]*)\],\s*atk: \[([^\]]*)\],\s*def: \[([^\]]*)\],\s*spec: \[([^\]]*)\]/g,
)) {
  const nums = (s) => s.split(',').map((v) => Number(v.trim())).filter((v) => !Number.isNaN(v));
  LEVELS[m[1]] = {
    levels: nums(m[2]),
    hp: nums(m[3]),
    atk: nums(m[4]),
    def: nums(m[5]),
    spec: nums(m[6]),
  };
}

const talentsSrc = readFileSync(join(root, 'src/data/talents.ts'), 'utf8');
const TALENTS = {};
for (const m of talentsSrc.matchAll(
  /'([a-z0-9-]+)': \{ normal: ([\d.]+), charged: ([\d.]+), skill: ([\d.]+), skillLabel: ("(?:[^"\\]|\\.)*"), burst: ([\d.]+), burstLabel: ("(?:[^"\\]|\\.)*") \}/g,
)) {
  const unq = (s) => JSON.parse(s);
  TALENTS[m[1]] = {
    normal: Number(m[2]),
    charged: Number(m[3]),
    skill: Number(m[4]),
    skillLabel: unq(m[5]),
    burst: Number(m[6]),
    burstLabel: unq(m[7]),
  };
}

// ---------------------------------------------------------------------------
// Re-derive the talent summary from genshin-db. The classification rules come
// from scripts/lib/talent-rules.mjs — the same module the generator imports —
// so this verifier can no longer drift away from what it is verifying.
// ---------------------------------------------------------------------------

/** Level-10 (index 9) value of one label, summing its param refs. */
function level10(attributes, index) {
  const [rawLabel, fmt = ''] = (attributes.labels[index] ?? '').split('|');
  const params = fmt.match(/param\d+/g) ?? [];
  if (params.length === 0) return null;
  let sum = 0;
  for (const p of params) {
    const vals = attributes.parameters[p];
    if (vals) sum += vals[9] ?? 0;
  }
  return { label: rawLabel, value: Math.round(sum * 1e6) / 1e6, percent: isPercentFormat(fmt), fmt };
}

function deriveTalents(id, name, weaponType) {
  let t;
  try {
    t = gdb.talents(TALENT_NAME_OVERRIDE[id] ?? name);
  } catch {
    return null;
  }
  if (!t) return null;

  const rows = [];
  for (const combatKey of ['combat1', 'combat2', 'combat3']) {
    const combat = t[combatKey];
    if (!combat?.attributes) continue;
    (combat.attributes.labels ?? []).forEach((_, i) => {
      const hit = level10(combat.attributes, i);
      if (!hit) return;
      rows.push({
        label: hit.label,
        value: hit.value,
        percent: hit.percent,
        hits: HIT_COUNT_OVERRIDE[`${id}:${hit.label}`] ?? parseHits(hit.fmt),
        group: groupFor(hit.label, combatKey, weaponType),
        isDamage: isDamageLabel(hit.label),
      });
    });
  }

  // summarize() wants { values: [..15] }, so give it a level-10 slice.
  const summaryRows = rows.map((r) => ({ ...r, values: Array(15).fill(0).map((_, i) => (i === 9 ? r.value : 0)) }));
  const s = summarize(summaryRows);

  return {
    normal: s.normal,
    charged: s.charged,
    skill: s.skill ? { value: s.skill, label: s.skillLabel } : null,
    burst: s.burst ? { value: s.burst, label: s.burstLabel } : null,
    rows,
  };
}

// ---------------------------------------------------------------------------
// Compare.
// ---------------------------------------------------------------------------

const EPS_STAT = 0.5; // base HP/ATK/DEF are stored as integers
const EPS_ASC = 0.0005; // ascension / spec fractions
const EPS_TAL = 0.002; // talent multipliers (stored to 3 dp)

const mismatches = [];
const detail = [];
const undocumented = [];

for (const c of ROSTER) {
  const db = gdb.characters(c.name);
  if (!db) {
    mismatches.push({ id: c.id, field: 'genshin-db', ours: '—', theirs: 'NOT FOUND' });
    continue;
  }

  const s90 = db.stats(90);
  const expectedAsc = s90.specialized ?? 0;
  const lines = [];

  const check = (field, ours, theirs, eps, note = '') => {
    const bad = ours === null || ours === undefined || Math.abs(ours - theirs) > eps;
    if (bad) mismatches.push({ id: c.id, field, ours, theirs, note });
    lines.push({ field, ours, theirs, bad, note });
  };

  check('baseHP', c.baseHP, Math.round(s90.hp), EPS_STAT);
  check('baseATK', c.baseATK, Math.round(s90.attack), EPS_STAT);
  check('baseDEF', c.baseDEF, Math.round(s90.defense), EPS_STAT);
  check('ascension', c.ascValue, expectedAsc, EPS_ASC);

  const lv = LEVELS[c.id];
  if (!lv) {
    mismatches.push({ id: c.id, field: 'levelStats', ours: 'MISSING', theirs: 'present' });
  } else {
    check('levelStats.hp@90', lv.hp[lv.hp.length - 1], Math.round(s90.hp), EPS_STAT);
    check('levelStats.atk@90', lv.atk[lv.atk.length - 1], Math.round(s90.attack * 100) / 100, 0.02);
    check('levelStats.def@90', lv.def[lv.def.length - 1], Math.round(s90.defense), EPS_STAT);
    check('levelStats.spec@90', lv.spec[lv.spec.length - 1], expectedAsc, EPS_ASC);
  }

  const derived = deriveTalents(c.id, c.name, c.weaponType);
  const ours = TALENTS[c.id];
  if (!derived) {
    // Documented dataset gap (Miliastra test chars): no table exists to
    // generate from, and the UI replaces their numbers with a notice.
    // Listed, not failed — a permanent red gate hides real drift.
    if (NO_TALENT_DATA.includes(c.id)) undocumented.push(c.id);
    else mismatches.push({ id: c.id, field: 'talents', ours: ours ? 'present' : 'MISSING', theirs: 'NOT FOUND' });
  } else if (!ours) {
    mismatches.push({ id: c.id, field: 'talents', ours: 'MISSING', theirs: 'present' });
  } else {
    check('talents.normal', ours.normal, derived.normal, EPS_TAL);
    check('talents.charged', ours.charged, derived.charged, EPS_TAL);
    if (derived.skill) check('talents.skill', ours.skill, derived.skill.value, EPS_TAL, derived.skill.label);
    if (derived.burst) check('talents.burst', ours.burst, derived.burst.value, EPS_TAL, derived.burst.label);
  }

  if (focus && c.id === focus) {
    detail.push({ c, s90, db, lines, derived, ours });
  }
}

// ---------------------------------------------------------------------------
// Report.
// ---------------------------------------------------------------------------

const line = (s = '') => console.log(s);

if (detail.length) {
  for (const d of detail) {
    line('='.repeat(78));
    line(`FULL DETAIL — ${d.c.name} (${d.c.id})`);
    line('='.repeat(78));
    line(
      `genshin-db: rarity ${d.db.rarity} · ${d.db.elementType} · ${d.db.weaponType} · ${d.db.substatType}`,
    );
    line(`stats(90): ${JSON.stringify(d.s90)}`);
    line('');
    line('field                  ours            genshin-db      Δ');
    line('-'.repeat(78));
    for (const l of d.lines) {
      const o = typeof l.ours === 'number' ? l.ours : String(l.ours);
      const t = typeof l.theirs === 'number' ? l.theirs : String(l.theirs);
      const delta =
        typeof l.ours === 'number' && typeof l.theirs === 'number'
          ? (l.ours - l.theirs).toFixed(6)
          : '—';
      line(
        `${l.bad ? 'X ' : '  '}${l.field.padEnd(20)} ${String(o).padEnd(15)} ${String(t).padEnd(15)} ${delta}${l.note ? `  (${l.note})` : ''}`,
      );
    }
    if (d.derived) {
      line('');
      line('Derived damage rows (genshin-db, talent level 10):');
      for (const r of d.derived.rows) {
        line(
          `  ${r.isDamage ? 'DMG' : '   '} ${r.group.padEnd(8)} ${r.label.padEnd(46)} ${r.value}`,
        );
      }
      line('');
      line(`Derived summary: normal=${d.derived.normal} charged=${d.derived.charged}` +
        ` skill=${d.derived.skill?.value} (${d.derived.skill?.label})` +
        ` burst=${d.derived.burst?.value} (${d.derived.burst?.label})`);
    }
    line('');
  }
}

line('='.repeat(78));
line(`BASELINE MISMATCHES — ${mismatches.length} across ${ROSTER.length} characters`);
if (undocumented.length) line(`documented dataset gaps (no genshin-db talent table): ${undocumented.join(', ')}`);
line('='.repeat(78));

const byField = {};
for (const m of mismatches) (byField[m.field] ??= []).push(m);
for (const [field, list] of Object.entries(byField).sort((a, b) => b[1].length - a[1].length)) {
  line('');
  line(`• ${field} — ${list.length} character(s)`);
  for (const m of list.slice(0, LIMIT)) {
    line(
      `    ${m.id.padEnd(20)} ours=${m.ours}  genshin-db=${m.theirs}${m.note ? `  (${m.note})` : ''}`,
    );
  }
  if (list.length > LIMIT) line(`    … and ${list.length - LIMIT} more`);
}

line('');
process.exit(mismatches.length ? 1 : 0);
