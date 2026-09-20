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

export type ReactionKey =
  | 'vaporize'
  | 'melt'
  | 'aggravate'
  | 'spread'
  | 'overload'
  | 'superconduct'
  | 'electroCharged'
  | 'swirl'
  | 'shatter'
  | 'bloom'
  | 'hyperbloom'
  | 'burgeon'
  | 'burning';

export interface BuffState {
  atkPercent: number;
  flatATK: number;
  hpPercent: number;
  flatHP: number;
  defPercent: number;
  flatDEF: number;
  dmgBonus: number;
  /** Base DMG multiplier ("deals X% of original DMG") — multiplies base damage, not the DMG-bonus bucket. */
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
  /** Per-reaction DMG bonus (KQM "ReactionBonus"), keyed by reaction id. */
  reactionBonuses: Partial<Record<ReactionKey, number>>;
  /** Target's damage reduction, subtracted from your DMG bonus. */
  dmgReduction: number;
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
  /** True when the hit is Physical (used for RES and Physical DMG bonus). */
  physical?: boolean;
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

// Hard cap on a single damage instance (damage doc, sections 1 and 10).
const DAMAGE_CAP = 20_000_000;

/** Every character starts with these before any weapon, artifact or buff. */
const BASE_CRIT_RATE = 0.05;
const BASE_CRIT_DMG = 0.5;

/**
 * Level multiplier for transformative / additive reactions.
 *
 * Used to hold only levels 80/85/90 and fell back to the level-90 value for
 * anything else, so a level-60 Bloom was computed as if the character were 90.
 * Now read from the full per-level table.
 */
export function levelMultiplierFor(level: number): number {
  const lv = Math.min(90, Math.max(1, Math.round(level)));
  return REACTION_LEVEL_MULTIPLIER[lv - 1];
}

interface StatBag {
  critRate: number;
  critDMG: number;
  dmgBonus: number;
  physical: number;
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
    physical: 0,
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
      out.dmgBonus = sec.value;
      break;
    case 'physical':
      out.physical = sec.value;
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
  physical: number;
} {
  const critRate = a.subCritRate + (a.circletMain.type === 'critRate' ? a.circletMain.value : 0);
  const critDMG = a.subCritDMG + (a.circletMain.type === 'critDMG' ? a.circletMain.value : 0);
  const atkPercent = a.subATKPercent + (a.sandsMain.type === 'atk%' ? a.sandsMain.value : 0);
  const hpPercent = a.subHPPercent + (a.sandsMain.type === 'hp%' ? a.sandsMain.value : 0);
  const defPercent = (a.subDEFPercent ?? 0) + (a.sandsMain.type === 'def%' ? a.sandsMain.value : 0);
  const em = a.subEM + (a.sandsMain.type === 'em' ? a.sandsMain.value : 0);
  const dmgBonus = a.gobletMain.type === 'dmg%' ? a.gobletMain.value : 0;
  const physical = a.gobletMain.type === 'physical' ? a.gobletMain.value : 0;
  return { critRate, critDMG, atkPercent, hpPercent, defPercent, em, dmgBonus, physical };
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

/**
 * Normal and Charged attacks default to ATK scaling, but a few talents convert
 * them to HP/DEF. Everyone not listed uses ATK for those two attack types.
 */
const ALT_SCALING_ATTACKS: Record<string, Partial<Record<'normal' | 'charged', ScalingStat>>> = {
  neuvillette: { charged: 'hp' },
  noelle: { normal: 'def', charged: 'def' },
  itto: { normal: 'def', charged: 'def' },
};

function resMultiplierFor(rawRes: number, resShred: number): number {
  const res = rawRes - resShred;
  if (res < 0) return 1 - res / 2;
  if (res < 0.75) return 1 - res;
  return 1 / (1 + 4 * res);
}

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
  // genshin-db's level curve reports a CRIT ascension stat including the base
  // crit every character has (Hu Tao's CRIT DMG runs 0.5 -> 0.884). Strip it
  // back out because the base is added for everyone below.
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
  const critRate = Math.min(Math.max(critRateRaw, 0), 1);
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

  // ---- Damage type (Elemental vs Physical) ----
  const isPhysical = input.physical === true;
  const attackElement: ElementType = isPhysical ? 'physical' : character.element;

  // ---- DMG bonus (minus target DMG reduction) ----
  // Physical DMG bonus only applies to physical hits, and vice versa.
  const elementalBonus = art.dmgBonus + w.dmgBonus + ascStat.dmgBonus + buffs.dmgBonus + typeBonus;
  const dmgBonus = elementalBonus + (isPhysical ? art.physical + w.physical : 0);
  const dmgBonusMult = Math.max(0, 1 + dmgBonus - buffs.dmgReduction);

  // ---- Elemental Mastery ----
  const em = art.em + w.em + ascStat.em + buffs.em;

  // ---- Base stat by scaling: per-talent, not per-character ----
  const effectiveScaling: ScalingStat =
    attackType === 'normal' || attackType === 'charged'
      ? (ALT_SCALING_ATTACKS[character.id]?.[attackType] ?? 'atk')
      : scaling;
  const baseStat =
    effectiveScaling === 'def' ? totalDEF : effectiveScaling === 'hp' ? totalHP : effectiveScaling === 'em' ? em : totalATK;

  // ---- Amplified reaction ----
  let reactionMultiplier = 1;
  let reactionName = 'No reaction';
  if (input.amplified !== 'none') {
    const base = amplifyBase(input.amplified, character.element);
    const emBonus = (2.78 * em) / (em + 1400);
    const ampBonus = buffs.reactionBonuses[input.amplified] ?? 0;
    reactionMultiplier = base * (1 + emBonus + buffs.reactionBonus + buffs.ampReactionBonus + ampBonus);
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
    const typeBonusR = buffs.reactionBonuses[input.additive] ?? 0;
    additive =
      base * levelMultiplierFor(charLevel) * (1 + emBonus + buffs.reactionBonus + typeBonusR);
    additiveName = ADDITIVE_NAMES[input.additive];
  }

  // ---- DEF / RES ----
  const defMultiplier = defMultiplierFor(charLevel, enemy.level, buffs.defShred, buffs.defIgnore);
  const rawRes = enemy.resistances[attackElement] ?? enemy.resistances.default;
  const resMultiplier = resMultiplierFor(rawRes, buffs.resShred);

  // ---- Per-hit damage ----
  const baseDamage =
    baseStat * skillMultiplier * (1 + buffs.baseDmgBonus) + additive + buffs.flatBaseDmg;
  const nonCritRaw = baseDamage * dmgBonusMult * reactionMultiplier * defMultiplier * resMultiplier;
  const critHitRaw = nonCritRaw * (1 + critDMG);
  const expectedRaw = nonCritRaw * (1 + critRate * critDMG);
  // A single instance can never exceed the 20M damage cap.
  const nonCrit = Math.min(nonCritRaw, DAMAGE_CAP);
  const critHit = Math.min(critHitRaw, DAMAGE_CAP);
  const expected = Math.min(expectedRaw, DAMAGE_CAP);

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
    const typeBonusT = buffs.reactionBonuses[input.transformative] ?? 0;
    transformative = Math.min(
      base * levelMultiplierFor(charLevel) * (1 + emBonus + buffs.reactionBonus + typeBonusT) * tResMult,
      DAMAGE_CAP,
    );
    transformativeName =
      input.transformative === 'swirl' && input.swirlElement
        ? `Swirl (${input.swirlElement[0].toUpperCase()}${input.swirlElement.slice(1)})`
        : TRANSFORMATIVE_NAMES[input.transformative];
  }

  return {
    scaling: effectiveScaling,
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

// ============================================================================
// Direct-panel calculation — used by the UID import path, where Enka.network
// returns an already-merged stat panel (base + weapon + artifacts combined)
// rather than separated inputs.
// ============================================================================

export interface PanelInput {
  totalATK: number;
  critRate: number;
  critDMG: number;
  dmgBonus: number;
  em: number;
  skillMultiplier: number;
  /** Human label for the talent being shown (optional). */
  skillLabel?: string;
  characterLevel: number;
  enemy: EnemyData;
  element: ElementType;
  amplified: AmplifiedReaction;
  transformative: TransformativeReaction;
  additive?: AdditiveReaction;
  defShred: number;
  resShred: number;
  reactionBonus: number;
  /** Optional scaling support (UID imports may provide HP / DEF panels). */
  scaling?: ScalingStat;
  totalHP?: number;
  totalDEF?: number;
  defIgnore?: number;
  dmgReduction?: number;
}

export interface PanelResult {
  scaling: ScalingStat;
  baseStat: number;
  skillLabel: string;
  nonCrit: number;
  critHit: number;
  expected: number;
  transformative: number;
  transformativeName: string;
  additive: number;
  additiveName: string;
  defMultiplier: number;
  resMultiplier: number;
  reactionMultiplier: number;
  reactionName: string;
  totalHP: number;
  totalDEF: number;
}

export function computeFromPanel(input: PanelInput): PanelResult {
  const { enemy } = input;
  const scaling: ScalingStat = input.scaling ?? 'atk';

  let reactionMultiplier = 1;
  let reactionName = 'No reaction';
  if (input.amplified !== 'none') {
    const base = amplifyBase(input.amplified, input.element);
    const emBonus = (2.78 * input.em) / (input.em + 1400);
    reactionMultiplier = base * (1 + emBonus + input.reactionBonus);
    reactionName =
      input.amplified === 'vaporize'
        ? `Vaporize (×${base.toFixed(1)})`
        : `Melt (×${base.toFixed(1)})`;
  }

  let additive = 0;
  let additiveName = 'None';
  if (input.additive && input.additive !== 'none') {
    const base = ADDITIVE_BASE[input.additive];
    const emBonus = (5 * input.em) / (1200 + input.em);
    additive =
      base * levelMultiplierFor(input.characterLevel) * (1 + emBonus + input.reactionBonus);
    additiveName = ADDITIVE_NAMES[input.additive];
  }

  const defMultiplier = defMultiplierFor(
    input.characterLevel,
    enemy.level,
    input.defShred,
    input.defIgnore ?? 0,
  );
  const rawRes = enemy.resistances[input.element] ?? enemy.resistances.default;
  const resMultiplier = resMultiplierFor(rawRes, input.resShred);

  const totalHP = input.totalHP ?? 0;
  const totalDEF = input.totalDEF ?? 0;
  const baseStat =
    scaling === 'hp' && totalHP > 0
      ? totalHP
      : scaling === 'def' && totalDEF > 0
        ? totalDEF
        : scaling === 'em'
          ? input.em
          : input.totalATK;

  const dmgBonusMult = Math.max(0, 1 + input.dmgBonus - (input.dmgReduction ?? 0));
  const baseDamage = baseStat * input.skillMultiplier + additive;
  const critRate = Math.min(Math.max(input.critRate, 0), 1);
  const nonCritRaw = baseDamage * dmgBonusMult * reactionMultiplier * defMultiplier * resMultiplier;
  const nonCrit = Math.min(nonCritRaw, DAMAGE_CAP);
  const critHit = Math.min(nonCritRaw * (1 + input.critDMG), DAMAGE_CAP);
  const expected = Math.min(nonCritRaw * (1 + critRate * input.critDMG), DAMAGE_CAP);

  let transformative = 0;
  let transformativeName = 'None';
  if (input.transformative !== 'none') {
    const base = TRANSFORMATIVE_BASE[input.transformative];
    const emBonus = (16 * input.em) / (input.em + 2000);
    const reactionElement: ElementType =
      input.transformative === 'overload'
        ? 'pyro'
        : input.transformative === 'superconduct'
          ? 'cryo'
          : input.transformative === 'electroCharged'
            ? 'electro'
            : input.transformative === 'swirl'
              ? input.element
              : input.transformative === 'shatter'
                ? 'physical'
                : input.transformative === 'burning'
                  ? 'pyro'
                  : 'dendro';
    const tRawRes = enemy.resistances[reactionElement] ?? enemy.resistances.default;
    const tResMult = resMultiplierFor(tRawRes, input.resShred);
    transformative = Math.min(
      base * levelMultiplierFor(input.characterLevel) * (1 + emBonus + input.reactionBonus) * tResMult,
      DAMAGE_CAP,
    );
    transformativeName = TRANSFORMATIVE_NAMES[input.transformative];
  }

  return {
    scaling,
    baseStat,
    skillLabel: input.skillLabel ?? 'Signature skill',
    nonCrit,
    critHit,
    expected,
    transformative,
    transformativeName,
    additive,
    additiveName,
    defMultiplier,
    resMultiplier,
    reactionMultiplier,
    reactionName,
    totalHP,
    totalDEF,
  };
}
