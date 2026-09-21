// ============================================================================
// Shared talent-classification rules.
//
// These live in one place because they were previously copy-pasted between
// scripts/generate-talents.mjs and scripts/verify-baseline.mjs, and a verifier
// that re-implements the generator's rules cannot catch a rule bug — it just
// agrees with itself. Both now import from here.
//
// The rules answer, for one genshin-db attribute label:
//   • is it a damage row at all?           isDamageLabel()
//   • which talent group does it belong to? groupFor()
//   • how many instances does it land?      parseHits()
//   • what stat does it scale off?          scalingFromFormat()
//   • is the value a percentage or a flat number? isPercentFormat()
// plus summarize() which folds a character's rows into the TALENTS shape.
// ============================================================================

// ---------------------------------------------------------------------------
// Row classification.
//
// NEVER_DAMAGE lists the wording that marks a row as something other than a
// hit: shields, healing, cooldowns, buff percentages. It is checked first.
//
// It deliberately does NOT veto on "Stack" / "Charges" / "Activation". Those
// words do appear in real damage labels — Lisa's "Stack 3 Conductive Hold DMG"
// is her biggest skill hit, Sayu's "Skill Activation DMG" is her burst's hit —
// and vetoing them silently cost Lisa 35% of her skill multiplier. Rows that
// merely mention stacks without dealing damage ("Maximum Stacks", "Resolve
// Stacks Gained") have no "DMG" in them and fall through to false anyway.
// ---------------------------------------------------------------------------
export const NEVER_DAMAGE = /(Cost|Duration|Interval|Instances|Regeneration|Restored|HP Loss|Increase|Bonus|SPD|Energy|Stamina|Absorption|^CD$)/i;

export function isDamageLabel(label) {
  if (NEVER_DAMAGE.test(label)) return false;
  return (
    /DMG/i.test(label) ||
    /Equitable Judgment/i.test(label) ||
    /Aimed Shot/i.test(label) ||
    /Blood Blossom/i.test(label) ||
    /^Charged Attack$/i.test(label)
  );
}

// ---------------------------------------------------------------------------
// Hit counts for multi-instance attacks (×N). The multiplier stored in the
// dataset is a single instance, so the table multiplies by this count.
//
// Primary source: the format string itself. genshin-db appends the instance
// count to the format token — "{param3:F1P}×2" (Baizhu 3-Hit), "{param1:P}*4"
// (Xiangling 4-Hit), "({param6:F1P} ATK+{param7:F1P} Elemental Mastery)×2"
// (Alhaitham 2-Mirror). 52 labels across 34 characters carry it.
//
// HIT_COUNT_OVERRIDE is the escape hatch for attacks the dataset does NOT mark,
// keyed `${characterId}:${label}`. It wins over the parsed value.
// ---------------------------------------------------------------------------
export const HIT_COUNT_OVERRIDE = {
  'klee:Jumpy Dumpty DMG': 3,
  'klee:Mine DMG': 8,
  "klee:Sparks 'n' Splash DMG": 19,
};

/**
 * Instance count encoded in a genshin-db format token, or 1 when the attack
 * lands once. Only × (U+00D7) and * are real separators — a bare "x" is always
 * part of a word like "Max HP", never a count.
 */
export function parseHits(fmt) {
  const m = fmt.match(/[×*]\s*(\d+)/);
  return m ? Number(m[1]) : 1;
}

// ---------------------------------------------------------------------------
// Talent group.
// ---------------------------------------------------------------------------
export function groupFor(label, combatKey, weaponType) {
  // The bare plunge names are checked before the talent key: Raiden, Cyno,
  // Lohen and Skirk restate the standard plunge inside their skill/burst block
  // (identical values to their own combat1) because their state changes it, and
  // taking that as "the burst's biggest hit" put a 3.16 plunge on top of
  // Raiden's 7.21 Musou no Hitotachi. Named variants are NOT caught here —
  // Mavuika's "Flamestrider Plunge DMG" is genuine skill damage.
  if (/^(Plunge DMG|Low\/High Plunge DMG)$/i.test(label)) return 'plunge';
  if (combatKey === 'combat2') return 'skill';
  if (combatKey === 'combat3') return 'burst';
  if (/Plunge/i.test(label)) return 'plunge';
  if (/Charged|Equitable Judgment/i.test(label)) return 'charged';
  // A bow's combat1 is not just a combo — it holds the whole ranged-shot family,
  // and genshin-db gives each character's charged shot its own payload label:
  //   • the generic charged shot is "Fully-Charged Aimed Shot" for most bows
  //     but "Aimed Shot Charge Level 1" / "Level 1 Aimed Shot" for Ganyu, Lyney
  //     and Sethos — the same attack under two wordings, which used to land in
  //     two different groups
  //   • the payload is named after the kit: Ganyu's Frostflake Arrow + Bloom,
  //     Yelan's Breakthrough Barb, Yoimiya's Kindling Arrow, Tighnari's Wreath
  //     Arrow, Sethos's Shadowpiercing Shot, Venti's Windsunder Arrow …
  // None of it is part of the numbered melee combo, so it all belongs with the
  // Charged Attack. Without this, Ganyu's "Normal Attack combo" was 14.54 —
  // her six melee hits plus every aimed-shot row summed together.
  //
  // Restricted to bows on purpose: the same "not a numbered hit" test applied to
  // swords would sweep up things like Itto's Kesagiri (a Charged Attack under a
  // name the regex above misses) and Xilonen's Blade Roller (genuinely Normal).
  if (weaponType === 'bow' && !/^\d+-Hit DMG$/i.test(label)) return 'charged';
  return 'normal';
}

// ---------------------------------------------------------------------------
// Scaling stat.
//
// The dataset does not carry a scaling field, but its format strings spell the
// stat out when it is not ATK: "{param7:F2P} Max HP" (Yelan's Breakthrough
// Barb), "{param1:P} DEF" (Gorou's burst), "{param10:F1P} DEF" (Xilonen's
// Blade Roller). Reading it back is the only way those rows stop being
// multiplied by ATK.
//
// Only single-stat formats are trusted. A dual-stat row — Alhaitham's
// "{param1:F1P} ATK+{param2:F1P} Elemental Mastery" — genuinely needs both
// terms, which the row model cannot express (one `scaling` per row), so it
// keeps the group-derived fallback rather than silently dropping a term.
// ---------------------------------------------------------------------------
const SCALING_WORDS = [
  [/Max HP/, 'hp'],
  [/Elemental Mastery/, 'em'],
  [/\bDEF\b/, 'def'],
  [/\bATK\b/, 'atk'],
];

export function scalingFromFormat(fmt, fallback) {
  const found = new Set();
  for (const [re, stat] of SCALING_WORDS) if (re.test(fmt)) found.add(stat);
  return found.size === 1 ? [...found][0] : fallback;
}

export function isPercentFormat(fmt) {
  return /P\b/.test(fmt); // F1P / P / P1 all end in a percentage token
}

// ---------------------------------------------------------------------------
// Fold a character's per-hit rows into the TALENTS summary shape, at one talent
// level (index 9 = level 10 by default). `hits` is applied, so a ×N attack
// counts N instances.
// ---------------------------------------------------------------------------
export const SUMMARY_LEVEL_INDEX = 9;

export function summarize(rows, levelIndex = SUMMARY_LEVEL_INDEX) {
  const r3 = (n) => Math.round(n * 1000) / 1000;
  const dmg = rows.filter((r) => r.isDamage);
  const sum = (g) => dmg.filter((r) => r.group === g).reduce((s, r) => s + r.values[levelIndex] * r.hits, 0);
  const best = (g) => {
    let top = null;
    for (const r of dmg.filter((r) => r.group === g)) {
      const v = r.values[levelIndex] * r.hits;
      if (v > 0 && (!top || v > top.v)) top = { v, label: r.label };
    }
    return top;
  };
  const s = best('skill');
  const b = best('burst');
  return {
    normal: r3(sum('normal')),
    charged: r3(sum('charged')),
    skill: s ? r3(s.v) : 0,
    skillLabel: s ? s.label : '',
    burst: b ? r3(b.v) : 0,
    burstLabel: b ? b.label : '',
  };
}
