import { RELEASED_CHARACTERS as CHARACTERS } from '../../data/characters';
import { ENEMIES } from '../../data/enemies';
import { MAIN_STATS, resolvePreset } from '../../data/presets';
import { signatureTalent } from '../../data/talents';
import type { TalentKey } from '../../data/talents';
import { talentRowsFor } from '../../data/generated/talents';
import type { TalentGroup } from '../../data/generated/talents';
import { CONSTELLATION_TALENT_BONUS } from '../../data/generated/constellationTalents';
import type {
  AdditiveReaction,
  AmplifiedReaction,
  ArtifactBuild,
  ElementType,
  ScalingStat,
  SecondaryStatType,
  TransformativeReaction,
} from '../../lib/damage';

/**
 * The editable state of the calculator, plus every pure helper that reads or
 * repairs it. Split out of SingleCalculator.tsx so the view file is about the
 * view; nothing here imports React.
 */

export type CritMode = 'expected' | 'crit' | 'nonCrit';

/** Everything the user can edit, in one object so URL save/restore is trivial. */
export interface Draft {
  charId: string;
  level: number;
  weaponId: string;
  /** Weapon refinement rank 1-5. */
  weaponRefine: number;
  /** Selected passive stack count (0..maxStacks). */
  weaponStacks: number;
  enemyId: string;
  customEnemy: boolean;
  enemyLevel: number;
  /** Per-element resistance overrides on top of the selected enemy preset. */
  enemyResMap: Partial<Record<ElementType, number>>;
  attackType: TalentKey;
  skillMult: number;
  /** Per-talent levels (1-15). Charged/Plunge share the Normal level. */
  talentLevels: { normal: number; skill: number; burst: number };
  /** Row currently loaded from the damage table, if any. */
  activeRowId: string | null;
  /** Element / scaling overrides set by the picked row. */
  elementOverride: ElementType | null;
  scalingOverride: ScalingStat | null;
  statOverride: number | null;
  baseDmgBonus: number;
  flatBaseDmg: number;
  dmgBonus: number;
  naDmgBonus: number;
  caDmgBonus: number;
  skillDmgBonus: number;
  burstDmgBonus: number;
  dmgReduction: number;
  critRate: number;
  critDMG: number;
  critMode: CritMode;
  em: number;
  amplified: AmplifiedReaction;
  additive: AdditiveReaction;
  transformative: TransformativeReaction;
  swirlElement: ElementType;
  reactionBonus: number;
  ampReactionBonus: number;
  transformReactionBonus: number;
  defShred: number;
  defIgnore: number;
  resShred: number;
  /** Constellation level 0-6. */
  constellation: number;
  /** Enabled ascension-passive indices. */
  passiveOn: number[];
  /** Artifact set bonuses are derived from the pieces below. */
  artifacts: ArtifactBuild;
}

export const EMPTY_SETS = { flower: '', plume: '', sands: '', goblet: '', circlet: '' };

export const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

/** Which of the three talent-level buckets a table group belongs to. */
export const bucketOf = (group: TalentGroup): 'normal' | 'skill' | 'burst' =>
  group === 'skill' ? 'skill' : group === 'burst' ? 'burst' : 'normal';

/**
 * Multiplier for an attack type at a given talent level, read from the per-hit
 * table so the headline result tracks the talent-level inputs. Mirrors how the
 * aggregates were built: Normal/Charged are the whole combo (sum), Skill/Burst
 * are the biggest single hit (max).
 */
export function signatureMultiplierAt(
  charId: string,
  attackType: TalentKey,
  levels: { normal: number; skill: number; burst: number },
): number {
  const rows = (talentRowsFor(charId) ?? []).filter((r) => r.isDamage && r.group === attackType);
  if (rows.length === 0) return 0;
  const level = levels[bucketOf(attackType)];
  const values = rows.map((r) => (r.values[level - 1] ?? 0) * Math.max(1, r.hits));
  return attackType === 'skill' || attackType === 'burst' ? Math.max(...values) : values.reduce((a, b) => a + b, 0);
}

/** C3 / C5 raise one combat talent by 3 — which one is per character. */
export function constellationTalentAdd(charId: string, bucket: 'normal' | 'skill' | 'burst', cn: number): number {
  const b = CONSTELLATION_TALENT_BONUS[charId] ?? {};
  return (cn >= 3 && b[3] === bucket ? 3 : 0) + (cn >= 5 && b[5] === bucket ? 3 : 0);
}

export function effectiveTalentLevels(
  charId: string,
  levels: { normal: number; skill: number; burst: number },
  cn: number,
): { normal: number; skill: number; burst: number } {
  const bump = (k: 'normal' | 'skill' | 'burst') => Math.min(15, levels[k] + constellationTalentAdd(charId, k, cn));
  return { normal: bump('normal'), skill: bump('skill'), burst: bump('burst') };
}

/** Format a non-damage row's value (seconds, energy, stacks). */
export function formatRowText(label: string, percent: boolean, value: number): string {
  if (percent) return `${(value * 100).toFixed(1)}%`;
  if (/(Duration|Interval|\bCD\b|CD$)/i.test(label)) return `${Number(value.toFixed(1))}s`;
  return `${Number(value.toFixed(2))}`;
}

export function defaultsFor(c: (typeof CHARACTERS)[number]): Draft {
  return {
    charId: c.id,
    level: 90,
    weaponId: c.bestWeapon,
    weaponRefine: 1,
    weaponStacks: 0,
    enemyId: ENEMIES[0].id,
    customEnemy: false,
    enemyLevel: ENEMIES[0].level,
    enemyResMap: {},
    attackType: signatureTalent(c.id)?.key ?? 'burst',
    skillMult:
      signatureMultiplierAt(c.id, signatureTalent(c.id)?.key ?? 'burst', { normal: 10, skill: 10, burst: 10 }) ||
      c.skillMultiplier,
    talentLevels: { normal: 10, skill: 10, burst: 10 },
    activeRowId: null,
    elementOverride: null,
    scalingOverride: null,
    statOverride: null,
    baseDmgBonus: 0,
    flatBaseDmg: 0,
    dmgBonus: 0,
    naDmgBonus: 0,
    caDmgBonus: 0,
    skillDmgBonus: 0,
    burstDmgBonus: 0,
    dmgReduction: 0,
    critRate: 0,
    critDMG: 0,
    critMode: 'expected',
    em: 0,
    amplified: 'none',
    additive: 'none',
    transformative: 'none',
    swirlElement: 'pyro',
    reactionBonus: 0,
    ampReactionBonus: 0,
    transformReactionBonus: 0,
    defShred: 0,
    defIgnore: 0,
    resShred: 0,
    constellation: 0,
    passiveOn: [],
    artifacts: { ...resolvePreset(c) },
  };
}

/** Clamp every numeric field to its allowed range (used when restoring a URL). */
export function sanitize(d: Draft): Draft {
  return {
    ...d,
    level: Math.round(clamp(d.level, 1, 90)),
    weaponRefine: Math.round(clamp(d.weaponRefine ?? 1, 1, 5)),
    weaponStacks: Math.round(clamp(d.weaponStacks ?? 0, 0, 20)),
    enemyLevel: Math.round(clamp(d.enemyLevel, 1, 100)),
    enemyResMap: Object.fromEntries(
      Object.entries(d.enemyResMap ?? {}).map(([k, v]) => [k, clamp(Number(v) || 0, -1, 1)]),
    ) as Partial<Record<ElementType, number>>,
    skillMult: clamp(d.skillMult, 0, 100),
    talentLevels: {
      normal: Math.round(clamp(d.talentLevels?.normal ?? 10, 1, 15)),
      skill: Math.round(clamp(d.talentLevels?.skill ?? 10, 1, 15)),
      burst: Math.round(clamp(d.talentLevels?.burst ?? 10, 1, 15)),
    },
    statOverride: d.statOverride == null ? null : clamp(d.statOverride, 0, 1_000_000),
    baseDmgBonus: clamp(d.baseDmgBonus, -1, 10),
    flatBaseDmg: clamp(d.flatBaseDmg, 0, 1_000_000),
    dmgBonus: clamp(d.dmgBonus, 0, 20),
    naDmgBonus: clamp(d.naDmgBonus, -1, 20),
    caDmgBonus: clamp(d.caDmgBonus, -1, 20),
    skillDmgBonus: clamp(d.skillDmgBonus, -1, 20),
    burstDmgBonus: clamp(d.burstDmgBonus, -1, 20),
    dmgReduction: clamp(d.dmgReduction, 0, 1),
    critRate: clamp(d.critRate, 0, 1),
    critDMG: clamp(d.critDMG, 0, 10),
    em: clamp(d.em, 0, 3000),
    reactionBonus: clamp(d.reactionBonus, 0, 10),
    ampReactionBonus: clamp(d.ampReactionBonus, 0, 10),
    transformReactionBonus: clamp(d.transformReactionBonus, 0, 10),
    defShred: clamp(d.defShred, 0, 1),
    defIgnore: clamp(d.defIgnore, 0, 1),
    resShred: clamp(d.resShred, 0, 2),
    constellation: Math.round(clamp(d.constellation ?? 0, 0, 6)),
    passiveOn: (d.passiveOn ?? []).filter((n) => Number.isInteger(n) && n >= 0 && n <= 9),
    artifacts: {
      ...d.artifacts,
      flowerHP: clamp(d.artifacts.flowerHP ?? 0, 0, 1_000_000),
      plumeATK: clamp(d.artifacts.plumeATK ?? 0, 0, 1_000_000),
      pieceSubs: Array.from({ length: 5 }, (_, i) =>
        (d.artifacts.pieceSubs?.[i] ?? []).slice(0, 4).map((sub) =>
          sub ? { type: sub.type, value: clamp(Number(sub.value) || 0, 0, 1_000_000) } : undefined,
        ),
      ),
    },
  };
}

/** The canonical main-stat value for a slot type. */
export function mainValueFor(type: SecondaryStatType): number {
  switch (type) {
    case 'atk%':
      return MAIN_STATS.atkPercent;
    case 'hp%':
      return MAIN_STATS.hpPercent;
    case 'def%':
      return MAIN_STATS.defPercent;
    case 'em':
      return MAIN_STATS.em;
    case 'er':
      return MAIN_STATS.er;
    case 'critRate':
      return MAIN_STATS.critRate;
    case 'critDMG':
      return MAIN_STATS.critDMG;
    case 'dmg%':
      return MAIN_STATS.dmgBonus;
    case 'physical':
      return MAIN_STATS.physical;
    default:
      return 0;
  }
}

/** Human label for a main stat value, e.g. "46.6%" or "187". */
export function formatMainValue(type: SecondaryStatType): string {
  const v = mainValueFor(type);
  return ['atk%', 'hp%', 'def%', 'critRate', 'critDMG', 'dmg%', 'physical', 'er'].includes(type)
    ? `${(v * 100).toFixed(1)}%`
    : `${Math.round(v)}`;
}
