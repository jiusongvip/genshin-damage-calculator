import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { RELEASED_CHARACTERS as CHARACTERS } from '../data/characters';
import { weaponsForType } from '../data/weapons';
import { ENEMIES } from '../data/enemies';
import { NO_ARTIFACTS, DEFAULT_BUFFS, MAIN_STATS } from '../data/presets';
import { addBuffs, computeDamage, formatNumber, formatPercent } from '../lib/damage';
import type {
  AdditiveReaction,
  AmplifiedReaction,
  ArtifactBuild,
  BuffState,
  ElementType,
  SecondaryStatType,
  TransformativeReaction,
} from '../lib/damage';
import { ELEMENT_LABEL } from '../data/elements';
import { TALENTS, signatureTalent } from '../data/talents';
import type { TalentKey } from '../data/talents';
import { ElementIcon } from './TeamCalculator';

const ELEMENTS: ElementType[] = ['pyro', 'hydro', 'electro', 'cryo', 'anemo', 'geo', 'dendro'];
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
  { value: 'aggravate', label: 'Aggravate (超激化)' },
  { value: 'spread', label: 'Spread (蔓激化)' },
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

/** Everything the user can edit, in one object so URL save/restore is trivial. */
interface Draft {
  charId: string;
  level: number;
  weaponId: string;
  enemyId: string;
  customEnemy: boolean;
  enemyLevel: number;
  enemyRes: number;
  attackType: TalentKey;
  skillMult: number;
  statOverride: number | null;
  baseDmgBonus: number;
  flatBaseDmg: number;
  dmgBonus: number;
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
  artifacts: ArtifactBuild;
}

function defaultsFor(c: (typeof CHARACTERS)[number]): Draft {
  return {
    charId: c.id,
    level: 90,
    weaponId: c.bestWeapon,
    enemyId: ENEMIES[0].id,
    customEnemy: false,
    enemyLevel: ENEMIES[0].level,
    enemyRes: ENEMIES[0].resistances.default,
    attackType: signatureTalent(c.id)?.key ?? 'burst',
    skillMult: signatureTalent(c.id)?.multiplier ?? c.skillMultiplier,
    statOverride: null,
    baseDmgBonus: 0,
    flatBaseDmg: 0,
    dmgBonus: 0,
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
    artifacts: { ...NO_ARTIFACTS },
  };
}

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

/** Clamp every numeric field to its allowed range (used when restoring a URL). */
function sanitize(d: Draft): Draft {
  return {
    ...d,
    level: Math.round(clamp(d.level, 1, 90)),
    enemyLevel: Math.round(clamp(d.enemyLevel, 1, 100)),
    enemyRes: clamp(d.enemyRes, -1, 1),
    skillMult: clamp(d.skillMult, 0, 100),
    statOverride: d.statOverride == null ? null : clamp(d.statOverride, 0, 1_000_000),
    baseDmgBonus: clamp(d.baseDmgBonus, -1, 10),
    flatBaseDmg: clamp(d.flatBaseDmg, 0, 1_000_000),
    dmgBonus: clamp(d.dmgBonus, 0, 20),
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
    artifacts: {
      ...d.artifacts,
      subCritRate: clamp(d.artifacts.subCritRate, 0, 1),
      subCritDMG: clamp(d.artifacts.subCritDMG, 0, 10),
      subATKPercent: clamp(d.artifacts.subATKPercent, 0, 10),
      subHPPercent: clamp(d.artifacts.subHPPercent, 0, 10),
      subDEFPercent: clamp(d.artifacts.subDEFPercent ?? 0, 0, 10),
      subEM: clamp(d.artifacts.subEM, 0, 3000),
    },
  };
}

/** Percent input: shows 12.3 for 0.123 and writes back the fraction. */
function Pct({
  value,
  onChange,
  label,
  step = 1,
  min = 0,
  max = 2000,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
  step?: number;
  min?: number;
  max?: number;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-[var(--muted)]">{label}</span>
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
          className="w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface)] px-2 py-1.5 text-right text-[var(--text)]"
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
  step = 1,
  min = 0,
  max = 1_000_000,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
  step?: number;
  min?: number;
  max?: number;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-[var(--muted)]">{label}</span>
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
        className="mt-1 w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface)] px-2 py-1.5 text-right text-[var(--text)]"
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

type SubKey = 'subCritRate' | 'subCritDMG' | 'subATKPercent' | 'subHPPercent' | 'subDEFPercent' | 'subEM';
const SUB_FIELDS: { key: SubKey; label: string; percent: boolean; max: number }[] = [
  { key: 'subCritRate', label: 'CRIT Rate', percent: true, max: 100 },
  { key: 'subCritDMG', label: 'CRIT DMG', percent: true, max: 1000 },
  { key: 'subATKPercent', label: 'ATK', percent: true, max: 1000 },
  { key: 'subHPPercent', label: 'HP', percent: true, max: 1000 },
  { key: 'subDEFPercent', label: 'DEF', percent: true, max: 1000 },
  { key: 'subEM', label: 'Elemental Mastery', percent: false, max: 3000 },
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
      className="panel scroll-mt-24 p-5"
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
  const [copied, setCopied] = useState(false);

  const character = CHARACTERS.find((c) => c.id === draft.charId) ?? initial;
  const weaponOptions = weaponsForType(character.weaponType);
  const weapon = weaponOptions.find((w) => w.id === draft.weaponId) ?? weaponOptions[0];
  const baseEnemy = ENEMIES.find((e) => e.id === draft.enemyId) ?? ENEMIES[0];
  const enemy = useMemo(
    () =>
      draft.customEnemy
        ? { ...baseEnemy, level: draft.enemyLevel, resistances: { ...baseEnemy.resistances, default: draft.enemyRes } }
        : baseEnemy,
    [draft.customEnemy, draft.enemyLevel, draft.enemyRes, baseEnemy],
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

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const setArtifact = (patch: Partial<ArtifactBuild>) =>
    setDraft((d) => ({ ...d, artifacts: { ...d.artifacts, ...patch } }));

  const pickCharacter = (id: string) => {
    const c = CHARACTERS.find((x) => x.id === id);
    if (!c) return;
    setDraft(defaultsFor(c));
  };

  // Fold the six zones into the engine's BuffState. Standalone totals
  // (crit / EM / the scaling stat) are turned into deltas against the
  // whiteboard so a manual override means "set the total to this".
  const buffs: BuffState = useMemo(() => {
    const patches: Partial<BuffState>[] = [
      { dmgBonus: draft.dmgBonus, dmgReduction: draft.dmgReduction },
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
  }, [draft, scaling, whiteboard.baseStat]);

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
        amplified: draft.amplified,
        additive: draft.additive,
        transformative: draft.transformative,
        swirlElement: draft.transformative === 'swirl' ? draft.swirlElement : undefined,
      }),
    [character, weapon, draft.artifacts, buffs, enemy, draft.level, draft.attackType, draft.skillMult, draft.amplified, draft.additive, draft.transformative, draft.swirlElement],
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
    if (draft.enemyId !== d.enemyId) put('e', draft.enemyId);
    if (draft.customEnemy) {
      put('el', draft.enemyLevel);
      put('er', draft.enemyRes);
    }
    if (draft.attackType !== d.attackType) put('at', draft.attackType);
    if (draft.skillMult !== d.skillMult) put('sm', draft.skillMult);
    if (draft.statOverride != null) put('st', draft.statOverride);
    if (draft.baseDmgBonus) put('bd', draft.baseDmgBonus);
    if (draft.flatBaseDmg) put('fb', draft.flatBaseDmg);
    if (draft.dmgBonus) put('db', draft.dmgBonus);
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
    if (draft.artifacts.subCritRate) put('scr', draft.artifacts.subCritRate);
    if (draft.artifacts.subCritDMG) put('scd', draft.artifacts.subCritDMG);
    if (draft.artifacts.subATKPercent) put('satk', draft.artifacts.subATKPercent);
    if (draft.artifacts.subHPPercent) put('shp', draft.artifacts.subHPPercent);
    if (draft.artifacts.subDEFPercent) put('sdef', draft.artifacts.subDEFPercent);
    if (draft.artifacts.subEM) put('sem', draft.artifacts.subEM);
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
    setDraft(sanitize({
      ...base,
      charId: (c ?? initial).id,
      level: num('lv', base.level),
      weaponId: p.get('w') ?? base.weaponId,
      enemyId: p.get('e') ?? base.enemyId,
      customEnemy: p.has('el') || p.has('er'),
      enemyLevel: num('el', base.enemyLevel),
      enemyRes: num('er', base.enemyRes),
      attackType: (p.get('at') as TalentKey) ?? base.attackType,
      skillMult: num('sm', base.skillMult),
      statOverride: p.has('st') ? num('st', 0) : null,
      baseDmgBonus: num('bd', 0),
      flatBaseDmg: num('fb', 0),
      dmgBonus: num('db', 0),
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
      artifacts: {
        sandsMain: p.has('sand') ? { type: p.get('sand') as SecondaryStatType, value: mainValueFor(p.get('sand') as SecondaryStatType) } : { ...NO_ARTIFACTS.sandsMain },
        gobletMain: p.has('gob') ? { type: p.get('gob') as SecondaryStatType, value: mainValueFor(p.get('gob') as SecondaryStatType) } : { ...NO_ARTIFACTS.gobletMain },
        circletMain: p.has('circ') ? { type: p.get('circ') as SecondaryStatType, value: mainValueFor(p.get('circ') as SecondaryStatType) } : { ...NO_ARTIFACTS.circletMain },
        subCritRate: num('scr', 0),
        subCritDMG: num('scd', 0),
        subATKPercent: num('satk', 0),
        subHPPercent: num('shp', 0),
        subDEFPercent: num('sdef', 0),
        subEM: num('sem', 0),
        subER: 0,
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

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
      active ? 'border-forest-600 bg-forest-600/10 text-forest-700' : 'border-[var(--line)] text-[var(--muted)] hover:text-[var(--text)]'
    }`;

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
    <div className="mx-auto max-w-5xl">
      {/* ============ Scenario bar ============ */}
      <div className="panel flex flex-wrap items-center gap-2.5 p-3">
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="flex items-center gap-2.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2 py-1.5 text-left transition-colors hover:border-forest-500"
        >
          <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg ring-1 ring-[var(--line)]">
            <span className={`absolute inset-0 bg-linear-to-b ${ELEMENT_BG[character.element] ?? ELEMENT_BG.physical}`} aria-hidden="true" />
            <img src={`/images/portraits/${character.id}.webp`} alt="" width="256" height="256" className="relative h-full w-full object-cover" />
            <ElementIcon el={character.element} className="absolute right-0.5 top-0.5 h-3.5 w-3.5" />
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-1.5 truncate text-sm font-semibold text-[var(--text)]">
              <ElementIcon el={character.element} className="h-4 w-4" />
              {character.name}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-[var(--muted)]" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
            </span>
            <span className="block text-[11px] text-[var(--muted)]">{ELEMENT_LABEL[character.element]} · {character.weaponType}</span>
          </span>
        </button>

        <label className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
          Level
          <input
            type="number"
            min={1}
            max={90}
            value={draft.level}
            onChange={(e) => set('level', Math.min(90, Math.max(1, parseInt(e.target.value, 10) || 90)))}
            className="h-8 w-16 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 text-right text-sm text-[var(--text)]"
          />
        </label>

        <label className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
          Weapon
          <IconSelect
            className="relative w-56"
            value={weapon?.id ?? ''}
            onChange={(v) => set('weaponId', v)}
            options={weaponOptions.map((w) => ({
              value: w.id,
              label: `${w.name} · ${w.rarity}★`,
              icon: <img src={`/images/weapons/${w.id}.webp`} alt="" width="48" height="48" className="h-6 w-6 object-contain" loading="lazy" decoding="async" />,
            }))}
          />
        </label>

        <label className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
          Enemy
          <IconSelect
            className="relative w-52"
            value={draft.customEnemy ? 'custom' : draft.enemyId}
            onChange={(v) => {
              if (v === 'custom') {
                setDraft((d) => ({ ...d, customEnemy: true, enemyLevel: enemy.level, enemyRes: enemy.resistances.default }));
              } else {
                setDraft((d) => ({ ...d, customEnemy: false, enemyId: v }));
              }
            }}
            options={[
              ...ENEMIES.map((en) => ({ value: en.id, label: `${en.name} · Lv${en.level}`, icon: <Glyph name="enemy" className="h-5 w-5 text-[var(--muted)]" /> })),
              { value: 'custom', label: 'Custom…' },
            ]}
          />
        </label>
        {draft.customEnemy && (
          <>
            <label className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
              Lv
              <input type="number" min={1} max={100} value={draft.enemyLevel} onChange={(e) => set('enemyLevel', clamp(parseInt(e.target.value, 10) || 90, 1, 100))} className="h-8 w-16 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 text-right text-sm text-[var(--text)]" />
            </label>
            <label className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
              RES %
              <input type="number" min={-100} max={100} value={Math.round(draft.enemyRes * 100)} onChange={(e) => set('enemyRes', clamp(parseFloat(e.target.value) || 0, -100, 100) / 100)} className="h-8 w-16 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 text-right text-sm text-[var(--text)]" />
            </label>
          </>
        )}
      </div>

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

      <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
        <div className="space-y-4">
          {/* 1 — Base */}
          <Zone id="base" index={1} title="Base damage" value={formatNumber(baseDamage)} changed={draft.statOverride != null} onReset={() => set('statOverride', null)} onEnter={setHighlight}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-medium text-[var(--muted)]">{SCALING_LABEL[scaling]} (whiteboard, editable)</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={Math.round(whiteboard.baseStat)}
                  max={1_000_000}
                  value={Math.round(draft.statOverride ?? whiteboard.baseStat)}
                  onChange={(e) => set('statOverride', clamp(parseFloat(e.target.value) || 0, Math.round(whiteboard.baseStat), 1_000_000))}
                  className="mt-1 w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface)] px-2 py-1.5 text-right text-[var(--text)]"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-[var(--muted)]">Skill type</span>
                <IconSelect
                  value={draft.attackType}
                  onChange={(t) => {
                    const tal = TALENTS[character.id];
                    setDraft((d) => ({ ...d, attackType: t, skillMult: tal && tal[t] > 0 ? tal[t] : d.skillMult }));
                  }}
                  options={ATTACKS.map((a) => ({ ...a, icon: <Glyph name={a.value} className="h-5 w-5" /> }))}
                />
              </label>
              <Pct label="Skill multiplier" value={draft.skillMult / 100} onChange={(v) => set('skillMult', v * 100)} step={1} min={0} max={100} />
              <div className="grid grid-cols-2 gap-3">
                <Pct label="Base DMG bonus" value={draft.baseDmgBonus} onChange={(v) => set('baseDmgBonus', v)} min={-100} max={1000} />
                <Num label="Flat base DMG" value={draft.flatBaseDmg} onChange={(v) => set('flatBaseDmg', v)} step={10} min={0} max={1_000_000} />
              </div>
            </div>
            <p className="mt-2 text-xs text-[var(--muted)]">{SCALING_LABEL[scaling]} {formatNumber(result.baseStat)} × {formatPercent(result.skillMultiplier)} = {formatNumber(baseDamage)}</p>
          </Zone>

          {/* 2 — Bonus */}
          <Zone id="bonus" index={2} title="DMG bonus" value={`×${dmgMult.toFixed(3)}`} changed={!!(draft.dmgBonus || draft.dmgReduction)} onReset={() => setDraft((d) => ({ ...d, dmgBonus: 0, dmgReduction: 0 }))} onEnter={setHighlight}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Pct label="Elemental / Physical DMG" value={draft.dmgBonus} onChange={(v) => set('dmgBonus', v)} min={0} max={2000} />
              <Pct label="Target DMG reduction" value={draft.dmgReduction} onChange={(v) => set('dmgReduction', v)} min={0} max={100} />
            </div>
            <p className="mt-2 text-xs text-[var(--muted)]">1 + {formatPercent(result.dmgBonus)} − {formatPercent(draft.dmgReduction)} = {dmgMult.toFixed(3)}</p>
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
            <p className="mt-2 text-xs text-[var(--muted)]">
              Character base (weapon + ascension): {formatPercent(ownCritRate)} CRIT Rate, {formatPercent(ownCritDMG)} CRIT DMG — this is the floor. Total now: {formatPercent(result.critRate)} / {formatPercent(result.critDMG)}.
            </p>
            {result.critRateRaw > 1 && (
              <p className="mt-2 text-xs text-pyro">CRIT Rate is overcapped — {((result.critRateRaw - 1) * 100).toFixed(1)}% of it is wasted past the 100% cap.</p>
            )}
          </Zone>

          {/* 4 — Reaction */}
          <Zone id="reaction" index={4} title="Reaction" value={result.reactionMultiplier > 1 ? `×${result.reactionMultiplier.toFixed(3)}` : '—'} changed={!!(draft.amplified !== 'none' || draft.additive !== 'none' || draft.transformative !== 'none' || draft.em || draft.reactionBonus)} onReset={() => setDraft((d) => ({ ...d, amplified: 'none', additive: 'none', transformative: 'none', em: 0, reactionBonus: 0, ampReactionBonus: 0, transformReactionBonus: 0 }))} onEnter={setHighlight}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-medium text-[var(--muted)]">Amplifying (multiplies the hit)</span>
                <IconSelect value={draft.amplified} onChange={(v) => set('amplified', v)} options={AMPLIFIED.map((o) => ({ ...o, icon: REACTION_ELEMENT[o.value] ? <ElementPair els={REACTION_ELEMENT[o.value]} /> : undefined }))} />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-[var(--muted)]">Additive (added to base DMG)</span>
                <IconSelect value={draft.additive} onChange={(v) => set('additive', v)} options={ADDITIVE.map((o) => ({ ...o, icon: REACTION_ELEMENT[o.value] ? <ElementPair els={REACTION_ELEMENT[o.value]} /> : undefined }))} />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-[var(--muted)]">Transformative (separate hit, no CRIT)</span>
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
            <p className="mt-2 text-xs text-[var(--muted)]">{result.reactionName}{result.additive > 0 ? ` · ${result.additiveName} adds ${formatNumber(result.additive)} to base` : ''}</p>
          </Zone>

          {/* 5 — DEF */}
          <Zone id="def" index={5} title="Enemy DEF" value={`×${result.defMultiplier.toFixed(3)}`} changed={!!(draft.defShred || draft.defIgnore)} onReset={() => setDraft((d) => ({ ...d, defShred: 0, defIgnore: 0 }))} onEnter={setHighlight}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Pct label="DEF reduction" value={draft.defShred} onChange={(v) => set('defShred', v)} min={0} max={100} />
              <Pct label="DEF ignore" value={draft.defIgnore} onChange={(v) => set('defIgnore', v)} min={0} max={100} />
            </div>
            <p className="mt-2 text-xs text-[var(--muted)]">({draft.level}+100) / (({draft.level}+100) + ({enemy.level}+100)(1−{formatPercent(draft.defShred)})(1−{formatPercent(draft.defIgnore)})) = {result.defMultiplier.toFixed(3)}</p>
          </Zone>

          {/* 6 — RES */}
          <Zone id="res" index={6} title="Enemy RES" value={`×${result.resMultiplier.toFixed(3)}`} changed={!!draft.resShred} onReset={() => set('resShred', 0)} onEnter={setHighlight}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Pct label={`${ELEMENT_LABEL[character.element]} RES (base)`} value={enemy.resistances[character.element] ?? enemy.resistances.default} onChange={(v) => setDraft((d) => ({ ...d, customEnemy: true, enemyRes: v }))} min={-100} max={100} />
              <Pct label="RES reduction" value={draft.resShred} onChange={(v) => set('resShred', v)} min={0} max={200} />
            </div>
            <p className="mt-2 text-xs text-[var(--muted)]">Effective RES {(formatPercent((enemy.resistances[character.element] ?? enemy.resistances.default) - draft.resShred))} → ×{result.resMultiplier.toFixed(3)} {result.resMultiplier > 1 ? '(negative RES, amplified)' : (result.resMultiplier === 1 ? '(standard band)' : '(reduced)')}</p>
          </Zone>

          {/* Artifacts — added on top of the character's own stats */}
          <section className="panel p-5">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-base font-semibold text-[var(--text)]">
                Artifacts{' '}
                <span className="text-xs font-normal text-[var(--muted)]">optional — added on top of the stats above</span>
              </h3>
              <button type="button" onClick={() => set('artifacts', { ...NO_ARTIFACTS })} className="text-[11px] text-[var(--muted)] underline underline-offset-2 hover:text-forest-600">
                clear
              </button>
            </div>
            <p className="mt-1 text-xs text-[var(--muted)]">
              The character already has its own stats — e.g. base {formatPercent(ownCritRate)} CRIT Rate / {formatPercent(ownCritDMG)} CRIT DMG plus weapon and ascension. These fields add more on top.
            </p>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {MAIN_OPTIONS.map((m) => {
                const cur = draft.artifacts[m.slot];
                return (
                  <label key={m.slot} className="block">
                    <span className="text-xs font-medium text-[var(--muted)]">{m.label}</span>
                    <IconSelect
                      value={cur.value > 0 ? cur.type : 'none'}
                      onChange={(v) => {
                        if (v === 'none') setArtifact({ [m.slot]: { ...NO_ARTIFACTS[m.slot] } } as Partial<ArtifactBuild>);
                        else setArtifact({ [m.slot]: { type: v as SecondaryStatType, value: mainValueFor(v as SecondaryStatType) } } as Partial<ArtifactBuild>);
                      }}
                      options={[
                        { value: 'none', label: 'None' },
                        ...m.options.map((o) => ({ value: o as string, label: SECONDARY_LABEL[o], icon: <Glyph name={STAT_GLYPH[o]} className="h-5 w-5" /> })),
                      ]}
                    />
                  </label>
                );
              })}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {SUB_FIELDS.map((s) =>
                s.percent ? (
                  <Pct key={s.key} label={s.label} value={(draft.artifacts[s.key] ?? 0) as number} onChange={(v) => setArtifact({ [s.key]: v } as Partial<ArtifactBuild>)} min={0} max={s.max} />
                ) : (
                  <Num key={s.key} label={s.label} value={(draft.artifacts[s.key] ?? 0) as number} onChange={(v) => setArtifact({ [s.key]: v } as Partial<ArtifactBuild>)} step={10} min={0} max={s.max} />
                ),
              )}
            </div>
            <p className="mt-3 border-t border-[var(--line)] pt-3 text-xs text-[var(--muted)]">
              With artifacts: ATK <strong className="text-[var(--text)]">{formatNumber(result.totalATK)}</strong> · CRIT <strong className="text-[var(--text)]">{formatPercent(result.critRate)}</strong> / <strong className="text-[var(--text)]">{formatPercent(result.critDMG)}</strong> · EM <strong className="text-[var(--text)]">{Math.round(result.em)}</strong>
            </p>
          </section>
        </div>

        {/* ============ Result panel ============ */}
        <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <div className="panel p-5 text-center">
            <p className="text-sm font-medium uppercase tracking-wide text-[var(--muted)]">Expected damage</p>
            <p className="damage-number tnum mt-2 text-5xl">{formatNumber(expected)}</p>
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[var(--line)] pt-4">
              <div>
                <p className="text-xs text-[var(--muted)]">Non-crit</p>
                <p className="tnum text-lg font-semibold text-[var(--text)]">{formatNumber(result.nonCrit)}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--muted)]">Crit</p>
                <p className="tnum text-lg font-semibold text-forest-600">{formatNumber(result.critHit)}</p>
              </div>
            </div>
            {capped && <p className="mt-2 text-xs text-pyro">Capped at 20,000,000 (single-hit limit).</p>}
            <button type="button" onClick={copyLink} className="mt-3 rounded-full border border-[var(--line)] px-4 py-1.5 text-xs font-medium text-[var(--muted)] transition-colors hover:text-forest-600">
              {copied ? 'Link copied ✓' : 'Copy link'}
            </button>
          </div>

          <div className="panel p-5">
            <h3 className="text-sm font-semibold text-[var(--text)]">Formula</h3>
            <div className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
              {chain.map((c, i) => (
                <span key={c.id} className="inline-flex items-center gap-1.5">
                  {i > 0 && <span className="text-[var(--muted)]">×</span>}
                  <button
                    type="button"
                    onClick={() => {
                      setHighlight(c.id);
                      zoneRefs.get(c.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

            <h3 className="mt-5 text-sm font-semibold text-[var(--text)]">Each zone’s contribution</h3>
            <div className="mt-3 space-y-2.5">
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
              <div className="mt-5 border-t border-[var(--line)] pt-4">
                <p className="text-xs font-medium text-[var(--muted)]">Transformative reaction</p>
                <p className="tnum mt-1 text-lg font-semibold text-forest-600">+{formatNumber(result.transformative)} <span className="text-sm font-normal text-[var(--muted)]">{result.transformativeName}</span></p>
                <p className="mt-1 text-[11px] text-[var(--muted)]">A separate hit — not affected by ATK, DMG bonus, CRIT or enemy DEF.</p>
              </div>
            )}
          </div>

          <p className="text-[11px] leading-relaxed text-[var(--muted)]">
            Reference panel · character + weapon · optional artifacts you enter yourself. Numbers are the calculator’s own model, not scraped game data.
          </p>
        </div>
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {character.name} expected damage {formatNumber(expected)}.
      </p>
    </div>
  );
}
