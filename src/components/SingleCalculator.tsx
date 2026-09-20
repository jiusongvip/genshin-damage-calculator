import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { RELEASED_CHARACTERS as CHARACTERS } from '../data/characters';
import { weaponsForType } from '../data/weapons';
import { ENEMIES } from '../data/enemies';
import { NO_ARTIFACTS, DEFAULT_BUFFS, MAIN_STATS, resolvePreset, setPicksFromPieces } from '../data/presets';
import { addBuffs, computeDamage, formatNumber, formatPercent } from '../lib/damage';
import type {
  AdditiveReaction,
  AmplifiedReaction,
  ArtifactBuild,
  BuffState,
  ElementType,
  ScalingStat,
  SecondaryStatType,
  TransformativeReaction,
} from '../lib/damage';
import { ELEMENT_LABEL } from '../data/elements';
import { signatureTalent } from '../data/talents';
import type { TalentKey } from '../data/talents';
import { talentRowsFor } from '../data/generated/talents';
import type { TalentGroup } from '../data/generated/talents';
import { CONSTELLATION_TALENT_BONUS } from '../data/generated/constellationTalents';
import { weaponPassiveFor } from '../data/generated/weaponPassives';
import { weaponBuffAt, weaponPassiveMaxStacks, WEAPON_PASSIVE_EFFECTS } from '../data/weaponPassives';
import { ARTIFACT_SETS, resolveSetBuffs } from '../data/artifactSets';
import type { SetPick } from '../data/artifactSets';
import { constellationsFor, passivesFor } from '../data/generated/constellations';
import { constellationBuffs, passiveBuffs, CONSTELLATION_EFFECTS, PASSIVE_EFFECTS } from '../data/constellations';
import DamageTable, { GROUP_LABEL } from './DamageTable';
import type { DamageRowVm, DamageGroupVm } from './DamageTable';
import { ElementIcon } from './TeamCalculator';

const ELEMENTS: ElementType[] = ['pyro', 'hydro', 'electro', 'cryo', 'anemo', 'geo', 'dendro'];
/** Enemy resistance rows — the seven elements plus Physical. */
const ENEMY_ELEMENTS: ElementType[] = [...ELEMENTS, 'physical'];
const SWIRLABLE: ElementType[] = ['pyro', 'hydro', 'electro', 'cryo'];

// Element-tinted tile backgrounds (the transparent portrait sits on top).
const ELEMENT_BG: Record<string, string> = {
  pyro: 'from-pyro/55 to-pyro/15',
  hydro: 'from-hydro/55 to-hydro/15',
  electro: 'from-electro/55 to-electro/15',
  cryo: 'from-cryo/55 to-cryo/15',
  anemo: 'from-anemo/55 to-anemo/15',
  geo: 'from-geo/55 to-geo/15',
  dendro: 'from-dendro/55 to-dendro/15',
  physical: 'from-gray-400/45 to-gray-400/15',
};
const SCALING_LABEL: Record<string, string> = { atk: 'ATK', hp: 'Max HP', def: 'DEF', em: 'Elemental Mastery' };

const AMPLIFIED: { value: AmplifiedReaction; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'vaporize', label: 'Vaporize' },
  { value: 'melt', label: 'Melt' },
];
const ADDITIVE: { value: AdditiveReaction; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'aggravate', label: 'Aggravate (Electro on Quicken)' },
  { value: 'spread', label: 'Spread (Dendro on Quicken)' },
];
const TRANSFORMATIVE: { value: TransformativeReaction; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'overload', label: 'Overload' },
  { value: 'electroCharged', label: 'Electro-Charged' },
  { value: 'superconduct', label: 'Superconduct' },
  { value: 'swirl', label: 'Swirl' },
  { value: 'shatter', label: 'Shatter' },
  { value: 'bloom', label: 'Bloom' },
  { value: 'hyperbloom', label: 'Hyperbloom' },
  { value: 'burgeon', label: 'Burgeon' },
  { value: 'burning', label: 'Burning' },
];
const ATTACKS: { value: TalentKey; label: string }[] = [
  { value: 'normal', label: 'Normal combo' },
  { value: 'charged', label: 'Charged' },
  { value: 'skill', label: 'Skill' },
  { value: 'burst', label: 'Burst' },
];

type CritMode = 'expected' | 'crit' | 'nonCrit';

/** Reactions a character of each element can trigger (for the Reactions panel). */
const REACHABLE_REACTIONS: Record<ElementType, { amplified: AmplifiedReaction[]; transformative: TransformativeReaction[] }> = {
  pyro: { amplified: ['vaporize', 'melt'], transformative: ['overload', 'burning', 'burgeon', 'shatter'] },
  hydro: { amplified: ['vaporize'], transformative: ['electroCharged', 'bloom', 'hyperbloom', 'burgeon', 'shatter'] },
  cryo: { amplified: ['melt'], transformative: ['superconduct', 'shatter'] },
  electro: { amplified: [], transformative: ['overload', 'superconduct', 'electroCharged', 'hyperbloom'] },
  anemo: { amplified: [], transformative: ['swirl'] },
  geo: { amplified: [], transformative: [] },
  dendro: { amplified: [], transformative: ['burning', 'bloom', 'hyperbloom', 'burgeon'] },
  physical: { amplified: [], transformative: ['shatter'] },
};

/** Map a talent-table group onto the engine's attack-type key (plunge ≈ normal). */
const GROUP_TO_TALENT: Record<TalentGroup, TalentKey> = {
  normal: 'normal',
  charged: 'charged',
  plunge: 'normal',
  skill: 'skill',
  burst: 'burst',
};

/** Which of the three talent-level buckets a table group belongs to. */
const bucketOf = (group: TalentGroup): 'normal' | 'skill' | 'burst' =>
  group === 'skill' ? 'skill' : group === 'burst' ? 'burst' : 'normal';

/**
 * Multiplier for an attack type at a given talent level, read from the per-hit
 * table so the headline result tracks the talent-level inputs. Mirrors how the
 * aggregates were built: Normal/Charged are the whole combo (sum), Skill/Burst
 * are the biggest single hit (max).
 */
function signatureMultiplierAt(
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

const EMPTY_SETS = { flower: '', plume: '', sands: '', goblet: '', circlet: '' };

/** C3 / C5 raise one combat talent by 3 — which one is per character. */
function constellationTalentAdd(charId: string, bucket: 'normal' | 'skill' | 'burst', cn: number): number {
  const b = CONSTELLATION_TALENT_BONUS[charId] ?? {};
  return (cn >= 3 && b[3] === bucket ? 3 : 0) + (cn >= 5 && b[5] === bucket ? 3 : 0);
}

function effectiveTalentLevels(
  charId: string,
  levels: { normal: number; skill: number; burst: number },
  cn: number,
): { normal: number; skill: number; burst: number } {
  const bump = (k: 'normal' | 'skill' | 'burst') => Math.min(15, levels[k] + constellationTalentAdd(charId, k, cn));
  return { normal: bump('normal'), skill: bump('skill'), burst: bump('burst') };
}

/** Format a non-damage row's value (seconds, energy, stacks). */
function formatRowText(label: string, percent: boolean, value: number): string {
  if (percent) return `${(value * 100).toFixed(1)}%`;
  if (/(Duration|Interval|\bCD\b|CD$)/i.test(label)) return `${Number(value.toFixed(1))}s`;
  return `${Number(value.toFixed(2))}`;
}

/** Everything the user can edit, in one object so URL save/restore is trivial. */
interface Draft {
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
  /** Active talent level (1-15) for the per-hit table. */
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

function defaultsFor(c: (typeof CHARACTERS)[number]): Draft {
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
      signatureMultiplierAt(c.id, signatureTalent(c.id)?.key ?? 'burst', { normal: 10, skill: 10, burst: 10 }) || c.skillMultiplier,
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

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

/** Clamp every numeric field to its allowed range (used when restoring a URL). */
function sanitize(d: Draft): Draft {
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

/** Percent input: shows 12.3 for 0.123 and writes back the fraction. */
function Pct({
  value,
  onChange,
  label,
  icon,
  step = 1,
  min = 0,
  max = 2000,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
  icon?: ReactNode;
  step?: number;
  min?: number;
  max?: number;
}) {
  return (
    <label className="block">
      <span className="flex items-center gap-1 text-xs font-medium text-[var(--muted)]">
        {icon}
        {label}
      </span>
      <div className="mt-1 flex items-center gap-1">
        <input
          type="number"
          inputMode="decimal"
          step={step}
          min={min}
          max={max}
          value={Number((value * 100).toFixed(2))}
          onChange={(e) => {
            const raw = parseFloat(e.target.value);
            onChange(clamp(Number.isFinite(raw) ? raw : 0, min, max) / 100);
          }}
          className="w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-right text-[var(--text)]"
        />
        <span className="text-xs text-[var(--muted)]">%</span>
      </div>
    </label>
  );
}

function Num({
  value,
  onChange,
  label,
  icon,
  step = 1,
  min = 0,
  max = 1_000_000,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
  icon?: ReactNode;
  step?: number;
  min?: number;
  max?: number;
}) {
  return (
    <label className="block">
      <span className="flex items-center gap-1 text-xs font-medium text-[var(--muted)]">
        {icon}
        {label}
      </span>
      <input
        type="number"
        inputMode="decimal"
        step={step}
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const raw = parseFloat(e.target.value);
          onChange(clamp(Number.isFinite(raw) ? raw : 0, min, max));
        }}
        className="mt-1 w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-right text-[var(--text)]"
      />
    </label>
  );
}

/** Which element(s) each reaction actually deals, for the leading icon. */
const REACTION_ELEMENT: Record<string, ElementType[]> = {
  vaporize: ['hydro', 'pyro'],
  melt: ['pyro', 'cryo'],
  overload: ['pyro', 'electro'],
  electroCharged: ['hydro', 'electro'],
  superconduct: ['cryo', 'electro'],
  swirl: ['anemo'],
  shatter: ['physical'],
  bloom: ['dendro', 'hydro'],
  hyperbloom: ['dendro', 'electro'],
  burgeon: ['pyro', 'dendro'],
  burning: ['pyro', 'dendro'],
  aggravate: ['electro'],
  spread: ['dendro'],
};

const GLYPH: Record<string, string> = {
  normal: 'M5 19L19 5M13 5h6v6',
  charged: 'M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z',
  skill: 'M12 3l7 7-7 7-7-7z',
  burst: 'M13 2L4 14h6l-1 8 9-12h-6z',
  expected: 'M4 19h16M5 15l5-5 4 4 6-6',
  crit: 'M12 2l2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4z',
  nonCrit: 'M5 12h14',
  enemy: 'M12 3v3M12 18v3M3 12h3M18 12h3M12 8a4 4 0 100 8 4 4 0 000-8z',
  atk: 'M12 3v18M7 8l5-5 5 5',
  hp: 'M12 21s-7-4.4-7-10a4 4 0 017-2.5A4 4 0 0119 11c0 5.6-7 10-7 10z',
  def: 'M12 3l8 3v6c0 5-3.5 7.6-8 9-4.5-1.4-8-4-8-9V6z',
  em: 'M12 3l2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4z',
  er: 'M13 2L4 14h6l-1 8 9-12h-6z',
  critRate: 'M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z',
  critDMG: 'M12 2l2.2 6.1L20.5 10l-6.3 1.9L12 18l-2.2-6.1L3.5 10l6.3-1.9z',
  dmg: 'M4 20L20 4M14 4h6v6',
  physical: 'M6 18L18 6M15 6h3v3',
  none: '',
};

const SECONDARY_LABEL: Record<SecondaryStatType, string> = {
  'atk%': 'ATK%',
  'hp%': 'HP%',
  'def%': 'DEF%',
  flatATK: 'Flat ATK',
  flatHP: 'Flat HP',
  flatDEF: 'Flat DEF',
  critRate: 'CRIT Rate',
  critDMG: 'CRIT DMG',
  em: 'Elemental Mastery',
  er: 'Energy Recharge',
  physical: 'Physical DMG',
  'dmg%': 'DMG Bonus',
};

const STAT_GLYPH: Record<string, string> = {
  'atk%': 'atk',
  'hp%': 'hp',
  'def%': 'def',
  em: 'em',
  er: 'er',
  critRate: 'critRate',
  critDMG: 'critDMG',
  'dmg%': 'dmg',
  physical: 'physical',
};

type MainSlot = 'sandsMain' | 'gobletMain' | 'circletMain';
const MAIN_OPTIONS: { slot: MainSlot; label: string; options: SecondaryStatType[] }[] = [
  { slot: 'sandsMain', label: 'Sands', options: ['atk%', 'hp%', 'def%', 'em', 'er'] },
  { slot: 'gobletMain', label: 'Goblet', options: ['dmg%'] },
  { slot: 'circletMain', label: 'Circlet', options: ['critRate', 'critDMG', 'atk%', 'hp%', 'def%', 'em'] },
];

/** The five artifact slots: flower / plume have a fixed main, the rest are selectable. */
const PIECE_ROWS: { piece: 'flower' | 'plume' | 'sands' | 'goblet' | 'circlet'; label: string; mainSlot?: MainSlot; fixed?: string }[] = [
  { piece: 'flower', label: 'Flower', fixed: 'HP +4,780' },
  { piece: 'plume', label: 'Plume', fixed: 'ATK +311' },
  { piece: 'sands', label: 'Sands', mainSlot: 'sandsMain' },
  { piece: 'goblet', label: 'Goblet', mainSlot: 'gobletMain' },
  { piece: 'circlet', label: 'Circlet', mainSlot: 'circletMain' },
];

function mainValueFor(type: SecondaryStatType): number {
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
function formatMainValue(type: SecondaryStatType): string {
  const v = mainValueFor(type);
  return ['atk%', 'hp%', 'def%', 'critRate', 'critDMG', 'dmg%', 'physical', 'er'].includes(type)
    ? `${(v * 100).toFixed(1)}%`
    : `${Math.round(v)}`;
}

/** Sub-stat options that can roll on a 5★ artifact (labels only, no dmg%). */
const SUB_OPTIONS: { type: SecondaryStatType; label: string; percent: boolean }[] = [
  { type: 'critRate', label: 'CRIT Rate', percent: true },
  { type: 'critDMG', label: 'CRIT DMG', percent: true },
  { type: 'atk%', label: 'ATK%', percent: true },
  { type: 'hp%', label: 'HP%', percent: true },
  { type: 'def%', label: 'DEF%', percent: true },
  { type: 'em', label: 'Elemental Mastery', percent: false },
  { type: 'er', label: 'Energy Recharge', percent: true },
  { type: 'flatATK', label: 'Flat ATK', percent: false },
  { type: 'flatHP', label: 'Flat HP', percent: false },
  { type: 'flatDEF', label: 'Flat DEF', percent: false },
];

function Glyph({ name, className = 'h-4 w-4' }: { name: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={GLYPH[name] ?? ''} />
    </svg>
  );
}

function ElementPair({ els }: { els: ElementType[] }) {
  return (
    <>
      {els.map((e) => (
        <ElementIcon key={e} el={e} className="h-5 w-5" />
      ))}
    </>
  );
}

interface IconOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

/**
 * Dropdown where every option (and the closed control) shows its icon, so the
 * user can pick by icon + colour instead of reading text. Keyboard-operable:
 * Tab reaches the trigger and the options, Enter/Space picks, Escape closes.
 */
function IconSelect<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: IconOption<T>[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const current = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className={`relative ${className ?? 'mt-1'}`} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-[10px] border border-[var(--line)] bg-[var(--surface)] px-2 py-2 text-left text-sm text-[var(--text)]"
      >
        {current?.icon && <span className="flex shrink-0 items-center gap-0.5">{current.icon}</span>}
        <span className="min-w-0 flex-1 truncate">{current?.label ?? '—'}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="shrink-0 text-[var(--muted)]" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open && (
        <ul role="listbox" className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-[10px] border border-[var(--line)] bg-[var(--surface)] p-1 shadow-xl">
          {options.map((o) => (
            <li key={o.value}>
              <button
                type="button"
                role="option"
                aria-selected={o.value === value}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors ${
                  o.value === value ? 'bg-forest-600/12 text-forest-700' : 'text-[var(--text)] hover:bg-[var(--soft)]'
                }`}
              >
                {o.icon && <span className="flex shrink-0 items-center gap-0.5">{o.icon}</span>}
                <span className="min-w-0 flex-1 truncate">{o.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Zone({
  id,
  index,
  title,
  value,
  changed,
  onReset,
  onEnter,
  children,
}: {
  id: string;
  index: number;
  title: string;
  value: string;
  changed?: boolean;
  onReset?: () => void;
  onEnter: (id: string) => void;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      ref={(el) => {
        if (el) zoneRefs.set(id, el);
      }}
      onMouseEnter={() => onEnter(id)}
      className="panel scroll-mt-24 p-2"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="flex items-center gap-2 text-base font-semibold text-[var(--text)]">
          <span className="tnum text-sm text-forest-500/70">{String(index).padStart(2, '0')}</span>
          {title}
          {changed && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-forest-600">
              <span className="h-1.5 w-1.5 rounded-full bg-forest-500" />edited
            </span>
          )}
        </h3>
        <div className="flex items-baseline gap-2">
          <span className="tnum text-lg font-semibold text-forest-600">{value}</span>
          {changed && onReset && (
            <button type="button" onClick={onReset} className="text-[11px] text-[var(--muted)] underline underline-offset-2 hover:text-forest-600">
              reset
            </button>
          )}
        </div>
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

const zoneRefs = new Map<string, HTMLElement>();

export default function SingleCalculator() {
  const initial = CHARACTERS[0];
  const [draft, setDraft] = useState<Draft>(() => defaultsFor(initial));
  const [query, setQuery] = useState('');
  const [elementFilter, setElementFilter] = useState<'all' | ElementType>('all');
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerDialog = useRef<HTMLDialogElement | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [tab, setTab] = useState<'character' | 'equipment' | 'multipliers' | 'damage'>('damage');

  const character = CHARACTERS.find((c) => c.id === draft.charId) ?? initial;
  const weaponOptions = weaponsForType(character.weaponType);
  const weapon = weaponOptions.find((w) => w.id === draft.weaponId) ?? weaponOptions[0];
  const baseEnemy = ENEMIES.find((e) => e.id === draft.enemyId) ?? ENEMIES[0];
  const enemy = useMemo(
    () => ({
      ...baseEnemy,
      level: draft.customEnemy ? draft.enemyLevel : baseEnemy.level,
      resistances: { ...baseEnemy.resistances, ...draft.enemyResMap },
    }),
    [baseEnemy, draft.customEnemy, draft.enemyLevel, draft.enemyResMap],
  );

  // Baseline (character + weapon + the artifacts you entered, no buffs) — the
  // defaults the six zones start from.
  const whiteboard = useMemo(
    () =>
      computeDamage({
        character,
        weapon,
        artifacts: draft.artifacts,
        buffs: DEFAULT_BUFFS,
        enemy,
        characterLevel: draft.level,
        amplified: 'none',
        transformative: 'none',
      }),
    [character, weapon, enemy, draft.level, draft.artifacts],
  );

  // The character's own stats (character + weapon + ascension), before any
  // artifacts or zone bonuses — a fixed floor the user can only add to.
  const own = useMemo(
    () =>
      computeDamage({
        character,
        weapon,
        artifacts: NO_ARTIFACTS,
        buffs: DEFAULT_BUFFS,
        enemy,
        characterLevel: draft.level,
        amplified: 'none',
        transformative: 'none',
      }),
    [character, weapon, enemy, draft.level],
  );
  const ownCritRate = own.critRate;
  const ownCritDMG = own.critDMG;
  const ownEM = own.em;
  const scaling = character.scaling ?? 'atk';

  const weaponPassive = weaponPassiveFor(draft.weaponId);
  const weaponEffect = WEAPON_PASSIVE_EFFECTS[draft.weaponId];
  const weaponMaxStacks = weaponPassiveMaxStacks(draft.weaponId);
  const weaponRefDesc =
    weaponPassive?.refinements[Math.min(Math.max(draft.weaponRefine, 1), 5) - 1]?.description ?? '';

  const constellations = useMemo(() => constellationsFor(character.id) ?? [], [character.id]);
  const ascensionPassives = useMemo(() => passivesFor(character.id) ?? [], [character.id]);
  const consModelled = CONSTELLATION_EFFECTS[character.id] ?? {};
  const passiveModelled = PASSIVE_EFFECTS[character.id] ?? {};

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const setArtifact = (patch: Partial<ArtifactBuild>) =>
    setDraft((d) => ({ ...d, artifacts: { ...d.artifacts, ...patch } }));

  /** Which set an artifact piece belongs to ('' = off-piece). */
  const setPieceSet = (piece: 'flower' | 'plume' | 'sands' | 'goblet' | 'circlet', value: string) => {
    setDraft((d) => ({
      ...d,
      artifacts: {
        ...d.artifacts,
        sets: { ...(d.artifacts.sets ?? EMPTY_SETS), [piece]: value === 'none' ? '' : value },
      },
    }));
  };

  /** Set / clear one sub-stat slot on a piece (pieceIdx, slot 0-3). */
  const setPieceSub = (pieceIdx: number, slot: number, type: SecondaryStatType | 'none') => {
    setDraft((d) => {
      const pieceSubs = Array.from({ length: 5 }, (_, i) => [...(d.artifacts.pieceSubs?.[i] ?? [])]);
      const piece = pieceSubs[pieceIdx];
      if (type === 'none') piece[slot] = undefined;
      else piece[slot] = { type, value: piece[slot]?.value ?? 0 };
      return { ...d, artifacts: { ...d.artifacts, pieceSubs } };
    });
  };

  const setPieceSubValue = (pieceIdx: number, slot: number, raw: number, percent: boolean) => {
    setDraft((d) => {
      const pieceSubs = Array.from({ length: 5 }, (_, i) => [...(d.artifacts.pieceSubs?.[i] ?? [])]);
      const cur = pieceSubs[pieceIdx][slot];
      if (!cur) return d;
      pieceSubs[pieceIdx][slot] = { type: cur.type, value: clamp(percent ? raw / 100 : raw, 0, 100000) };
      return { ...d, artifacts: { ...d.artifacts, pieceSubs } };
    });
  };

  const pickCharacter = (id: string) => {
    const c = CHARACTERS.find((x) => x.id === id);
    if (!c) return;
    setDraft(defaultsFor(c));
  };

  // Fold the six zones into the engine's BuffState. Standalone totals
  // (crit / EM / the scaling stat) are turned into deltas against the
  // whiteboard so a manual override means "set the total to this".
  // Kept weapon-independent so the weapon ranking can swap in each passive.
  const nonWeaponBuffs: BuffState = useMemo(() => {
    const patches: Partial<BuffState>[] = [
      constellationBuffs(character.id, draft.constellation),
      passiveBuffs(character.id, draft.passiveOn),
      { dmgBonus: draft.dmgBonus, dmgReduction: draft.dmgReduction },
      {
        naDmgBonus: draft.naDmgBonus,
        caDmgBonus: draft.caDmgBonus,
        skillDmgBonus: draft.skillDmgBonus,
        burstDmgBonus: draft.burstDmgBonus,
      },
      { baseDmgBonus: draft.baseDmgBonus, flatBaseDmg: draft.flatBaseDmg },
      // CRIT and EM are bonuses added on top of the character's own stats,
      // so the base can never be typed below its real value.
      { critRate: draft.critRate, critDMG: draft.critDMG, em: draft.em },
      {
        reactionBonus: draft.reactionBonus,
        ampReactionBonus: draft.ampReactionBonus,
        transformReactionBonus: draft.transformReactionBonus,
      },
      { defShred: draft.defShred, defIgnore: draft.defIgnore, resShred: draft.resShred },
    ];
    if (draft.statOverride != null && scaling !== 'em') {
      const delta = draft.statOverride - whiteboard.baseStat;
      if (scaling === 'hp') patches.push({ flatHP: delta });
      else if (scaling === 'def') patches.push({ flatDEF: delta });
      else patches.push({ flatATK: delta });
    }
    return addBuffs(DEFAULT_BUFFS, ...patches);
  }, [draft, scaling, whiteboard.baseStat, character.id]);

  const baseBuffs: BuffState = useMemo(
    () => addBuffs(nonWeaponBuffs, weaponBuffAt(draft.weaponId, draft.weaponRefine, draft.weaponStacks)),
    [nonWeaponBuffs, draft.weaponId, draft.weaponRefine, draft.weaponStacks],
  );

  // The element and attack type the zones currently describe — used to filter
  // element- and attack-type-specific artifact set bonuses.
  const activeElement: ElementType = draft.elementOverride ?? character.element;
  const activeAttack: TalentKey = draft.attackType;

  // Set bonuses come from how many pieces wear each set (4pc + off, or 2pc + 2pc + off).
  const setPicks = useMemo(() => setPicksFromPieces(draft.artifacts.sets ?? {}), [draft.artifacts.sets]);

  const buffs: BuffState = useMemo(
    () => addBuffs(baseBuffs, resolveSetBuffs(setPicks, activeElement, activeAttack)),
    [baseBuffs, setPicks, activeElement, activeAttack],
  );

  // Reactions this character can trigger, with their current values, so the
  // numbers are visible at a glance instead of one selected at a time.
  const reactionPreviews = useMemo(() => {
    const reach = REACHABLE_REACTIONS[character.element] ?? { amplified: [], transformative: [] };
    const tName = Object.fromEntries(TRANSFORMATIVE.map((o) => [o.value, o.label])) as Record<string, string>;
    const aName = Object.fromEntries(AMPLIFIED.map((o) => [o.value, o.label])) as Record<string, string>;
    const common = {
      character,
      weapon,
      artifacts: draft.artifacts,
      buffs,
      enemy,
      characterLevel: draft.level,
      attackType: draft.attackType,
      skillMultiplier: draft.skillMult,
      element: draft.elementOverride ?? undefined,
      scaling: draft.scalingOverride ?? undefined,
    };
    const amplified = reach.amplified.map((key) => ({
      key,
      label: aName[key] ?? key,
      multiplier: computeDamage({ ...common, amplified: key, transformative: 'none' }).reactionMultiplier,
    }));
    const transformative = reach.transformative.map((key) => ({
      key,
      label: key === 'swirl' ? `${tName[key]} (${ELEMENT_LABEL[draft.swirlElement]})` : tName[key] ?? key,
      value: computeDamage({ ...common, amplified: 'none', transformative: key, swirlElement: draft.swirlElement }).transformative,
    }));
    return { amplified, transformative };
  }, [character, weapon, draft.artifacts, buffs, enemy, draft.level, draft.attackType, draft.skillMult, draft.elementOverride, draft.scalingOverride, draft.swirlElement]);

  const result = useMemo(
    () =>
      computeDamage({
        character,
        weapon,
        artifacts: draft.artifacts,
        buffs,
        enemy,
        characterLevel: draft.level,
        attackType: draft.attackType,
        skillMultiplier: draft.skillMult,
        element: draft.elementOverride ?? undefined,
        scaling: draft.scalingOverride ?? undefined,
        amplified: draft.amplified,
        additive: draft.additive,
        transformative: draft.transformative,
        swirlElement: draft.transformative === 'swirl' ? draft.swirlElement : undefined,
      }),
    [character, weapon, draft.artifacts, buffs, enemy, draft.level, draft.attackType, draft.skillMult, draft.elementOverride, draft.scalingOverride, draft.amplified, draft.additive, draft.transformative, draft.swirlElement],
  );

  const baseDamage =
    result.baseStat * result.skillMultiplier * (1 + result.baseDmgBonus) + result.additive + draft.flatBaseDmg;
  const dmgMult = Math.max(0, 1 + result.dmgBonus - draft.dmgReduction);
  const critMult =
    draft.critMode === 'crit'
      ? 1 + result.critDMG
      : draft.critMode === 'nonCrit'
        ? 1
        : 1 + result.critRate * result.critDMG;
  const hit = baseDamage * dmgMult * critMult * result.reactionMultiplier * result.defMultiplier * result.resMultiplier;
  const expected = Math.min(hit, 20_000_000);
  const capped = hit > 20_000_000;

  // ---- Per-hit damage table ------------------------------------------------
  const talentRows = useMemo(() => talentRowsFor(character.id) ?? [], [character.id]);

  const effLevels = effectiveTalentLevels(character.id, draft.talentLevels, draft.constellation);
  const consTalent = CONSTELLATION_TALENT_BONUS[character.id] ?? {};
  const talentBonusNote = [
    draft.constellation >= 3 && consTalent[3] ? `C3 → ${consTalent[3]} talent +3` : '',
    draft.constellation >= 5 && consTalent[5] ? `C5 → ${consTalent[5]} talent +3` : '',
  ]
    .filter(Boolean)
    .join(' · ');
  const levelForGroup = (group: TalentGroup) => effLevels[bucketOf(group)];

  const damageGroups: DamageGroupVm[] = useMemo(() => {
    const ORDER: TalentGroup[] = ['normal', 'charged', 'plunge', 'skill', 'burst'];
    const map = new Map<TalentGroup, DamageRowVm[]>();
    for (const g of ORDER) map.set(g, []);

    for (const row of talentRows) {
      const value = row.values[levelForGroup(row.group) - 1] ?? 0;
      const hits = Math.max(1, row.hits);
      let vm: DamageRowVm;
      if (!row.isDamage) {
        vm = {
          id: row.id,
          label: row.label,
          group: row.group,
          element: row.element,
          value,
          nonCrit: 0,
          crit: 0,
          expected: 0,
          text: formatRowText(row.label, row.percent, value),
          active: false,
        };
      } else {
        const r = computeDamage({
          character,
          weapon,
          artifacts: draft.artifacts,
          buffs: addBuffs(baseBuffs, resolveSetBuffs(setPicks, row.element, GROUP_TO_TALENT[row.group])),
          enemy,
          characterLevel: draft.level,
          attackType: GROUP_TO_TALENT[row.group],
          skillMultiplier: value * hits,
          element: row.element,
          scaling: row.scaling,
          amplified: draft.amplified,
          additive: draft.additive,
          transformative: draft.transformative,
          swirlElement: draft.transformative === 'swirl' ? draft.swirlElement : undefined,
        });
        vm = {
          id: row.id,
          label: hits > 1 ? `${row.label} ×${hits}` : row.label,
          group: row.group,
          element: row.element,
          value: value * hits,
          nonCrit: r.nonCrit,
          crit: r.critHit,
          expected: r.expected,
          active: row.id === draft.activeRowId,
        };
      }
      map.get(row.group)!.push(vm);
    }

    return ORDER.filter((g) => (map.get(g)!.length > 0)).map((g) => {
      const rows = map.get(g)!;
      const dmg = rows.filter((r) => r.text === undefined);
      // Only the Normal Attack combo has a meaningful "Total DMG": a Skill or
      // Burst can list alternative hits (e.g. Hu Tao's normal vs low-HP burst)
      // that never all land together.
      const total =
        g === 'normal' && dmg.length > 0
          ? dmg.reduce(
              (a, r) => ({ nonCrit: a.nonCrit + r.nonCrit, crit: a.crit + r.crit, expected: a.expected + r.expected }),
              { nonCrit: 0, crit: 0, expected: 0 },
            )
          : null;
      return { group: g, label: GROUP_LABEL[g], rows, total };
    });
  }, [talentRows, draft.talentLevels, draft.constellation, draft.activeRowId, character, weapon, draft.artifacts, baseBuffs, setPicks, enemy, draft.level, draft.amplified, draft.additive, draft.transformative, draft.swirlElement, draft.elementOverride]);

  const pickRow = (vm: DamageRowVm) => {
    setDraft((d) => {
      const row = talentRows.find((r) => r.id === vm.id);
      if (!row || !row.isDamage) return d;
      const lv = effectiveTalentLevels(character.id, d.talentLevels, d.constellation)[bucketOf(row.group)];
      const value = (row.values[lv - 1] ?? 0) * Math.max(1, row.hits);
      return {
        ...d,
        activeRowId: row.id,
        attackType: GROUP_TO_TALENT[row.group],
        skillMult: value,
        elementOverride: row.element,
        scalingOverride: row.scaling,
      };
    });
  };

  const changeTalentLevel = (group: 'normal' | 'skill' | 'burst', lv: number) => {
    setDraft((d) => {
      const level = Math.round(clamp(lv, 1, 15));
      const next = { ...d, talentLevels: { ...d.talentLevels, [group]: level } };
      if (d.activeRowId) {
        const row = talentRows.find((r) => r.id === d.activeRowId);
        if (row && bucketOf(row.group) === group) {
          const lv = effectiveTalentLevels(character.id, next.talentLevels, next.constellation)[group];
          next.skillMult = (row.values[lv - 1] ?? 0) * Math.max(1, row.hits);
        }
      } else {
        next.skillMult = signatureMultiplierAt(character.id, d.attackType, effectiveTalentLevels(character.id, next.talentLevels, next.constellation)) || next.skillMult;
      }
      return next;
    });
  };

  // ---- URL state -----------------------------------------------------------
  const restored = useRef(false);
  useEffect(() => {
    if (!restored.current) return;
    const p = new URLSearchParams();
    const put = (k: string, v: string | number | null) => {
      if (v === null || v === '') return;
      p.set(k, String(v));
    };
    const d = defaultsFor(character);
    if (character.id !== initial.id) put('c', character.id);
    if (draft.level !== d.level) put('lv', draft.level);
    if (draft.weaponId !== d.weaponId) put('w', draft.weaponId);
    if (draft.weaponRefine !== d.weaponRefine) put('wr', draft.weaponRefine);
    if (draft.weaponStacks) put('ws', draft.weaponStacks);
    if (draft.enemyId !== d.enemyId) put('e', draft.enemyId);
    if (draft.customEnemy) put('el', draft.enemyLevel);
    const erm = Object.entries(draft.enemyResMap)
      .map(([k, v]) => `${k}:${v}`)
      .join(',');
    if (erm) put('erm', erm);
    if (draft.attackType !== d.attackType) put('at', draft.attackType);
    if (draft.skillMult !== d.skillMult) put('sm', draft.skillMult);
    if (draft.talentLevels.normal !== d.talentLevels.normal || draft.talentLevels.skill !== d.talentLevels.skill || draft.talentLevels.burst !== d.talentLevels.burst)
      put('tl', `${draft.talentLevels.normal}.${draft.talentLevels.skill}.${draft.talentLevels.burst}`);
    if (draft.activeRowId) put('row', draft.activeRowId);
    if (draft.elementOverride) put('ce', draft.elementOverride);
    if (draft.scalingOverride) put('cs', draft.scalingOverride);
    if (draft.statOverride != null) put('st', draft.statOverride);
    if (draft.baseDmgBonus) put('bd', draft.baseDmgBonus);
    if (draft.flatBaseDmg) put('fb', draft.flatBaseDmg);
    if (draft.dmgBonus) put('db', draft.dmgBonus);
    if (draft.naDmgBonus) put('na', draft.naDmgBonus);
    if (draft.caDmgBonus) put('ca', draft.caDmgBonus);
    if (draft.skillDmgBonus) put('sk', draft.skillDmgBonus);
    if (draft.burstDmgBonus) put('bu', draft.burstDmgBonus);
    if (draft.dmgReduction) put('dr', draft.dmgReduction);
    if (draft.critRate) put('cr', draft.critRate);
    if (draft.critDMG) put('cd', draft.critDMG);
    if (draft.critMode !== 'expected') put('cm', draft.critMode);
    if (draft.em) put('em', draft.em);
    if (draft.amplified !== 'none') put('amp', draft.amplified);
    if (draft.additive !== 'none') put('ad', draft.additive);
    if (draft.transformative !== 'none') put('tr', draft.transformative);
    if (draft.transformative === 'swirl') put('se', draft.swirlElement);
    if (draft.reactionBonus) put('rb', draft.reactionBonus);
    if (draft.ampReactionBonus) put('arb', draft.ampReactionBonus);
    if (draft.transformReactionBonus) put('trb', draft.transformReactionBonus);
    if (draft.defShred) put('ds', draft.defShred);
    if (draft.defIgnore) put('di', draft.defIgnore);
    if (draft.resShred) put('rs', draft.resShred);
    if (draft.artifacts.sandsMain.value > 0) put('sand', draft.artifacts.sandsMain.type);
    if (draft.artifacts.gobletMain.value > 0) put('gob', draft.artifacts.gobletMain.type);
    if (draft.artifacts.circletMain.value > 0) put('circ', draft.artifacts.circletMain.type);
    const subsStr = (draft.artifacts.pieceSubs ?? [])
      .map((piece) =>
        (piece ?? [])
          .filter(Boolean)
          .map((sub) => `${sub!.type}~${sub!.value}`)
          .join(','),
      )
      .join(';');
    if (subsStr.replace(/[;]/g, '')) put('subs', subsStr);
    const ps = [
      draft.artifacts.sets?.flower ?? '',
      draft.artifacts.sets?.plume ?? '',
      draft.artifacts.sets?.sands ?? '',
      draft.artifacts.sets?.goblet ?? '',
      draft.artifacts.sets?.circlet ?? '',
    ].join(',');
    if (ps.replace(/,/g, '')) put('ps', ps);
    if (draft.constellation) put('cn', draft.constellation);
    if (draft.passiveOn.length) put('pv', draft.passiveOn.join('.'));
    const qs = p.toString();
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
  }, [draft, character, initial.id]);

  // Restore from URL once.
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    const p = new URLSearchParams(window.location.search);
    const num = (k: string, fallback: number) => {
      const v = parseFloat(p.get(k) ?? '');
      return Number.isFinite(v) ? v : fallback;
    };
    const c = CHARACTERS.find((x) => x.id === p.get('c'));
    const base = defaultsFor(c ?? initial);
    // Restored attack type / talent levels, so the headline multiplier matches
    // the talent levels in the link rather than the level-10 default.
    const restoredAttack = (p.get('at') as TalentKey) ?? base.attackType;
    const tlParts = (p.get('tl') ?? '').split('.').map((x) => parseInt(x, 10));
    const restoredLevels = {
      normal: Number.isFinite(tlParts[0]) ? clamp(tlParts[0], 1, 15) : base.talentLevels.normal,
      skill: Number.isFinite(tlParts[1]) ? clamp(tlParts[1], 1, 15) : base.talentLevels.skill,
      burst: Number.isFinite(tlParts[2]) ? clamp(tlParts[2], 1, 15) : base.talentLevels.burst,
    };
    setDraft(sanitize({
      ...base,
      charId: (c ?? initial).id,
      level: num('lv', base.level),
      weaponId: p.get('w') ?? base.weaponId,
      weaponRefine: num('wr', base.weaponRefine),
      weaponStacks: num('ws', base.weaponStacks),
      enemyId: p.get('e') ?? base.enemyId,
      customEnemy: p.has('el') || p.has('erm'),
      enemyLevel: num('el', base.enemyLevel),
      enemyResMap: Object.fromEntries(
        (p.get('erm') ?? '')
          .split(',')
          .map((pair) => pair.split(':'))
          .filter((kv) => kv.length === 2 && kv[1] !== '')
          .map(([k, v]) => [k, clamp(parseFloat(v) || 0, -1, 1)]),
      ) as Partial<Record<ElementType, number>>,
      attackType: restoredAttack,
      skillMult: p.has('sm') ? num('sm', base.skillMult) : signatureMultiplierAt((c ?? initial).id, restoredAttack, restoredLevels) || base.skillMult,
      talentLevels: restoredLevels,
      activeRowId: p.get('row') ?? null,
      elementOverride: (p.get('ce') as ElementType) ?? null,
      scalingOverride: (p.get('cs') as ScalingStat) ?? null,
      statOverride: p.has('st') ? num('st', 0) : null,
      baseDmgBonus: num('bd', 0),
      flatBaseDmg: num('fb', 0),
      dmgBonus: num('db', 0),
      naDmgBonus: num('na', 0),
      caDmgBonus: num('ca', 0),
      skillDmgBonus: num('sk', 0),
      burstDmgBonus: num('bu', 0),
      dmgReduction: num('dr', 0),
      critRate: num('cr', 0),
      critDMG: num('cd', 0),
      critMode: (p.get('cm') as CritMode) ?? 'expected',
      em: num('em', 0),
      amplified: (p.get('amp') as AmplifiedReaction) ?? 'none',
      additive: (p.get('ad') as AdditiveReaction) ?? 'none',
      transformative: (p.get('tr') as TransformativeReaction) ?? 'none',
      swirlElement: (p.get('se') as ElementType) ?? 'pyro',
      reactionBonus: num('rb', 0),
      ampReactionBonus: num('arb', 0),
      transformReactionBonus: num('trb', 0),
      defShred: num('ds', 0),
      defIgnore: num('di', 0),
      resShred: num('rs', 0),
      constellation: num('cn', 0),
      passiveOn: (p.get('pv') ?? '')
        .split('.')
        .map((x) => parseInt(x, 10))
        .filter((n) => Number.isInteger(n) && n >= 0),
      artifacts: {
        sandsMain: p.has('sand') ? { type: p.get('sand') as SecondaryStatType, value: mainValueFor(p.get('sand') as SecondaryStatType) } : { ...base.artifacts.sandsMain },
        gobletMain: p.has('gob') ? { type: p.get('gob') as SecondaryStatType, value: mainValueFor(p.get('gob') as SecondaryStatType) } : { ...base.artifacts.gobletMain },
        circletMain: p.has('circ') ? { type: p.get('circ') as SecondaryStatType, value: mainValueFor(p.get('circ') as SecondaryStatType) } : { ...base.artifacts.circletMain },
        flowerHP: base.artifacts.flowerHP ?? 0,
        plumeATK: base.artifacts.plumeATK ?? 0,
        sets: p.has('ps')
          ? (() => {
              const parts = (p.get('ps') ?? '').split(',');
              return { flower: parts[0] ?? '', plume: parts[1] ?? '', sands: parts[2] ?? '', goblet: parts[3] ?? '', circlet: parts[4] ?? '' };
            })()
          : { ...(base.artifacts.sets ?? EMPTY_SETS) },
        pieceSubs: p.has('subs')
          ? (p.get('subs') ?? '').split(';').map((piece) =>
              piece
                .split(',')
                .filter(Boolean)
                .map((entry) => {
                  const [type, value] = entry.split('~');
                  return { type: type as SecondaryStatType, value: clamp(parseFloat(value) || 0, 0, 1_000_000) };
                }),
            )
          : (base.artifacts.pieceSubs ?? []),
      },
    }));
  }, [initial]);

  // Picker dialog wiring.
  useEffect(() => {
    const d = pickerDialog.current;
    if (!d) return;
    if (pickerOpen && !d.open) d.showModal();
    if (!pickerOpen && d.open) d.close();
  }, [pickerOpen]);

  const roster = CHARACTERS.filter(
    (c) =>
      (elementFilter === 'all' || c.element === elementFilter) &&
      (query.trim() === '' || c.name.toLowerCase().includes(query.trim().toLowerCase())),
  );
  const groups = ELEMENTS.map((el) => ({ el, rows: roster.filter((c) => c.element === el) })).filter((g) => g.rows.length > 0);

  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
      active ? 'border-forest-600 bg-forest-600/10 text-forest-700' : 'border-[var(--line)] text-[var(--muted)] hover:text-[var(--text)]'
    }`;

  const statRows: { label: string; base: number; mod: number; total: number; fmt: 'int' | 'pct' }[] = [
    { label: 'HP', base: result.baseHP, mod: result.totalHP - result.baseHP, total: result.totalHP, fmt: 'int' },
    { label: 'ATK', base: result.baseATK, mod: result.totalATK - result.baseATK, total: result.totalATK, fmt: 'int' },
    { label: 'DEF', base: result.baseDEF, mod: result.totalDEF - result.baseDEF, total: result.totalDEF, fmt: 'int' },
    { label: 'Elemental Mastery', base: 0, mod: result.em, total: result.em, fmt: 'int' },
    { label: 'Energy Recharge', base: 1, mod: result.er, total: 1 + result.er, fmt: 'pct' },
    { label: 'CRIT Rate', base: 0.05, mod: result.critRateRaw - 0.05, total: result.critRateRaw, fmt: 'pct' },
    { label: 'CRIT DMG', base: 0.5, mod: result.critDMG - 0.5, total: result.critDMG, fmt: 'pct' },
  ];

  const chain: { id: string; label: string; value: number; display: string }[] = [
    { id: 'base', label: 'Base', value: 0, display: formatNumber(baseDamage) },
    { id: 'bonus', label: 'Bonus', value: dmgMult, display: `×${dmgMult.toFixed(3)}` },
    { id: 'crit', label: 'Crit', value: critMult, display: `×${critMult.toFixed(3)}` },
    { id: 'reaction', label: 'Reaction', value: result.reactionMultiplier, display: `×${result.reactionMultiplier.toFixed(3)}` },
    { id: 'def', label: 'DEF', value: result.defMultiplier, display: `×${result.defMultiplier.toFixed(3)}` },
    { id: 'res', label: 'RES', value: result.resMultiplier, display: `×${result.resMultiplier.toFixed(3)}` },
  ];

  const contribution = chain
    .filter((c) => c.id !== 'base' && c.value > 0)
    .map((c) => ({ ...c, gain: expected - expected / c.value }));

  return (
    <div className="mx-auto flex w-full flex-col lg:h-[calc(100dvh-7rem)] lg:min-h-0">
      {/* ============ Scenario bar ============ */}
      <div className="panel shrink-0 p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
          {/* Character card */}
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            aria-label={`Change character (currently ${character.name})`}
            title="Change character"
            className="group relative block w-full shrink-0 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] text-left transition-colors hover:border-forest-500 lg:w-[160px]"
          >
            <span className="relative block h-[160px] w-full overflow-hidden">
              <span className={`absolute inset-0 bg-linear-to-b ${ELEMENT_BG[character.element] ?? ELEMENT_BG.physical}`} aria-hidden="true" />
              <img src={`/images/portraits/${character.id}.webp`} alt="" width="256" height="256" className="relative h-full w-full object-cover" />
              <ElementIcon el={character.element} className="absolute right-1.5 top-1.5 h-6 w-6" />
              <span className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/85 via-black/40 to-transparent px-2.5 pb-2 pt-8">
                <span className="flex items-center gap-1.5 truncate text-sm font-semibold text-white">
                  <ElementIcon el={character.element} className="h-4 w-4" />
                  {character.name}
                </span>
                <span className="block text-[10px] text-white/80">
                  {ELEMENT_LABEL[character.element]} · {character.weaponType}
                </span>
              </span>
              <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/55 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h13l-3-3M20 17H7l3 3" /></svg>
                <span className="text-[11px] font-semibold uppercase tracking-wide">Change</span>
              </span>
            </span>
          </button>

          {/* Controls — a grid that fills the width instead of wrapping with gaps */}
          <div className="grid flex-1 grid-cols-2 content-start gap-2.5 sm:grid-cols-4">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-[var(--muted)]">Level</span>
              <input
                type="number"
                min={1}
                max={90}
                value={draft.level}
                onChange={(e) => set('level', Math.min(90, Math.max(1, parseInt(e.target.value, 10) || 90)))}
                className="h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 text-right text-sm text-[var(--text)]"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-[var(--muted)]">Constellation</span>
              <select
                value={draft.constellation}
                onChange={(e) => {
                  const cn = parseInt(e.target.value, 10);
                  setDraft((d) => ({
                    ...d,
                    constellation: cn,
                    skillMult: d.activeRowId
                      ? d.skillMult
                      : signatureMultiplierAt(character.id, d.attackType, effectiveTalentLevels(character.id, d.talentLevels, cn)) || d.skillMult,
                  }));
                }}
                className="h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 text-sm text-[var(--text)]"
              >
                {[0, 1, 2, 3, 4, 5, 6].map((c) => (
                  <option key={c} value={c}>
                    C{c}
                  </option>
                ))}
              </select>
            </label>

            <div className="col-span-2 flex flex-col gap-1">
              <span className="text-[11px] font-medium text-[var(--muted)]" title="Talent level caps at 10. Constellation C3 / C5 raise one talent by +3 (up to 15); a few passives add +1. Set 11-15 only when that applies.">
                Talents — Normal / Skill / Burst <span className="text-[10px] font-normal">(cap 10)</span>
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    ['normal', 'Normal Attack (also Charged / Plunge)'],
                    ['skill', 'Elemental Skill'],
                    ['burst', 'Elemental Burst'],
                  ] as const
                ).map(([g, label]) => (
                  <input
                    key={g}
                    type="number"
                    min={1}
                    max={15}
                    value={draft.talentLevels[g]}
                    onChange={(e) => changeTalentLevel(g, parseInt(e.target.value, 10) || 1)}
                    title={label}
                    aria-label={label}
                    className="h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-1 text-center text-sm text-[var(--text)]"
                  />
                ))}
              </div>
              {talentBonusNote && <span className="text-[10px] font-semibold text-forest-600">{talentBonusNote}</span>}
            </div>

            <label className="col-span-2 flex flex-col gap-1">
              <span className="text-[11px] font-medium text-[var(--muted)]">Weapon</span>
              <IconSelect
                className="relative w-full"
                value={weapon?.id ?? ''}
                onChange={(v) => set('weaponId', v)}
                options={weaponOptions.map((w) => ({
                  value: w.id,
                  label: `${w.name} · ${w.rarity}★`,
                  icon: <img src={`/images/weapons/${w.id}.webp`} alt="" width="48" height="48" className="h-6 w-6 object-contain" loading="lazy" decoding="async" />,
                }))}
              />
            </label>

            <div className="col-span-2 flex flex-col gap-1">
              <span className="text-[11px] font-medium text-[var(--muted)]">Enemy</span>
              <div className="flex items-center gap-2">
                <IconSelect
                  className="relative flex-1"
                  value={draft.customEnemy ? 'custom' : draft.enemyId}
                  onChange={(v) => {
                    if (v === 'custom') {
                      setDraft((d) => ({ ...d, customEnemy: true, enemyLevel: enemy.level }));
                    } else {
                      setDraft((d) => ({ ...d, customEnemy: false, enemyId: v }));
                    }
                  }}
                  options={[
                    ...ENEMIES.map((en) => ({ value: en.id, label: `${en.name} · Lv${en.level}`, icon: <Glyph name="enemy" className="h-5 w-5 text-[var(--muted)]" /> })),
                    { value: 'custom', label: 'Custom…' },
                  ]}
                />
                {draft.customEnemy && (
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={draft.enemyLevel}
                    onChange={(e) => set('enemyLevel', clamp(parseInt(e.target.value, 10) || 90, 1, 100))}
                    aria-label="Enemy level"
                    className="h-9 w-16 shrink-0 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 text-right text-sm text-[var(--text)]"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Result */}
          <div className="flex shrink-0 items-center justify-between gap-3 rounded-xl border border-forest-500/25 bg-forest-500/8 px-4 py-2.5 lg:w-[190px] lg:flex-col lg:items-end lg:justify-center">
            <div className="text-right">
              <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-forest-600">Expected</span>
              <span className="damage-number tnum text-3xl leading-none">{formatNumber(expected)}</span>
            </div>
            <span className="text-[11px] leading-tight text-[var(--muted)] lg:text-right">
              {formatNumber(result.nonCrit)}
              <span className="hidden lg:inline"> non-crit</span>
              <br />
              {formatNumber(result.critHit)}
              <span className="hidden lg:inline"> crit</span>
            </span>
          </div>
        </div>
      </div>
      {/* ============ Tabs + build tools ============ */}
      <div className="mt-3 flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ['character', 'Character'],
              ['equipment', 'Equipment'],
              ['multipliers', 'Multipliers'],
              ['damage', 'Damage'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`rounded-full px-3.5 py-1 text-sm font-medium transition-colors ${
                tab === id ? 'bg-forest-600 text-white' : 'border border-[var(--line)] text-[var(--muted)] hover:text-[var(--text)]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>


      {/* ============ Tab content — scrolls inside the fixed shell ============ */}
      <div className="mt-3 min-h-0 flex-1 lg:overflow-y-auto lg:pr-1">

      {/* ============ Constellations & passives (Character tab) ============ */}
      {tab === 'character' && (constellations.length > 0 || ascensionPassives.length > 0) && (
        <details className="panel mt-3 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-[var(--text)]">Constellations &amp; ascension passives</summary>
          <div className="mt-3">
            <ul className="max-h-[260px] space-y-2 overflow-y-auto pr-1">
              {constellations.map((c) => (
                <li key={c.level} className={c.level <= draft.constellation ? '' : 'opacity-45'}>
                  <p className="text-xs font-medium text-[var(--text)]">
                    C{c.level} · {c.name}
                    {consModelled[c.level] && <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-forest-600">modelled</span>}
                  </p>
                  <p className="text-xs leading-relaxed text-[var(--muted)]">{c.description}</p>
                </li>
              ))}
            </ul>
            {ascensionPassives.length > 0 && (
              <div className="mt-4 border-t border-[var(--line)] pt-3">
                <p className="text-xs font-semibold text-[var(--muted)]">Ascension passives</p>
                <ul className="mt-2 max-h-[200px] space-y-2 overflow-y-auto pr-1">
                  {ascensionPassives.map((p, i) => (
                    <li key={i}>
                      <label className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={draft.passiveOn.includes(i)}
                          disabled={!passiveModelled[i]}
                          onChange={(e) =>
                            set('passiveOn', e.target.checked ? [...draft.passiveOn, i] : draft.passiveOn.filter((x) => x !== i))
                          }
                        />
                        <span>
                          <span className="text-xs font-medium text-[var(--text)]">
                            {p.name}
                            {passiveModelled[i] && <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-forest-600">modelled</span>}
                          </span>
                          <span className="block text-xs leading-relaxed text-[var(--muted)]">{p.description}</span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </details>
      )}

      {/* ============ Character picker ============ */}
      {pickerOpen && (
        <dialog
          ref={pickerDialog}
          className="picker-dialog"
          onClose={() => setPickerOpen(false)}
          onClick={(e) => {
            if (e.target === e.currentTarget) setPickerOpen(false);
          }}
        >
          <div className="flex max-h-[80vh] flex-col p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-[var(--text)]">Choose a character</h2>
              <button type="button" onClick={() => setPickerOpen(false)} aria-label="Close" className="rounded-full px-2 py-1 text-sm text-[var(--muted)] hover:text-[var(--text)]">✕</button>
            </div>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search a character…"
              className="mt-3 h-9 w-full rounded-full border border-[var(--line)] bg-[var(--surface)] px-4 text-sm text-[var(--text)]"
              aria-label="Search characters"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button type="button" onClick={() => setElementFilter('all')} className={chip(elementFilter === 'all')}>All</button>
              {ELEMENTS.map((el) => (
                <button key={el} type="button" onClick={() => setElementFilter(el)} className={chip(elementFilter === el)}>{ELEMENT_LABEL[el]}</button>
              ))}
            </div>
            <div className="mt-3 flex-1 overflow-y-auto pr-1">
              {groups.map((g) => (
                <div key={g.el} className="mb-4">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
                    <ElementIcon el={g.el} className="h-4 w-4" />
                    {ELEMENT_LABEL[g.el]}
                    <span className="text-xs font-normal text-[var(--muted)]">({g.rows.length})</span>
                  </h3>
                  <div className="mt-2 grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(112px, 1fr))' }}>
                    {g.rows.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => { pickCharacter(c.id); setPickerOpen(false); }}
                        title={c.name}
                        className={`relative aspect-square overflow-hidden rounded-xl ring-1 transition-all ${c.id === character.id ? 'ring-2 ring-forest-500' : 'ring-[var(--line)] hover:ring-forest-400'}`}
                      >
                        <span className={`absolute inset-0 bg-linear-to-b ${ELEMENT_BG[c.element] ?? ELEMENT_BG.physical}`} aria-hidden="true" />
                        <img src={`/images/portraits/${c.id}.webp`} alt={`${c.name} portrait`} width="256" height="256" loading="lazy" decoding="async" className={`relative h-full w-full object-cover ${c.id === character.id ? 'opacity-70' : ''}`} />
                        <ElementIcon el={c.element} className="absolute right-1.5 top-1.5 h-6 w-6" />
                        {c.id === character.id && (
                          <span className="absolute left-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-forest-600 text-xs font-bold text-white shadow" aria-hidden="true">✓</span>
                        )}
                        <span className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/80 to-transparent px-2 pb-1.5 pt-6 text-left">
                          <span className="block truncate text-[11px] font-semibold text-white drop-shadow">{c.name}</span>
                        </span>
                      </button>
                ))}
              </div>
            </div>
              ))}
            </div>
          </div>
        </dialog>
      )}

      {/* ============ Compact sticky result (mobile) ============ */}
      <div className="sticky top-2 z-40 mt-4 lg:hidden">
        <div className="calc-bar rounded-2xl px-4 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-forest-600">Damage</span>
            <span className="damage-number tnum text-2xl">{formatNumber(expected)}</span>
            <span className="tnum text-[11px] text-[var(--muted)]">
              {formatNumber(result.nonCrit)} / {formatNumber(result.critHit)}
            </span>
          </div>
        </div>
      </div>

      <div>
        <div className={tab === 'multipliers' ? 'grid grid-cols-1 content-start gap-2.5 sm:grid-cols-2 lg:grid-cols-3' : tab === 'equipment' ? 'grid grid-cols-1 items-start gap-3 lg:grid-cols-2' : 'space-y-4'}>
          {/* Character stats — base / mod / total, mirroring the reference panels */}
          {tab === 'character' && (
          <section className="panel p-5">
            <h3 className="text-base font-semibold text-[var(--text)]">Character stats</h3>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--line)] text-xs uppercase tracking-wide text-[var(--muted)]">
                    <th className="py-2 pr-3 font-medium">Stat</th>
                    <th className="px-3 py-2 text-right font-medium">Base</th>
                    <th className="px-3 py-2 text-right font-medium">Mod</th>
                    <th className="py-2 pl-3 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {statRows.map((r) => (
                    <tr key={r.label} className="border-b border-[var(--line)]/60 last:border-b-0">
                      <td className="py-1.5 pr-3 text-[var(--muted)]">{r.label}</td>
                      <td className="px-3 py-1.5 text-right tnum text-[var(--text)]">{r.fmt === 'pct' ? formatPercent(r.base) : formatNumber(r.base)}</td>
                      <td className="px-3 py-1.5 text-right tnum text-forest-600">{r.mod > 0 ? '+' : ''}{r.fmt === 'pct' ? formatPercent(r.mod) : formatNumber(r.mod)}</td>
                      <td className="py-1.5 pl-3 text-right tnum font-semibold text-[var(--text)]">{r.fmt === 'pct' ? formatPercent(r.total) : formatNumber(r.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          )}

          {tab === 'multipliers' && (
          <>
          {/* 1 — Base */}
          <Zone id="base" index={1} title="Base damage" value={formatNumber(baseDamage)} changed={draft.statOverride != null} onReset={() => set('statOverride', null)} onEnter={setHighlight}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-medium text-[var(--muted)]">{SCALING_LABEL[result.scaling]} (whiteboard, editable)</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={Math.round(whiteboard.baseStat)}
                  max={1_000_000}
                  value={Math.round(draft.statOverride ?? whiteboard.baseStat)}
                  onChange={(e) => set('statOverride', clamp(parseFloat(e.target.value) || 0, Math.round(whiteboard.baseStat), 1_000_000))}
                  className="mt-1 w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-right text-[var(--text)]"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-[var(--muted)]">Skill type</span>
                <IconSelect
                  value={draft.attackType}
                  onChange={(t) => {
                    setDraft((d) => ({
                      ...d,
                      attackType: t,
                      skillMult: signatureMultiplierAt(character.id, t, effectiveTalentLevels(character.id, d.talentLevels, d.constellation)) || d.skillMult,
                      activeRowId: null,
                      elementOverride: null,
                      scalingOverride: null,
                    }));
                  }}
                  options={ATTACKS.map((a) => ({ ...a, icon: <Glyph name={a.value} className="h-5 w-5" /> }))}
                />
              </label>
              <Pct label="Skill multiplier" value={draft.skillMult} onChange={(v) => setDraft((d) => ({ ...d, skillMult: v, activeRowId: null }))} step={1} min={0} max={10000} />
              <div className="grid grid-cols-2 gap-3">
                <Pct label="Base DMG bonus" value={draft.baseDmgBonus} onChange={(v) => set('baseDmgBonus', v)} min={-100} max={1000} />
                <Num label="Flat base DMG" value={draft.flatBaseDmg} onChange={(v) => set('flatBaseDmg', v)} step={10} min={0} max={1_000_000} />
              </div>
            </div>
          </Zone>

          {/* 2 — Bonus */}
          <Zone id="bonus" index={2} title="DMG bonus" value={`×${dmgMult.toFixed(3)}`} changed={!!(draft.dmgBonus || draft.naDmgBonus || draft.caDmgBonus || draft.skillDmgBonus || draft.burstDmgBonus || draft.dmgReduction)} onReset={() => setDraft((d) => ({ ...d, dmgBonus: 0, naDmgBonus: 0, caDmgBonus: 0, skillDmgBonus: 0, burstDmgBonus: 0, dmgReduction: 0 }))} onEnter={setHighlight}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Pct label="Elemental / Physical DMG" value={draft.dmgBonus} onChange={(v) => set('dmgBonus', v)} min={0} max={2000} />
              <Pct label="Target DMG reduction" value={draft.dmgReduction} onChange={(v) => set('dmgReduction', v)} min={0} max={100} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Pct label="Normal Attack DMG" value={draft.naDmgBonus} onChange={(v) => set('naDmgBonus', v)} min={-100} max={2000} />
              <Pct label="Charged Attack DMG" value={draft.caDmgBonus} onChange={(v) => set('caDmgBonus', v)} min={-100} max={2000} />
              <Pct label="Elemental Skill DMG" value={draft.skillDmgBonus} onChange={(v) => set('skillDmgBonus', v)} min={-100} max={2000} />
              <Pct label="Elemental Burst DMG" value={draft.burstDmgBonus} onChange={(v) => set('burstDmgBonus', v)} min={-100} max={2000} />
            </div>
          </Zone>

          {/* 3 — Crit */}
          <Zone id="crit" index={3} title="CRIT" value={`×${critMult.toFixed(3)}`} changed={!!(draft.critRate || draft.critDMG || draft.critMode !== 'expected')} onReset={() => setDraft((d) => ({ ...d, critRate: 0, critDMG: 0, critMode: 'expected' }))} onEnter={setHighlight}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Pct label="CRIT Rate bonus" value={draft.critRate} onChange={(v) => set('critRate', v)} min={0} max={100} />
              <Pct label="CRIT DMG bonus" value={draft.critDMG} onChange={(v) => set('critDMG', v)} min={0} max={1000} />
              <label className="block">
                <span className="text-xs font-medium text-[var(--muted)]">Settlement</span>
                <IconSelect
                  value={draft.critMode}
                  onChange={(v) => set('critMode', v as CritMode)}
                  options={[
                    { value: 'expected', label: 'Expected (average)', icon: <Glyph name="expected" className="h-5 w-5" /> },
                    { value: 'crit', label: 'Always CRIT', icon: <Glyph name="crit" className="h-5 w-5" /> },
                    { value: 'nonCrit', label: 'Never CRIT', icon: <Glyph name="nonCrit" className="h-5 w-5" /> },
                  ]}
                />
              </label>
            </div>
            {result.critRateRaw > 1 && (
              <p className="mt-2 text-xs text-pyro">CRIT Rate is overcapped — {((result.critRateRaw - 1) * 100).toFixed(1)}% of it is wasted past the 100% cap.</p>
            )}
          </Zone>

          {/* 4 — Reaction */}
          <Zone id="reaction" index={4} title="Reaction" value={result.reactionMultiplier > 1 ? `×${result.reactionMultiplier.toFixed(3)}` : '—'} changed={!!(draft.amplified !== 'none' || draft.additive !== 'none' || draft.transformative !== 'none' || draft.em || draft.reactionBonus)} onReset={() => setDraft((d) => ({ ...d, amplified: 'none', additive: 'none', transformative: 'none', em: 0, reactionBonus: 0, ampReactionBonus: 0, transformReactionBonus: 0 }))} onEnter={setHighlight}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-medium text-[var(--muted)]">Amplifying — Vaporize / Melt (×1.5–2, multiplies the hit)</span>
                <IconSelect value={draft.amplified} onChange={(v) => set('amplified', v)} options={AMPLIFIED.map((o) => ({ ...o, icon: REACTION_ELEMENT[o.value] ? <ElementPair els={REACTION_ELEMENT[o.value]} /> : undefined }))} />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-[var(--muted)]">Additive — Aggravate / Spread (flat bonus to the hit)</span>
                <IconSelect value={draft.additive} onChange={(v) => set('additive', v)} options={ADDITIVE.map((o) => ({ ...o, icon: REACTION_ELEMENT[o.value] ? <ElementPair els={REACTION_ELEMENT[o.value]} /> : undefined }))} />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-[var(--muted)]">Transformative — Overload, Burning, Burgeon… (separate hit, no CRIT)</span>
                <IconSelect value={draft.transformative} onChange={(v) => set('transformative', v)} options={TRANSFORMATIVE.map((o) => ({ ...o, icon: REACTION_ELEMENT[o.value] ? <ElementPair els={REACTION_ELEMENT[o.value]} /> : undefined }))} />
              </label>
              {draft.transformative === 'swirl' && (
                <label className="block">
                  <span className="text-xs font-medium text-[var(--muted)]">Swirl absorbed element</span>
                  <IconSelect value={draft.swirlElement} onChange={(v) => set('swirlElement', v)} options={SWIRLABLE.map((el) => ({ value: el, label: ELEMENT_LABEL[el], icon: <ElementIcon el={el} className="h-5 w-5" /> }))} />
                </label>
              )}
              <Num label={`Elemental Mastery bonus (base ${Math.round(ownEM)})`} value={draft.em} onChange={(v) => set('em', v)} step={10} min={0} max={3000} />
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Pct label="Reaction bonus" value={draft.reactionBonus} onChange={(v) => set('reactionBonus', v)} min={0} max={1000} />
              <Pct label="Amplifying bonus" value={draft.ampReactionBonus} onChange={(v) => set('ampReactionBonus', v)} min={0} max={1000} />
              <Pct label="Transformative bonus" value={draft.transformReactionBonus} onChange={(v) => set('transformReactionBonus', v)} min={0} max={1000} />
            </div>
          </Zone>

          {/* 5 — DEF */}
          <Zone id="def" index={5} title="Enemy DEF" value={`×${result.defMultiplier.toFixed(3)}`} changed={!!(draft.defShred || draft.defIgnore)} onReset={() => setDraft((d) => ({ ...d, defShred: 0, defIgnore: 0 }))} onEnter={setHighlight}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Pct label="DEF reduction" value={draft.defShred} onChange={(v) => set('defShred', v)} min={0} max={100} />
              <Pct label="DEF ignore" value={draft.defIgnore} onChange={(v) => set('defIgnore', v)} min={0} max={100} />
            </div>
          </Zone>

          {/* 6 — RES */}
          <Zone id="res" index={6} title="Enemy RES" value={`×${result.resMultiplier.toFixed(3)}`} changed={!!(draft.resShred || Object.keys(draft.enemyResMap).length)} onReset={() => setDraft((d) => ({ ...d, resShred: 0, enemyResMap: {} }))} onEnter={setHighlight}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {ENEMY_ELEMENTS.map((el) => (
                <Pct
                  key={el}
                  label={`${ELEMENT_LABEL[el]} RES`}
                  value={enemy.resistances[el] ?? enemy.resistances.default}
                  onChange={(v) => setDraft((d) => ({ ...d, enemyResMap: { ...d.enemyResMap, [el]: v } }))}
                  min={-100}
                  max={100}
                />
              ))}
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Pct label="RES reduction" value={draft.resShred} onChange={(v) => set('resShred', v)} min={0} max={200} />
            </div>
          </Zone>
          </>
          )}

          {/* Artifacts — added on top of the character's own stats */}
          {tab === 'equipment' && (
          <>
          {weaponPassive && (
            <section className="panel p-4">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <h3 className="text-sm font-semibold text-[var(--text)]">
                  {weaponPassive.effectName}
                  <span className="ml-2 text-xs font-normal text-[var(--muted)]">{weapon?.name}</span>
                </h3>
                <label className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
                  Refinement
                  <select
                    value={draft.weaponRefine}
                    onChange={(e) => set('weaponRefine', parseInt(e.target.value, 10))}
                    className="h-8 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 text-sm text-[var(--text)]"
                  >
                    {[1, 2, 3, 4, 5].map((r) => (
                      <option key={r} value={r}>
                        R{r}
                      </option>
                    ))}
                  </select>
                </label>
                {weaponEffect ? (
                  weaponMaxStacks > 1 ? (
                    <span className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
                      Stacks
                      {Array.from({ length: weaponMaxStacks + 1 }, (_, i) => i).map((i) => (
                        <button key={i} type="button" onClick={() => set('weaponStacks', i)} className={chip(draft.weaponStacks === i)}>
                          {i}
                        </button>
                      ))}
                    </span>
                  ) : (
                    <label className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
                      <input type="checkbox" checked={draft.weaponStacks > 0} onChange={(e) => set('weaponStacks', e.target.checked ? 1 : 0)} />
                      Applied
                    </label>
                  )
                ) : (
                  <span className="text-[11px] text-pyro">Not modelled for damage — set it manually in the zones below.</span>
                )}
              </div>
              <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">{weaponRefDesc}</p>
              {weaponEffect?.note && <p className="mt-1 text-[11px] italic text-[var(--muted)]">{weaponEffect.note}</p>}
            </section>
          )}
          <section className="panel p-4">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-base font-semibold text-[var(--text)]">
                Artifacts{' '}
                <span className="text-xs font-normal text-[var(--muted)]">sample build — edit to match your own</span>
              </h3>
              <button type="button" onClick={() => set('artifacts', { ...NO_ARTIFACTS })} className="text-[11px] text-[var(--muted)] underline underline-offset-2 hover:text-forest-600">
                clear
              </button>
            </div>

            {/* Artifact pieces — 5 slots, each picks a set (+ main stat where selectable) */}
            <div className="mt-2 rounded-[12px] border border-[var(--line)] p-2.5">
              <span className="text-xs font-medium text-[var(--muted)]">
                Pieces <span className="text-[10px] font-normal">— set bonuses come from 2 or 4 matching pieces</span>
              </span>
              <div className="mt-2 space-y-2">
                {PIECE_ROWS.map((row) => {
                  const mainOpt = row.mainSlot ? MAIN_OPTIONS.find((m) => m.slot === row.mainSlot) : undefined;
                  return (
                    <div key={row.piece} className="flex items-center gap-2">
                      <span className="w-12 shrink-0 text-[11px] text-[var(--muted)]">{row.label}</span>
                      <div className="min-w-0 flex-1">
                        <IconSelect
                          value={(draft.artifacts.sets?.[row.piece] ?? '') || 'none'}
                          onChange={(v) => setPieceSet(row.piece, v)}
                          options={[
                            { value: 'none', label: 'No set' },
                            ...ARTIFACT_SETS.map((s) => ({
                              value: s.id,
                              label: s.name,
                              icon: <img src={`/images/artifact-sets/${s.id}-${row.piece}.webp`} alt="" width="48" height="48" className="h-7 w-7 object-contain" loading="lazy" decoding="async" />,
                            })),
                          ]}
                        />
                      </div>
                      {mainOpt ? (
                        <div className="w-36 shrink-0">
                          <IconSelect
                            value={draft.artifacts[mainOpt.slot].value > 0 ? draft.artifacts[mainOpt.slot].type : 'none'}
                            onChange={(v) => {
                              if (v === 'none') setArtifact({ [mainOpt.slot]: { ...NO_ARTIFACTS[mainOpt.slot] } } as Partial<ArtifactBuild>);
                              else setArtifact({ [mainOpt.slot]: { type: v as SecondaryStatType, value: mainValueFor(v as SecondaryStatType) } } as Partial<ArtifactBuild>);
                            }}
                            options={[
                              { value: 'none', label: 'None' },
                              ...mainOpt.options.map((o) => ({ value: o as string, label: `${SECONDARY_LABEL[o]} · ${formatMainValue(o)}`, icon: <Glyph name={STAT_GLYPH[o]} className="h-5 w-5" /> })),
                            ]}
                          />
                        </div>
                      ) : (
                        <span className="w-36 shrink-0 text-right text-[11px] text-[var(--muted)]">{row.fixed}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            {/* Sub-stats — four per piece, pieces across, slots down */}
            <div className="mt-3">
              <span className="text-xs font-medium text-[var(--muted)]">
                Sub-stats <span className="text-[10px] font-normal">— four per piece</span>
              </span>
              <div className="mt-2 grid grid-cols-5 gap-2">
                {PIECE_ROWS.map((row, pieceIdx) => (
                  <div key={row.piece} className="min-w-0">
                    <span className="mb-1 block text-center text-[10px] text-[var(--muted)]">{row.label}</span>
                    <div className="space-y-1.5">
                      {[0, 1, 2, 3].map((slot) => {
                        const sub = draft.artifacts.pieceSubs?.[pieceIdx]?.[slot];
                        const opt = SUB_OPTIONS.find((o) => o.type === sub?.type);
                        return (
                          <div key={slot} className="flex items-center gap-1">
                            <select
                              value={sub?.type ?? 'none'}
                              aria-label={`${row.label} sub-stat ${slot + 1}`}
                              onChange={(e) => setPieceSub(pieceIdx, slot, e.target.value as SecondaryStatType | 'none')}
                              className="h-8 w-full min-w-0 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-1 text-[11px] text-[var(--text)]"
                            >
                              <option value="none">—</option>
                              {SUB_OPTIONS.map((o) => (
                                <option key={o.type} value={o.type}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                            <input
                              type="number"
                              inputMode="decimal"
                              disabled={!sub}
                              value={sub ? (opt?.percent ? Number((sub.value * 100).toFixed(2)) : sub.value) : ''}
                              onChange={(e) => setPieceSubValue(pieceIdx, slot, parseFloat(e.target.value) || 0, !!opt?.percent)}
                              className="h-8 w-14 shrink-0 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-1 text-right text-[11px] text-[var(--text)] disabled:opacity-40"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <p className="mt-2 border-t border-[var(--line)] pt-2 text-[11px] text-[var(--muted)]">
              With artifacts: ATK <strong className="text-[var(--text)]">{formatNumber(result.totalATK)}</strong> · CRIT <strong className="text-[var(--text)]">{formatPercent(result.critRate)}</strong> / <strong className="text-[var(--text)]">{formatPercent(result.critDMG)}</strong> · EM <strong className="text-[var(--text)]">{Math.round(result.em)}</strong>
            </p>
          </section>
          </>
          )}

          {tab === 'damage' && (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
          <div className="space-y-4">
          <div className="max-h-[46vh] overflow-y-auto pr-1">
            <DamageTable groups={damageGroups} onPick={pickRow} />
          </div>
          </div>

          <div className="space-y-4">
            <div className="panel p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs uppercase tracking-wide text-[var(--muted)]">Expected</span>
                <span className="tnum text-xl font-semibold text-[var(--text)]">{formatNumber(expected)}</span>
              </div>
              <p className="mt-0.5 text-[11px] text-[var(--muted)]">non-crit {formatNumber(result.nonCrit)} · crit {formatNumber(result.critHit)}</p>
              {capped && <p className="mt-1 text-[11px] text-pyro">Capped at 20,000,000 (single-hit limit).</p>}
            </div>

            {(reactionPreviews.amplified.length > 0 || reactionPreviews.transformative.length > 0) && (
              <details className="panel p-4">
                <summary className="cursor-pointer text-sm font-semibold text-[var(--text)]">
                  Reactions <span className="ml-2 text-[11px] font-normal text-[var(--muted)]">click to apply</span>
                </summary>
                <div className="mt-2 space-y-1">
                  {reactionPreviews.amplified.map((a) => (
                    <button
                      key={a.key}
                      type="button"
                      onClick={() => set('amplified', a.key)}
                      className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
                        draft.amplified === a.key ? 'bg-forest-600/12 text-forest-700' : 'text-[var(--muted)] hover:bg-[var(--soft)]'
                      }`}
                    >
                      <span>{a.label}</span>
                      <span className="tnum text-[var(--text)]">×{a.multiplier.toFixed(2)}</span>
                    </button>
                  ))}
                  {reactionPreviews.transformative.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => set('transformative', t.key)}
                      className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
                        draft.transformative === t.key ? 'bg-forest-600/12 text-forest-700' : 'text-[var(--muted)] hover:bg-[var(--soft)]'
                      }`}
                    >
                      <span>{t.label}</span>
                      <span className="tnum text-forest-600">{formatNumber(t.value)}</span>
                    </button>
                  ))}
                </div>
              </details>
            )}

            <details className="panel p-4">
              <summary className="cursor-pointer text-sm font-semibold text-[var(--text)]">Formula &amp; contribution</summary>
              <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
                {chain.map((c, i) => (
                  <span key={c.id} className="inline-flex items-center gap-1.5">
                    {i > 0 && <span className="text-[var(--muted)]">×</span>}
                    <button
                      type="button"
                      onClick={() => {
                        setHighlight(c.id);
                        setTab('multipliers');
                        requestAnimationFrame(() => zoneRefs.get(c.id)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
                      }}
                      className={`tnum rounded px-1.5 py-0.5 transition-colors ${highlight === c.id ? 'bg-forest-500/15 text-forest-700' : 'text-[var(--text)] hover:bg-[var(--soft)]'}`}
                    >
                      {c.display}
                    </button>
                  </span>
                ))}
                <span className="text-[var(--muted)]">=</span>
                <span className="tnum font-semibold text-forest-600">{formatNumber(expected)}</span>
              </div>
              <div className="mt-3 max-h-[200px] space-y-2.5 overflow-y-auto pr-1">
                {contribution.map((c) => (
                  <div key={c.id}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[var(--muted)]">{c.label} {c.display}</span>
                      <span className="tnum font-medium text-forest-600">+{formatNumber(c.gain)} ({expected > 0 ? Math.round((c.gain / expected) * 100) : 0}%)</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]">
                      <div className="h-full rounded-full bg-forest-600" style={{ width: `${Math.min((c.gain / expected) * 100, 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              {result.transformative > 0 && (
                <p className="mt-3 border-t border-[var(--line)] pt-2 text-[11px] text-[var(--muted)]">
                  Transformative reaction adds <span className="tnum font-semibold text-forest-600">+{formatNumber(result.transformative)}</span> {result.transformativeName} as a separate hit.
                </p>
              )}
            </details>
          </div>
          </div>
          )}
        </div>

      </div>

      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {character.name} expected damage {formatNumber(expected)}.
      </p>
    </div>
  );
}
