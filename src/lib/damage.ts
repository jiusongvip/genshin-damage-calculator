// ============================================================================
// Genshin Damage Calculator — core damage engine
// Implements the official damage formula for non-transformative reactions
// (normal / charged / skill / burst hits) plus amplified reactions (vaporize,
// melt) and transformative reactions (overload, etc.).
//
// Formula reference (single hit):
//   Damage = TotalATK * SkillMultiplier * (1 + DMGBonus)
//          * CritMultiplier * ReactionMultiplier
//          * DEFMultiplier * RESMultiplier
//
// Data snapshot: Genshin Impact version 7.0. Base stats are level 90.
// ============================================================================

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
}

export interface BuffState {
  atkPercent: number;
  flatATK: number;
  dmgBonus: number;
  critRate: number;
  critDMG: number;
  em: number;
  defShred: number;
  resShred: number;
  reactionBonus: number;
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
  | 'bloom'
  | 'hyperbloom'
  | 'burgeon';

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
}

export interface DamageResult {
  totalATK: number;
  baseATK: number;
  critRate: number;
  critDMG: number;
  dmgBonus: number;
  em: number;
  defMultiplier: number;
  resMultiplier: number;
  reactionMultiplier: number;
  reactionName: string;
  nonCrit: number;
  critHit: number;
  expected: number;
  transformative: number;
  transformativeName: string;
}

const AMPLIFY_BASE: Record<Exclude<AmplifiedReaction, 'none'>, number> = {
  vaporize: 1.5,
  melt: 2.0,
};

// Transformative reaction base multipliers (level-independent coefficient).
const TRANSFORMATIVE_BASE: Record<Exclude<TransformativeReaction, 'none'>, number> = {
  overload: 4,
  superconduct: 1,
  electroCharged: 4.8,
  swirl: 1.2,
  bloom: 4,
  hyperbloom: 6,
  burgeon: 6,
};

// Level multiplier for transformative reactions (character level -> coefficient).
const LEVEL_MULTIPLIER: Record<number, number> = {
  80: 1077.44,
  85: 1285.43,
  90: 1446.85,
};

export function levelMultiplierFor(level: number): number {
  return LEVEL_MULTIPLIER[level] ?? LEVEL_MULTIPLIER[90];
}

function statFromAscension(
  asc: { type: SecondaryStatType; value: number },
): { critRate: number; critDMG: number; dmgBonus: number; atkPercent: number } {
  const out = { critRate: 0, critDMG: 0, dmgBonus: 0, atkPercent: 0 };
  if (asc.type === 'critRate') out.critRate = asc.value;
  if (asc.type === 'critDMG') out.critDMG = asc.value;
  if (asc.type === 'dmg%') out.dmgBonus = asc.value;
  if (asc.type === 'atk%') out.atkPercent = asc.value;
  return out;
}

function statFromWeapon(
  sec: { type: SecondaryStatType; value: number },
): { critRate: number; critDMG: number; atkPercent: number; em: number; dmgBonus: number } {
  const out = { critRate: 0, critDMG: 0, atkPercent: 0, em: 0, dmgBonus: 0 };
  if (sec.type === 'critRate') out.critRate = sec.value;
  if (sec.type === 'critDMG') out.critDMG = sec.value;
  if (sec.type === 'atk%') out.atkPercent = sec.value;
  if (sec.type === 'em') out.em = sec.value;
  if (sec.type === 'physical') out.dmgBonus = sec.value;
  return out;
}

/** Sum all flat & percent artifact mains + subs into a single stat bag. */
function collectArtifactStats(a: ArtifactBuild): {
  critRate: number;
  critDMG: number;
  atkPercent: number;
  em: number;
  dmgBonus: number;
  hpPercent: number;
} {
  const critRate = a.subCritRate + (a.circletMain.type === 'critRate' ? a.circletMain.value : 0);
  const critDMG = a.subCritDMG + (a.circletMain.type === 'critDMG' ? a.circletMain.value : 0);
  let atkPercent = a.subATKPercent + (a.sandsMain.type === 'atk%' ? a.sandsMain.value : 0);
  const em = a.subEM + (a.sandsMain.type === 'em' ? a.sandsMain.value : 0);
  let dmgBonus = a.gobletMain.type === 'dmg%' ? a.gobletMain.value : 0;
  let hpPercent = a.subHPPercent + (a.sandsMain.type === 'hp%' ? a.sandsMain.value : 0);
  return { critRate, critDMG, atkPercent, em, dmgBonus, hpPercent };
}

export function computeDamage(input: DamageInput): DamageResult {
  const { character, weapon, artifacts, buffs, enemy } = input;
  const charLevel = input.characterLevel ?? 90;

  const asc = statFromAscension(character.ascension);
  const w = statFromWeapon(weapon.secondary);
  const art = collectArtifactStats(artifacts);

  // ---- Total ATK ----
  const baseATK = character.baseATK + weapon.baseATK;
  const atkPercent = art.atkPercent + w.atkPercent + asc.atkPercent + buffs.atkPercent;
  const totalATK = baseATK * (1 + atkPercent) + buffs.flatATK;

  // ---- Crit multiplier (expected, capped crit rate) ----
  const critRate = Math.min(art.critRate + w.critRate + asc.critRate + buffs.critRate, 1);
  const critDMG = art.critDMG + w.critDMG + asc.critDMG + buffs.critDMG;

  // ---- DMG bonus multiplier ----
  const dmgBonus = art.dmgBonus + w.dmgBonus + asc.dmgBonus + buffs.dmgBonus;

  // ---- Reaction multiplier (amplified) ----
  const em = art.em + w.em + buffs.em;
  let reactionMultiplier = 1;
  let reactionName = 'No reaction';
  if (input.amplified !== 'none') {
    const base = AMPLIFY_BASE[input.amplified];
    const emBonus = (2.78 * em) / (em + 1400);
    reactionMultiplier = base * (1 + emBonus + buffs.reactionBonus);
    reactionName =
      input.amplified === 'vaporize' ? 'Vaporize (×1.5)' : 'Melt (×2.0)';
  }

  // ---- DEF multiplier ----
  const defMultiplier =
    (charLevel + 100) / (charLevel + 100 + (enemy.level + 100) * (1 - buffs.defShred));

  // ---- RES multiplier ----
  const rawRes =
    enemy.resistances[character.element] ?? enemy.resistances.default;
  const res = rawRes - buffs.resShred;
  let resMultiplier: number;
  if (res < 0) resMultiplier = 1 - res / 2;
  else if (res < 0.75) resMultiplier = 1 - res;
  else resMultiplier = 1 / (1 + 4 * res);

  // ---- Single hit (no crit) then crit & expected ----
  const nonCrit =
    totalATK *
    character.skillMultiplier *
    (1 + dmgBonus) *
    reactionMultiplier *
    defMultiplier *
    resMultiplier;

  const critHit = nonCrit * (1 + critDMG);
  const expected = nonCrit * (1 + critRate * critDMG);

  // ---- Transformative reaction ----
  let transformative = 0;
  let transformativeName = 'None';
  if (input.transformative !== 'none') {
    const base = TRANSFORMATIVE_BASE[input.transformative];
    const emBonus = (16 * em) / (em + 2000);
    transformative =
      levelMultiplierFor(charLevel) *
      base *
      (1 + emBonus + buffs.reactionBonus) *
      resMultiplier;
    const names: Record<Exclude<TransformativeReaction, 'none'>, string> = {
      overload: 'Overload',
      superconduct: 'Superconduct',
      electroCharged: 'Electro-Charged',
      swirl: 'Swirl',
      bloom: 'Bloom',
      hyperbloom: 'Hyperbloom',
      burgeon: 'Burgeon',
    };
    transformativeName = names[input.transformative];
  }

  return {
    totalATK,
    baseATK,
    critRate,
    critDMG,
    dmgBonus,
    em,
    defMultiplier,
    resMultiplier,
    reactionMultiplier,
    reactionName,
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
  characterLevel: number;
  enemy: EnemyData;
  element: ElementType;
  amplified: AmplifiedReaction;
  transformative: TransformativeReaction;
  defShred: number;
  resShred: number;
  reactionBonus: number;
}

export interface PanelResult {
  nonCrit: number;
  critHit: number;
  expected: number;
  transformative: number;
  transformativeName: string;
  defMultiplier: number;
  resMultiplier: number;
  reactionMultiplier: number;
  reactionName: string;
}

export function computeFromPanel(input: PanelInput): PanelResult {
  const { enemy } = input;

  let reactionMultiplier = 1;
  let reactionName = 'No reaction';
  if (input.amplified !== 'none') {
    const base = AMPLIFY_BASE[input.amplified];
    const emBonus = (2.78 * input.em) / (input.em + 1400);
    reactionMultiplier = base * (1 + emBonus + input.reactionBonus);
    reactionName = input.amplified === 'vaporize' ? 'Vaporize (×1.5)' : 'Melt (×2.0)';
  }

  const defMultiplier =
    (input.characterLevel + 100) /
    (input.characterLevel + 100 + (enemy.level + 100) * (1 - input.defShred));

  const rawRes = enemy.resistances[input.element] ?? enemy.resistances.default;
  const res = rawRes - input.resShred;
  let resMultiplier: number;
  if (res < 0) resMultiplier = 1 - res / 2;
  else if (res < 0.75) resMultiplier = 1 - res;
  else resMultiplier = 1 / (1 + 4 * res);

  const nonCrit =
    input.totalATK *
    input.skillMultiplier *
    (1 + input.dmgBonus) *
    reactionMultiplier *
    defMultiplier *
    resMultiplier;

  const critHit = nonCrit * (1 + input.critDMG);
  const expected = nonCrit * (1 + input.critRate * input.critDMG);

  let transformative = 0;
  let transformativeName = 'None';
  if (input.transformative !== 'none') {
    const base = TRANSFORMATIVE_BASE[input.transformative];
    const emBonus = (16 * input.em) / (input.em + 2000);
    transformative =
      levelMultiplierFor(input.characterLevel) *
      base *
      (1 + emBonus + input.reactionBonus) *
      resMultiplier;
    const names: Record<Exclude<TransformativeReaction, 'none'>, string> = {
      overload: 'Overload',
      superconduct: 'Superconduct',
      electroCharged: 'Electro-Charged',
      swirl: 'Swirl',
      bloom: 'Bloom',
      hyperbloom: 'Hyperbloom',
      burgeon: 'Burgeon',
    };
    transformativeName = names[input.transformative];
  }

  return {
    nonCrit,
    critHit,
    expected,
    transformative,
    transformativeName,
    defMultiplier,
    resMultiplier,
    reactionMultiplier,
    reactionName,
  };
}
