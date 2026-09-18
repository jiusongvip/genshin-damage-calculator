// ============================================================================
// Genshin Damage Calculator — core damage engine
//
// Implements the KQM-verified general damage formula:
//
//   DMG = ( Σ(BaseDMG × BaseDMGMultiplier) + AdditiveBaseDMGBonus )
//         × (1 + DMGBonus − TargetDMGReduction)
//         × CRIT
//         × EnemyDefMult
//         × EnemyResMult
//         × AmplifyingReaction
//
// Supported:
//   • Four base-scaling stats — ATK / DEF / Max HP / EM
//   • Amplifying reactions (Vaporize / Melt, forward AND reverse)
//   • Transformative reactions (Overload, Superconduct, Electro-Charged,
//     Swirl, Bloom, Hyperbloom, Burgeon) with KQM coefficients
//   • Additive reactions (Aggravate / Spread)
//   • DEF reduction + DEF ignore, target DMG reduction
//
// Reference: KQM Theorycrafting Library — Combat Mechanics / Damage Formula.
// Data snapshot: Genshin Impact version 7.0. Base stats are level 90.
// ============================================================================

import { signatureTalent } from '../data/talents';
import type { TalentKey } from '../data/talents';
import { baseStatsAt } from '../data/levelStats';
import { REACTION_LEVEL_MULTIPLIER } from '../data/reactionLevel';

export type ElementType =
  | 'pyro'
  | 'hydro'
  | 'electro'
  | 'cryo'
  | 'anemo'
  | 'geo'
  | 'dendro'
  | 'physical';

export type SecondaryStatType =
  | 'atk%'
  | 'hp%'
  | 'def%'
  | 'critRate'
  | 'critDMG'
  | 'em'
  | 'er'
  | 'physical'
  | 'dmg%';

/** Which stat a talent's damage scales off. */
export type ScalingStat = 'atk' | 'def' | 'hp' | 'em';

/** A character's fixed, level-independent identity. Base stats are level 90. */
export interface CharacterData {
  id: string;
  name: string;
  /** Star rarity — drives 4-star vs 5-star tiering and sorting. */
  rarity: 4 | 5;
  element: ElementType;
  weaponType: string;
  baseHP: number;
  baseATK: number;
  baseDEF: number;
  /** Ascension bonus stat granted at 80/90. */
  ascension: { type: SecondaryStatType; value: number };
  /** Which stat the signature skill scales off (defaults to ATK). */
  scaling?: ScalingStat;
  /** Signature skill used as the demo multiplier for the preset panel. */
  skillName: string;
  skillMultiplier: number;
  /** Recommended build shown in the preset table. */
  bestWeapon: string;
  bestArtifacts: string;
  /** Short tagline for the preset card. */
  note: string;
  /**
   * Not in the live game yet, so the stats and multipliers are unverified.
   * Flagged characters are kept off the site entirely (see RELEASED_CHARACTERS)
   * so an unreleased guess never reads as a measured number. Check the flag
   * against a release list when adding one — it goes stale the day the
   * character ships.
   */
  unreleased?: true;
}

export interface WeaponData {
  id: string;
  name: string;
  weaponType: string;
  rarity: 4 | 5;
  baseATK: number;
  secondary: { type: SecondaryStatType; value: number };
}

/** A full set of main stats + a reasonable roll of sub stats (for presets). */
export interface ArtifactBuild {
  sandsMain: { type: SecondaryStatType; value: number };
  gobletMain: { type: SecondaryStatType; value: number };
  circletMain: { type: SecondaryStatType; value: number };
  subCritRate: number;
  subCritDMG: number;
  subATKPercent: number;
  subEM: number;
  subER: number;
  subHPPercent: number;
  subDEFPercent?: number;
}

export interface BuffState {
  atkPercent: number;
  flatATK: number;
  hpPercent: number;
  flatHP: number;
  defPercent: number;
  flatDEF: number;
  dmgBonus: number;
  /**
   * Base DMG multiplier ("deals X% of original DMG"). Multiplies the base
   * damage itself and is NOT part of the additive DMG-bonus bucket — this is
   * the `BaseDMGMultiplier` term in the formula above (damage doc, section 3.1).
   */
  baseDmgBonus: number;
  /** Flat base damage added after the base-DMG multiplier (non-catalyze). */
  flatBaseDmg: number;
  /** Attack-type DMG bonus — applies only to the matching attack (sets/weapons). */
  naDmgBonus: number;
  caDmgBonus: number;
  skillDmgBonus: number;
  burstDmgBonus: number;
  critRate: number;
  critDMG: number;
  em: number;
  /** Enemy DEF reduction (capped at 90%). */
  defShred: number;
  /** Enemy DEF ignore (multiplicative with reduction). */
  defIgnore: number;
  /** Enemy resistance reduction. */
  resShred: number;
  /** Generic reaction bonus (amplifying + transformative + additive). */
  reactionBonus: number;
  /** Extra bonus that applies only to amplifying reactions (Vaporize / Melt). */
  ampReactionBonus: number;
  /** Extra bonus that applies only to transformative / additive reactions. */
  transformReactionBonus: number;
  /** Target's damage reduction, subtracted from your DMG bonus. */
  dmgReduction: number;
}

/**
 * Fold buff sources into one state. Every field is additive in-game — two
 * RES-shred sources stack (Kazuha's 40% + Zhongli's 20% = 60%), as do ATK%
 * from a Bennett burst and a Pyro resonance. Overwriting instead of adding
 * would silently drop every source but the last, and make the result depend
 * on the order the sources were listed in.
 */
export function addBuffs(base: BuffState, ...patches: Partial<BuffState>[]): BuffState {
  const merged: BuffState = { ...base };
  for (const patch of patches) {
    for (const key of Object.keys(patch) as (keyof BuffState)[]) {
      merged[key] = (merged[key] ?? 0) + (patch[key] ?? 0);
    }
  }
  return merged;
}

export interface EnemyData {
  id: string;
  name: string;
  level: number;
  /** Resistance per element; `default` applies to unlisted elements. */
  resistances: { default: number } & Partial<Record<ElementType, number>>;
}

export type AmplifiedReaction = 'none' | 'vaporize' | 'melt';

export type TransformativeReaction =
  | 'none'
  | 'overload'
  | 'superconduct'
  | 'electroCharged'
  | 'swirl'
  | 'shatter'
  | 'bloom'
  | 'hyperbloom'
  | 'burgeon'
  | 'burning';

export type AdditiveReaction = 'none' | 'aggravate' | 'spread';

export interface DamageInput {
  character: CharacterData;
  weapon: WeaponData;
  artifacts: ArtifactBuild;
  buffs: BuffState;
  enemy: EnemyData;
  /** Character level used for the DEF multiplier (defaults to 90). */
  characterLevel?: number;
  /** Reaction applied to this hit (amplified). */
  amplified: AmplifiedReaction;
  /** Transformative reaction triggered in the same calculation. */
  transformative: TransformativeReaction;
  /** Additive reaction (Aggravate / Spread) added to the base damage. */
  additive?: AdditiveReaction;
  /** Element a Swirl absorbs; its damage is of that element, not Anemo. */
  swirlElement?: ElementType;
  /** Override the talent multiplier (defaults to the character's signature). */
  skillMultiplier?: number;
  /** Which attack the hit represents — drives attack-type DMG bonuses. */
  attackType?: TalentKey;
}

export interface DamageResult {
  /** The stat the signature skill scales off. */
  scaling: ScalingStat;
  /** Value of the scaling stat (total ATK / DEF / HP / EM). */
  baseStat: number;
  /** Talent multiplier actually used for this hit. */
  skillMultiplier: number;
  /** Human label for that talent, e.g. "Elemental Burst · Low HP Skill DMG". */
  skillLabel: string;
  totalATK: number;
  baseATK: number;
  totalHP: number;
  totalDEF: number;
  critRate: number;
  /** Crit rate before the 100% cap — lets the UI flag wasted crit. */
  critRateRaw: number;
  critDMG: number;
  dmgBonus: number;
  /** Base DMG multiplier applied (baseDmg%). */
  baseDmgBonus: number;
  em: number;
  defMultiplier: number;
  resMultiplier: number;
  reactionMultiplier: number;
  reactionName: string;
  /** Flat additive-reaction damage folded into the base. */
  additive: number;
  additiveName: string;
  nonCrit: number;
  critHit: number;
  expected: number;
  transformative: number;
  transformativeName: string;
}

/**
 * Forward/reverse amplifying multipliers.
 *   Vaporize: Hydro triggers on Pyro aura → 2.0, Pyro on Hydro → 1.5.
 *   Melt:     Pyro triggers on Cryo aura  → 2.0, Cryo on Pyro  → 1.5.
 */
const AMPLIFY_BASE: Record<Exclude<AmplifiedReaction, 'none'>, { hydro?: number; pyro?: number; cryo?: number; default: number }> = {
  vaporize: { hydro: 2.0, pyro: 1.5, default: 1.5 },
  melt: { pyro: 2.0, cryo: 1.5, default: 1.5 },
};

function amplifyBase(reaction: Exclude<AmplifiedReaction, 'none'>, element: ElementType): number {
  const table = AMPLIFY_BASE[reaction];
  return (table as Record<string, number>)[element] ?? table.default;
}

// Transformative reaction coefficients (KQM TCL).
const TRANSFORMATIVE_BASE: Record<Exclude<TransformativeReaction, 'none'>, number> = {
  overload: 2.75,
  superconduct: 1.5,
  electroCharged: 2,
  swirl: 0.6,
  shatter: 3,
  bloom: 2,
  hyperbloom: 3,
  burgeon: 3,
  burning: 0.25,
};

const TRANSFORMATIVE_NAMES: Record<Exclude<TransformativeReaction, 'none'>, string> = {
  overload: 'Overload',
  superconduct: 'Superconduct',
  electroCharged: 'Electro-Charged',
  swirl: 'Swirl',
  shatter: 'Shatter',
  bloom: 'Bloom',
  hyperbloom: 'Hyperbloom',
  burgeon: 'Burgeon',
  burning: 'Burning',
};

// Additive (Catalyze) reaction coefficients (KQM TCL).
const ADDITIVE_BASE: Record<Exclude<AdditiveReaction, 'none'>, number> = {
  aggravate: 1.15,
  spread: 1.25,
};

const ADDITIVE_NAMES: Record<Exclude<AdditiveReaction, 'none'>, string> = {
  aggravate: 'Aggravate',
  spread: 'Spread',
};

/**
 * Level multiplier for transformative / additive reactions.
 *
 * This used to hold only levels 80, 85 and 90 and fell back to the level-90
 * value for anything else, so a level-60 character's Bloom was computed as if
 * they were level 90 (x2.9 too high). The level-85 entry was also wrong
 * (1285.43 instead of 1253.84). Now read from the full per-level table.
 */
export function levelMultiplierFor(level: number): number {
  const lv = Math.min(90, Math.max(1, Math.round(level)));
  return REACTION_LEVEL_MULTIPLIER[lv - 1];
}

/** Every character starts with these before any weapon, artifact or buff. */
const BASE_CRIT_RATE = 0.05;
const BASE_CRIT_DMG = 0.5;

interface StatBag {
  critRate: number;
  critDMG: number;
  dmgBonus: number;
  atkPercent: number;
  hpPercent: number;
  defPercent: number;
  em: number;
  er: number;
}

/** Split a secondary-stat / ascension-stat into a flat stat bag. */
function statBag(sec: { type: SecondaryStatType; value: number }): StatBag {
  const out: StatBag = {
    critRate: 0,
    critDMG: 0,
    dmgBonus: 0,
    atkPercent: 0,
    hpPercent: 0,
    defPercent: 0,
    em: 0,
    er: 0,
  };
  switch (sec.type) {
    case 'critRate':
      out.critRate = sec.value;
      break;
    case 'critDMG':
      out.critDMG = sec.value;
      break;
    case 'dmg%':
    case 'physical':
      out.dmgBonus = sec.value;
      break;
    case 'atk%':
      out.atkPercent = sec.value;
      break;
    case 'hp%':
      out.hpPercent = sec.value;
      break;
    case 'def%':
      out.defPercent = sec.value;
      break;
    case 'em':
      out.em = sec.value;
      break;
    case 'er':
      out.er = sec.value;
      break;
  }
  return out;
}

/** Sum all flat & percent artifact mains + subs into a single stat bag. */
function collectArtifactStats(a: ArtifactBuild): {
  critRate: number;
  critDMG: number;
  atkPercent: number;
  hpPercent: number;
  defPercent: number;
  em: number;
  dmgBonus: number;
} {
  const critRate = a.subCritRate + (a.circletMain.type === 'critRate' ? a.circletMain.value : 0);
  const critDMG = a.subCritDMG + (a.circletMain.type === 'critDMG' ? a.circletMain.value : 0);
  const atkPercent = a.subATKPercent + (a.sandsMain.type === 'atk%' ? a.sandsMain.value : 0);
  const hpPercent = a.subHPPercent + (a.sandsMain.type === 'hp%' ? a.sandsMain.value : 0);
  const defPercent = (a.subDEFPercent ?? 0) + (a.sandsMain.type === 'def%' ? a.sandsMain.value : 0);
  const em = a.subEM + (a.sandsMain.type === 'em' ? a.sandsMain.value : 0);
  const dmgBonus = a.gobletMain.type === 'dmg%' ? a.gobletMain.value : 0;
  return { critRate, critDMG, atkPercent, hpPercent, defPercent, em, dmgBonus };
}

function defMultiplierFor(
  charLevel: number,
  enemyLevel: number,
  defReduction: number,
  defIgnore: number,
): number {
  const reduction = Math.min(Math.max(defReduction, 0), 0.9);
  const ignore = Math.min(Math.max(defIgnore, 0), 1);
  return (
    (charLevel + 100) /
    ((charLevel + 100) + (enemyLevel + 100) * (1 - reduction) * (1 - ignore))
  );
}

function resMultiplierFor(rawRes: number, resShred: number): number {
  const res = rawRes - resShred;
  if (res < 0) return 1 - res / 2;
  if (res < 0.75) return 1 - res;
  return 1 / (1 + 4 * res);
}

/**
 * Characters whose Normal or Charged attacks scale off something other than
 * ATK, because a talent converts them. Everyone not listed here uses ATK for
 * those two attack types, which is the game's default.
 *
 * Deliberately short: each entry is a claim about the live game and should be
 * verified against the character's talent text before being added.
 */
const ALT_SCALING_ATTACKS: Record<string, Partial<Record<'normal' | 'charged', ScalingStat>>> = {
  // Charged Attack: Equitable Judgment scales off Max HP.
  neuvillette: { charged: 'hp' },
  // Ayato is deliberately absent: his Shunsuiken normals scale off ATK *plus* a
  // Max-HP bonus, and modelling them as pure HP overstated him ~3x. Until the
  // model can express two scaling stats at once, ATK alone is the closer answer.
  // Sweeping Time converts Noelle's normals and charged attacks to DEF.
  noelle: { normal: 'def', charged: 'def' },
  // Arataki Kesagiri — Itto's normals scale off DEF.
  itto: { normal: 'def', charged: 'def' },
};

export function computeDamage(input: DamageInput): DamageResult {
  const { character, weapon, artifacts, buffs, enemy } = input;
  const charLevel = input.characterLevel ?? 90;
  const scaling: ScalingStat = character.scaling ?? 'atk';

  const w = statBag(weapon.secondary);
  const art = collectArtifactStats(artifacts);

  // Base stats scale with level (and the ascension stat jumps at each phase).
  const curve = baseStatsAt(character.id, charLevel);
  const baseHP = curve?.hp ?? character.baseHP;
  const baseATK = curve?.atk ?? character.baseATK;
  const baseDEF = curve?.def ?? character.baseDEF;
  // genshin-db's level curve reports a CRIT ascension stat *including* the
  // base crit every character has: Hu Tao's CRIT DMG runs 0.5 -> 0.884, a CRIT
  // Rate curve runs 0.05 -> 0.242. Strip that back out, because the base is
  // now added for everyone below; before, only these characters had it, so
  // 81 of 122 characters were missing both 5% CRIT Rate and 50% CRIT DMG.
  const ascType = character.ascension.type;
  const bakedBase = curve ? (ascType === 'critRate' ? BASE_CRIT_RATE : ascType === 'critDMG' ? BASE_CRIT_DMG : 0) : 0;
  const ascStat = statBag({ type: ascType, value: (curve?.spec ?? character.ascension.value) - bakedBase });

  // ---- Total ATK / DEF / Max HP ----
  const baseATKTotal = baseATK + weapon.baseATK;
  const totalATK =
    baseATKTotal *
      (1 + art.atkPercent + w.atkPercent + ascStat.atkPercent + buffs.atkPercent) +
    buffs.flatATK;

  const totalDEF =
    baseDEF * (1 + art.defPercent + w.defPercent + ascStat.defPercent + buffs.defPercent) +
    buffs.flatDEF;

  const totalHP =
    baseHP * (1 + art.hpPercent + w.hpPercent + ascStat.hpPercent + buffs.hpPercent) +
    buffs.flatHP;

  // ---- Crit ----
  const critRateRaw = BASE_CRIT_RATE + art.critRate + w.critRate + ascStat.critRate + buffs.critRate;
  const critRate = Math.min(critRateRaw, 1);
  const critDMG = BASE_CRIT_DMG + art.critDMG + w.critDMG + ascStat.critDMG + buffs.critDMG;

  // ---- Attack type (drives type-specific DMG bonuses from sets / weapons) ----
  const sig = input.skillMultiplier == null ? signatureTalent(character.id) : undefined;
  const skillMultiplier = input.skillMultiplier ?? sig?.multiplier ?? character.skillMultiplier;
  const skillLabel = sig ? `${sig.label}${sig.detail ? ` · ${sig.detail}` : ''}` : character.skillName;
  const attackType: TalentKey = input.attackType ?? sig?.key ?? 'burst';
  const typeBonus =
    attackType === 'normal'
      ? buffs.naDmgBonus
      : attackType === 'charged'
        ? buffs.caDmgBonus
        : attackType === 'skill'
          ? buffs.skillDmgBonus
          : buffs.burstDmgBonus;

  // ---- DMG bonus (minus target DMG reduction) ----
  const dmgBonus = art.dmgBonus + w.dmgBonus + ascStat.dmgBonus + buffs.dmgBonus + typeBonus;
  const dmgBonusMult = Math.max(0, 1 + dmgBonus - buffs.dmgReduction);

  // ---- Elemental Mastery ----
  const em = art.em + w.em + ascStat.em + buffs.em;

  // ---- Base stat by scaling ----
  // `character.scaling` describes the talent the character is *known* for, but
  // scaling is a property of the talent, not of the character: Furina's Skill
  // scales off Max HP while her Normal Attacks still scale off ATK. Applying
  // one character-wide stat to every talent put ~40k HP behind a normal-attack
  // combo and pushed healers to the top of the damage ranking, so Normal and
  // Charged attacks fall back to ATK unless the character is a known exception.
  const effectiveScaling: ScalingStat =
    attackType === 'normal' || attackType === 'charged'
      ? (ALT_SCALING_ATTACKS[character.id]?.[attackType] ?? 'atk')
      : scaling;
  const baseStat =
    effectiveScaling === 'def'
      ? totalDEF
      : effectiveScaling === 'hp'
        ? totalHP
        : effectiveScaling === 'em'
          ? em
          : totalATK;

  // ---- Amplified reaction ----
  let reactionMultiplier = 1;
  let reactionName = 'No reaction';
  if (input.amplified !== 'none') {
    const base = amplifyBase(input.amplified, character.element);
    const emBonus = (2.78 * em) / (em + 1400);
    reactionMultiplier = base * (1 + emBonus + buffs.reactionBonus + buffs.ampReactionBonus);
    reactionName =
      input.amplified === 'vaporize'
        ? `Vaporize (×${base.toFixed(1)})`
        : `Melt (×${base.toFixed(1)})`;
  }

  // ---- Additive reaction (Aggravate / Spread) ----
  let additive = 0;
  let additiveName = 'None';
  if (input.additive && input.additive !== 'none') {
    const base = ADDITIVE_BASE[input.additive];
    const emBonus = (5 * em) / (1200 + em);
    additive =
      base * levelMultiplierFor(charLevel) * (1 + emBonus + buffs.reactionBonus + buffs.transformReactionBonus);
    additiveName = ADDITIVE_NAMES[input.additive];
  }

  // ---- DEF / RES ----
  const defMultiplier = defMultiplierFor(charLevel, enemy.level, buffs.defShred, buffs.defIgnore);
  const rawRes = enemy.resistances[character.element] ?? enemy.resistances.default;
  const resMultiplier = resMultiplierFor(rawRes, buffs.resShred);

  // ---- Per-hit damage ----
  // BaseDmg = (stat × multiplier) × (1 + baseDmg%) + catalyze + flat additive.
  const baseDamage =
    baseStat * skillMultiplier * (1 + buffs.baseDmgBonus) + additive + buffs.flatBaseDmg;
  const nonCrit =
    baseDamage * dmgBonusMult * reactionMultiplier * defMultiplier * resMultiplier;
  const critHit = nonCrit * (1 + critDMG);
  const expected = nonCrit * (1 + critRate * critDMG);

  // ---- Transformative reaction ----
  let transformative = 0;
  let transformativeName = 'None';
  if (input.transformative !== 'none') {
    const base = TRANSFORMATIVE_BASE[input.transformative];
    const emBonus = (16 * em) / (em + 2000);
    // Transformative reactions use the RES of the element the reaction deals.
    const reactionElement: ElementType =
      input.transformative === 'overload'
        ? 'pyro'
        : input.transformative === 'superconduct'
          ? 'cryo'
          : input.transformative === 'electroCharged'
            ? 'electro'
            : input.transformative === 'swirl'
              ? (input.swirlElement ?? character.element)
              : input.transformative === 'shatter'
                ? 'physical'
                : input.transformative === 'burning'
                  ? 'pyro'
                  : 'dendro';
    const tRawRes = enemy.resistances[reactionElement] ?? enemy.resistances.default;
    const tResMult = resMultiplierFor(tRawRes, buffs.resShred);
    transformative =
      base * levelMultiplierFor(charLevel) * (1 + emBonus + buffs.reactionBonus + buffs.transformReactionBonus) * tResMult;
    transformativeName =
      input.transformative === 'swirl' && input.swirlElement
        ? `Swirl (${input.swirlElement[0].toUpperCase()}${input.swirlElement.slice(1)})`
        : TRANSFORMATIVE_NAMES[input.transformative];
  }

  return {
    scaling,
    baseStat,
    skillMultiplier,
    skillLabel,
    totalATK,
    baseATK: baseATKTotal,
    totalHP,
    totalDEF,
    critRate,
    critRateRaw,
    critDMG,
    dmgBonus,
    baseDmgBonus: buffs.baseDmgBonus,
    em,
    defMultiplier,
    resMultiplier,
    reactionMultiplier,
    reactionName,
    additive,
    additiveName,
    nonCrit,
    critHit,
    expected,
    transformative,
    transformativeName,
  };
}

/** Human-friendly number formatter (1 decimal, thousands separators). */
export function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.round(n));
}

export function formatPercent(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}
