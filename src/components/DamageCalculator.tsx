import { useEffect, useMemo, useRef, useState } from 'react';
import { CHARACTERS } from '../data/characters';
import { TALENTS, signatureTalent } from '../data/talents';
import { weaponsForType } from '../data/weapons';
import { ENEMIES } from '../data/enemies';
import { DEFAULT_BUFFS, BUFF_PRESETS, MAIN_STATS, resolvePreset } from '../data/presets';
import { computeDamage, formatNumber, formatPercent } from '../lib/damage';
import type {
  AdditiveReaction,
  AmplifiedReaction,
  ArtifactBuild,
  BuffState,
  ElementType,
  ReactionKey,
  SecondaryStatType,
  TransformativeReaction,
} from '../lib/damage';
import { ELEMENT_LABEL } from '../data/elements';
import { ARTIFACT_SETS, resolveSetBuffs } from '../data/artifactSets';
import { baseStatsAt } from '../data/levelStats';
import { adviseManual } from '../lib/advisor';

const ELEMENTS: ElementType[] = ['pyro', 'hydro', 'electro', 'cryo', 'anemo', 'geo', 'dendro'];
const WEAPON_TYPES = ['sword', 'claymore', 'polearm', 'bow', 'catalyst'] as const;
const SWIRLABLE: ElementType[] = ['pyro', 'hydro', 'electro', 'cryo'];

const ELEMENT_STYLES: Record<ElementType, { text: string; label: string }> = {
  pyro: { text: 'text-pyro', label: 'Pyro' },
  hydro: { text: 'text-hydro', label: 'Hydro' },
  electro: { text: 'text-electro', label: 'Electro' },
  cryo: { text: 'text-cryo', label: 'Cryo' },
  anemo: { text: 'text-anemo', label: 'Anemo' },
  geo: { text: 'text-geo', label: 'Geo' },
  dendro: { text: 'text-dendro', label: 'Dendro' },
  physical: { text: 'text-gray-300', label: 'Physical' },
};

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

const ATTACK_LABEL: Record<string, string> = {
  normal: 'Normal Attack',
  charged: 'Charged Attack',
  skill: 'Elemental Skill',
  burst: 'Elemental Burst',
};

const AMPLIFIED_OPTIONS: { value: AmplifiedReaction; label: string }[] = [
  { value: 'none', label: 'No reaction' },
  { value: 'vaporize', label: 'Vaporize (×1.5 / ×2.0)' },
  { value: 'melt', label: 'Melt (×2.0 / ×1.5)' },
];

const TRANSFORMATIVE_OPTIONS: { value: TransformativeReaction; label: string }[] = [
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

const ADDITIVE_OPTIONS: { value: AdditiveReaction; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'aggravate', label: 'Aggravate (Electro)' },
  { value: 'spread', label: 'Spread (Dendro)' },
];

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

const SANDS_OPTIONS: SecondaryStatType[] = ['atk%', 'hp%', 'def%', 'em', 'er'];
const GOBLET_OPTIONS: SecondaryStatType[] = ['dmg%', 'physical'];
const CIRCLET_OPTIONS: SecondaryStatType[] = ['critRate', 'critDMG', 'atk%', 'hp%', 'def%', 'em'];

type SubKey = 'subCritRate' | 'subCritDMG' | 'subATKPercent' | 'subHPPercent' | 'subDEFPercent' | 'subEM';
const SUB_FIELDS: { key: SubKey; label: string; percent: boolean }[] = [
  { key: 'subCritRate', label: 'CRIT Rate %', percent: true },
  { key: 'subCritDMG', label: 'CRIT DMG %', percent: true },
  { key: 'subATKPercent', label: 'ATK %', percent: true },
  { key: 'subHPPercent', label: 'HP %', percent: true },
  { key: 'subDEFPercent', label: 'DEF %', percent: true },
  { key: 'subEM', label: 'Elemental Mastery', percent: false },
];

const EMPTY_ARTIFACTS: ArtifactBuild = {
  sandsMain: { type: 'atk%', value: 0 },
  gobletMain: { type: 'dmg%', value: 0 },
  circletMain: { type: 'critRate', value: 0 },
  subCritRate: 0,
  subCritDMG: 0,
  subATKPercent: 0,
  subEM: 0,
  subER: 0,
  subHPPercent: 0,
  subDEFPercent: 0,
};

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

function mergeBuffs(ids: string[], extras: Partial<BuffState>[]): BuffState {
  const merged: BuffState = { ...DEFAULT_BUFFS, reactionBonuses: {} };
  const sources: Partial<BuffState>[] = [
    ...ids.map((id) => BUFF_PRESETS.find((b) => b.id === id)?.buffs ?? {}),
    ...extras,
  ];
  for (const source of sources) {
    const { reactionBonuses, ...rest } = source;
    Object.assign(merged, rest);
    if (reactionBonuses) {
      for (const key of Object.keys(reactionBonuses) as ReactionKey[]) {
        merged.reactionBonuses[key] = (merged.reactionBonuses[key] ?? 0) + (reactionBonuses[key] ?? 0);
      }
    }
  }
  return merged;
}

function defaultAmplified(element: ElementType): AmplifiedReaction {
  if (element === 'pyro') return 'vaporize';
  if (element === 'cryo') return 'melt';
  return 'none';
}

function ElementIcon({ el, className = 'h-4 w-4' }: { el: string; className?: string }) {
  if (el === 'physical') {
    return <span className={`element-dot bg-gray-400 ${className}`} aria-hidden="true" />;
  }
  return (
    <img
      src={`/images/element-${el}.webp`}
      alt=""
      width="120"
      height="120"
      className={`rounded-full bg-white object-contain p-px shadow-sm ring-1 ring-black/5 ${className}`}
      loading="lazy"
      decoding="async"
      aria-hidden="true"
    />
  );
}

function AdditiveSelect({
  value,
  onChange,
  label,
}: {
  value: AdditiveReaction;
  onChange: (v: AdditiveReaction) => void;
  label: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-[var(--muted)]">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as AdditiveReaction)}
        className="mt-1 w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface)] px-2 py-2 text-sm text-[var(--text)]"
      >
        {ADDITIVE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function DamageCalculator({
  initialCharacterId,
  hideCharacterSelect = false,
}: { initialCharacterId?: string; hideCharacterSelect?: boolean } = {}) {
  const initial = CHARACTERS.find((c) => c.id === initialCharacterId) ?? CHARACTERS[0];
  const [charId, setCharId] = useState(initial.id);
  const [weaponId, setWeaponId] = useState(initial.bestWeapon);
  const [setId, setSetId] = useState('');
  const [enemyId, setEnemyId] = useState(ENEMIES[0].id);
  const [amplified, setAmplified] = useState<AmplifiedReaction>(defaultAmplified(initial.element));
  const [transformative, setTransformative] = useState<TransformativeReaction>('none');
  const [additive, setAdditive] = useState<AdditiveReaction>('none');
  const [swirlElement, setSwirlElement] = useState<ElementType>('pyro');
  const [physical, setPhysical] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerDialog = useRef<HTMLDialogElement | null>(null);
  const [buffIds, setBuffIds] = useState<string[]>([]);
  const [skillMult, setSkillMult] = useState(signatureTalent(initial.id)?.multiplier ?? initial.skillMultiplier);
  const [attackType, setAttackType] = useState<'custom' | 'normal' | 'charged' | 'skill' | 'burst'>('custom');
  const [charLevel, setCharLevel] = useState(90);
  const [artifacts, setArtifacts] = useState<ArtifactBuild>(() => resolvePreset(initial));
  const [query, setQuery] = useState('');
  const [elementFilter, setElementFilter] = useState<'all' | ElementType>('all');
  const [weaponFilter, setWeaponFilter] = useState<'all' | string>('all');
  const [rarityFilter, setRarityFilter] = useState<'all' | '4' | '5'>('all');
  const [popKey, setPopKey] = useState(0);
  const prevExpected = useRef<number | null>(null);

  const character = CHARACTERS.find((c) => c.id === charId) ?? initial;
  const sig = signatureTalent(character.id);
  const currentSkillLabel =
    attackType === 'custom'
      ? sig
        ? `${sig.label}${sig.detail ? ` · ${sig.detail}` : ''}`
        : character.skillName
      : ATTACK_LABEL[attackType];
  const effectiveAttackKey = attackType === 'custom' ? (sig?.key ?? 'burst') : attackType;
  const weaponOptions = weaponsForType(character.weaponType);
  const weapon = weaponOptions.find((w) => w.id === weaponId) ?? weaponOptions[0];
  const enemy = ENEMIES.find((e) => e.id === enemyId) ?? ENEMIES[0];

  const onSelectCharacter = (id: string) => {
    const c = CHARACTERS.find((x) => x.id === id);
    if (!c) return;
    setCharId(id);
    setWeaponId(c.bestWeapon);
    setSetId('');
    setSkillMult(signatureTalent(c.id)?.multiplier ?? c.skillMultiplier);
    setAmplified(defaultAmplified(c.element));
    setAttackType('custom');
    setArtifacts(resolvePreset(c));
    setPhysical(false);
  };

  const toggleBuff = (id: string) =>
    setBuffIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const onSelectAttackType = (t: 'custom' | 'normal' | 'charged' | 'skill' | 'burst') => {
    setAttackType(t);
    if (t === 'custom') return;
    const tal = TALENTS[character.id];
    if (tal && tal[t] > 0) setSkillMult(tal[t]);
  };

  const setBuff = useMemo(
    () => (setId ? resolveSetBuffs([{ id: setId, pieces: 4 }], character.element, effectiveAttackKey) : {}),
    [setId, character.element, effectiveAttackKey],
  );

  const result = useMemo(() => {
    const buffs = mergeBuffs(buffIds, [setBuff]);
    return computeDamage({
      character,
      weapon,
      artifacts,
      buffs,
      enemy,
      characterLevel: charLevel,
      attackType: effectiveAttackKey,
      skillMultiplier: skillMult,
      amplified,
      transformative,
      additive,
      physical,
      swirlElement: transformative === 'swirl' ? swirlElement : undefined,
    });
  }, [buffIds, setBuff, skillMult, enemy, amplified, transformative, additive, physical, swirlElement, character, weapon, artifacts, charLevel, effectiveAttackKey, currentSkillLabel]);

  const { totalATK, critRate, critDMG, em, dmgBonus } = result;
  const buffNames = BUFF_PRESETS.filter((b) => buffIds.includes(b.id)).map((b) => b.label);

  const advice = useMemo(() => {
    const buffs = mergeBuffs(buffIds, [setBuff]);
    return adviseManual({
      character,
      weapon,
      artifacts,
      buffs,
      enemy,
      characterLevel: charLevel,
      attackType: effectiveAttackKey,
      skillMultiplier: skillMult,
      amplified,
      transformative,
      additive,
      physical,
      swirlElement: transformative === 'swirl' ? swirlElement : undefined,
    });
  }, [buffIds, setBuff, skillMult, enemy, amplified, transformative, additive, physical, swirlElement, character, weapon, artifacts, charLevel, effectiveAttackKey, currentSkillLabel]);

  const multipliers = useMemo(() => {
    const crit = 1 + critRate * critDMG;
    const dmg = 1 + dmgBonus;
    return [
      { name: 'ATK', value: totalATK, baseline: 2200, display: formatNumber(totalATK) },
      { name: 'Skill', value: skillMult, baseline: 4, display: `×${skillMult.toFixed(2)}` },
      { name: 'DMG Bonus', value: dmg, baseline: 1.466, display: `×${dmg.toFixed(3)}` },
      { name: 'Crit', value: crit, baseline: 1.7, display: `×${crit.toFixed(2)}` },
      { name: 'Reaction', value: result.reactionMultiplier, baseline: 1.3, display: `×${result.reactionMultiplier.toFixed(2)}` },
      { name: 'DEF', value: result.defMultiplier, baseline: 0.5, display: `×${result.defMultiplier.toFixed(3)}` },
      { name: 'RES', value: result.resMultiplier, baseline: 0.9, display: `×${result.resMultiplier.toFixed(3)}` },
    ];
  }, [totalATK, skillMult, dmgBonus, critRate, critDMG, result]);

  useEffect(() => {
    if (prevExpected.current === result.expected) return;
    prevExpected.current = result.expected;
    setPopKey((k) => k + 1);
  }, [result.expected]);

  useEffect(() => {
    const d = pickerDialog.current;
    if (!d) return;
    if (pickerOpen && !d.open) d.showModal();
    if (!pickerOpen && d.open) d.close();
  }, [pickerOpen]);

  const baseCurve = baseStatsAt(character.id, charLevel);
  const baseHP = baseCurve?.hp ?? character.baseHP;
  const baseATK = (baseCurve?.atk ?? character.baseATK) + (weapon?.baseATK ?? 0);
  const baseDEF = baseCurve?.def ?? character.baseDEF;
  const critRateRaw = result.critRateRaw;
  const statRows: { label: string; base: number; total: number; pct?: boolean }[] = [
    { label: 'Max HP', base: baseHP, total: result.totalHP },
    { label: 'ATK', base: baseATK, total: totalATK },
    { label: 'DEF', base: baseDEF, total: result.totalDEF },
    { label: 'Elemental Mastery', base: 0, total: em },
    { label: 'CRIT Rate', base: 0.05, total: critRate, pct: true },
    { label: 'CRIT DMG', base: 0.5, total: critDMG, pct: true },
    { label: 'DMG Bonus', base: 0, total: dmgBonus, pct: true },
  ];

  const setArtifact = (patch: Partial<ArtifactBuild>) => setArtifacts((a) => ({ ...a, ...patch }));
  const setMain = (slot: 'sandsMain' | 'gobletMain' | 'circletMain', type: SecondaryStatType) => {
    setArtifact({ [slot]: { type, value: mainValueFor(type) } } as Partial<ArtifactBuild>);
  };

  const roster = CHARACTERS.filter(
    (c) =>
      (elementFilter === 'all' || c.element === elementFilter) &&
      (weaponFilter === 'all' || c.weaponType === weaponFilter) &&
      (rarityFilter === 'all' || String(c.rarity) === rarityFilter) &&
      (query.trim() === '' || c.name.toLowerCase().includes(query.trim().toLowerCase())),
  );
  const groups = ELEMENTS.map((el) => ({ element: el, rows: roster.filter((c) => c.element === el) })).filter(
    (g) => g.rows.length > 0,
  );

  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
      active
        ? 'border-forest-600 bg-forest-600/10 text-forest-700'
        : 'border-[var(--line)] text-[var(--muted)] hover:text-[var(--text)]'
    }`;

  return (
    <div className="relative mx-auto max-w-6xl">
      {/* ============ Sticky, centred result bar ============ */}
      <div className="sticky top-2 z-40">
        <div className="panel rounded-2xl border-forest-500/30 bg-[var(--surface)]/95 px-4 py-3 shadow-[0_18px_50px_-24px_rgb(69_106_75/0.55)] backdrop-blur sm:px-5">
          <div className="flex items-center gap-3 sm:gap-5">
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              disabled={hideCharacterSelect}
              aria-haspopup={hideCharacterSelect ? undefined : 'dialog'}
              title={hideCharacterSelect ? undefined : 'Change character'}
              className="group flex min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2 py-1.5 text-left transition-colors hover:border-forest-500 disabled:cursor-default disabled:border-transparent disabled:bg-transparent sm:gap-3"
            >
              <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg ring-1 ring-[var(--line)]">
                <span className={`absolute inset-0 bg-linear-to-b ${ELEMENT_BG[character.element] ?? ELEMENT_BG.physical}`} aria-hidden="true" />
                <img src={`/images/portraits/${character.id}.webp`} alt="" width="256" height="256" className="absolute inset-0 h-full w-full object-cover" />
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 truncate text-sm font-semibold text-[var(--text)]">
                  <ElementIcon el={character.element} className="h-4 w-4" />
                  {character.name}
                  {!hideCharacterSelect && (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="shrink-0 text-[var(--muted)]" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
                  )}
                </span>
                <span className="truncate text-[11px] text-[var(--muted)]">
                  {currentSkillLabel} · Lv{charLevel}
                </span>
              </span>
            </button>
            <div className="shrink-0 text-right">
              <span className="relative inline-block leading-none">
                <span key={popKey} className="damage-pop damage-number tnum block text-3xl sm:text-4xl">
                  {formatNumber(result.expected)}
                </span>
                <span key={`burst-${popKey}`} className="damage-burst" aria-hidden="true" />
              </span>
              <p className="mt-1 whitespace-nowrap text-[10px] uppercase tracking-wider text-[var(--muted)]">
                avg · {result.nonCrit > 0 ? `${formatNumber(result.nonCrit)} / ${formatNumber(result.critHit)}` : '—'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ============ Character picker ============ */}
      {!hideCharacterSelect && (
        <dialog
          ref={pickerDialog}
          className="w-[min(92vw,64rem)] rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-0 shadow-2xl backdrop:bg-black/40"
          onClose={() => setPickerOpen(false)}
          onClick={(e) => {
            if (e.target === e.currentTarget) setPickerOpen(false);
          }}
        >
          <div className="flex max-h-[85vh] flex-col p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-[var(--text)]">Choose a character</h2>
            <button
              type="button"
              onClick={() => setPickerOpen(false)}
              aria-label="Close"
              className="rounded-full px-2 py-1 text-sm text-[var(--muted)] transition-colors hover:bg-[var(--soft)] hover:text-[var(--text)]"
            >
              ✕
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search a character…"
              className="h-9 w-full max-w-xs rounded-full border border-[var(--line)] bg-[var(--surface)] px-4 text-sm text-[var(--text)]"
              aria-label="Search characters"
            />
            <div className="flex gap-1.5">
              {(['all', '5', '4'] as const).map((r) => (
                <button key={r} type="button" onClick={() => setRarityFilter(r)} className={chip(rarityFilter === r)}>
                  {r === 'all' ? 'All ★' : `${r}★`}
                </button>
              ))}
            </div>
            <span className="ml-auto text-sm text-[var(--muted)]">
              <span className="font-semibold text-[var(--text)]">{roster.length}</span> characters
            </span>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setElementFilter('all')} className={chip(elementFilter === 'all')}>
              All elements
            </button>
            {ELEMENTS.map((el) => {
              const active = elementFilter === el;
              return (
                <button
                  key={el}
                  type="button"
                  onClick={() => setElementFilter(el)}
                  aria-pressed={active}
                  title={ELEMENT_LABEL[el]}
                  className={`h-10 w-10 overflow-hidden rounded-xl ring-1 transition-all ${
                    active
                      ? 'ring-2 ring-forest-500'
                      : elementFilter === 'all'
                        ? 'ring-[var(--line)] hover:ring-forest-400'
                        : 'opacity-45 ring-[var(--line)] hover:opacity-100'
                  }`}
                >
                  <img src={`/images/element-${el}.webp`} alt={ELEMENT_LABEL[el]} width="120" height="120" className="h-full w-full object-cover" loading="lazy" decoding="async" />
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            <button type="button" onClick={() => setWeaponFilter('all')} className={chip(weaponFilter === 'all')}>
              All weapons
            </button>
            {WEAPON_TYPES.map((w) => (
              <button key={w} type="button" onClick={() => setWeaponFilter(w)} className={chip(weaponFilter === w)}>
                {w[0].toUpperCase() + w.slice(1)}
              </button>
            ))}
          </div>

          {roster.length === 0 ? (
            <p className="panel mt-5 py-16 text-center text-sm text-[var(--muted)]">No characters match those filters.</p>
          ) : (
            <div className="mt-4 flex-1 space-y-6 overflow-y-auto pr-1">
              {groups.map((g) => (
                <div key={g.element}>
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
                    <ElementIcon el={g.element} className="h-4 w-4" />
                    {ELEMENT_LABEL[g.element]}
                    <span className="text-xs font-normal text-[var(--muted)]">({g.rows.length})</span>
                  </h3>
                  <div className="mt-2.5 grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(128px, 1fr))' }}>
                    {g.rows.map((c) => {
                      const active = c.id === charId;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => { onSelectCharacter(c.id); setPickerOpen(false); }}
                          aria-pressed={active}
                          title={c.name}
                          className={`group relative block aspect-square w-full overflow-hidden rounded-xl ring-1 transition-all ${
                            active ? 'ring-2 ring-forest-500' : 'ring-[var(--line)] hover:ring-forest-400'
                          }`}
                        >
                          <span className={`absolute inset-0 bg-linear-to-b ${ELEMENT_BG[c.element] ?? ELEMENT_BG.physical}`} aria-hidden="true" />
                          <img
                            src={`/images/portraits/${c.id}.webp`}
                            alt={`${c.name} portrait`}
                            width="256"
                            height="256"
                            className={`absolute inset-0 h-full w-full object-cover transition-all duration-300 ${
                              active ? 'scale-105 opacity-70' : 'opacity-100 group-hover:scale-110'
                            }`}
                            loading="lazy"
                            decoding="async"
                          />
                          <ElementIcon el={c.element} className="absolute right-2 top-2 h-5 w-5" />
                          {active && (
                            <span className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-forest-600 text-xs font-bold text-white shadow" aria-hidden="true">
                              ✓
                            </span>
                          )}
                          <span className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/80 via-black/40 to-transparent px-2.5 pb-2 pt-9 text-left">
                            <span className="block truncate text-sm font-semibold text-white drop-shadow">{c.name}</span>
                            <span className="block text-[11px] leading-tight text-white/80">
                              {c.weaponType[0].toUpperCase() + c.weaponType.slice(1)} · {'★'.repeat(c.rarity)}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
          </div>
        </dialog>
      )}

      {/* ============ Build + result ============ */}
      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
        <div className="space-y-5">
          <div className="gpanel p-5">
            <h2 className="gpanel-title">Build</h2>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-medium text-[var(--muted)]">Character level</span>
                <input
                  type="number"
                  min={1}
                  max={90}
                  value={charLevel}
                  onChange={(e) => setCharLevel(Math.min(90, Math.max(1, parseInt(e.target.value, 10) || 90)))}
                  className="mt-1 w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-right text-[var(--text)]"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-[var(--muted)]">Weapon</span>
                <select
                  value={weapon?.id ?? ''}
                  onChange={(e) => setWeaponId(e.target.value)}
                  className="mt-1 w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface)] px-2 py-2 text-sm text-[var(--text)]"
                >
                  {weaponOptions.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-[var(--muted)]">Artifact set (4pc)</span>
                <select
                  value={setId}
                  onChange={(e) => setSetId(e.target.value)}
                  className="mt-1 w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface)] px-2 py-2 text-sm text-[var(--text)]"
                >
                  <option value="">None</option>
                  {ARTIFACT_SETS.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-[var(--muted)]">Attack type</span>
                <select
                  value={attackType}
                  onChange={(e) => onSelectAttackType(e.target.value as 'custom' | 'normal' | 'charged' | 'skill' | 'burst')}
                  className="mt-1 w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface)] px-2 py-2 text-sm text-[var(--text)]"
                >
                  <option value="custom">Custom / signature skill</option>
                  <option value="normal">Normal Attack (full combo)</option>
                  <option value="charged">Charged Attack</option>
                  <option value="skill">Elemental Skill</option>
                  <option value="burst">Elemental Burst</option>
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-[var(--muted)]">Skill multiplier <span className="opacity-70">(6.17 = 617%)</span></span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={skillMult}
                  onChange={(e) => setSkillMult(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="mt-1 w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-right text-[var(--text)]"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-[var(--muted)]">Enemy</span>
                <select
                  value={enemyId}
                  onChange={(e) => setEnemyId(e.target.value)}
                  className="mt-1 w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface)] px-2 py-2 text-sm text-[var(--text)]"
                >
                  {ENEMIES.map((en) => (
                    <option key={en.id} value={en.id}>{en.name} (Lv {en.level})</option>
                  ))}
                </select>
              </label>
            </div>

            <label className="mt-3 flex items-center gap-2 text-sm text-[var(--muted)]">
              <input type="checkbox" checked={physical} onChange={(e) => setPhysical(e.target.checked)} className="h-4 w-4" />
              Physical damage (uses Physical RES + Physical goblet / weapon bonus)
            </label>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="block">
                <span className="text-xs font-medium text-[var(--muted)]">Amplifying reaction</span>
                <select
                  value={amplified}
                  onChange={(e) => setAmplified(e.target.value as AmplifiedReaction)}
                  className="mt-1 w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface)] px-2 py-2 text-sm text-[var(--text)]"
                >
                  {AMPLIFIED_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-[var(--muted)]">Transformative reaction</span>
                <select
                  value={transformative}
                  onChange={(e) => setTransformative(e.target.value as TransformativeReaction)}
                  className="mt-1 w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface)] px-2 py-2 text-sm text-[var(--text)]"
                >
                  {TRANSFORMATIVE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </label>
              <AdditiveSelect value={additive} onChange={setAdditive} label="Catalyze (Aggravate / Spread)" />
            </div>

            {transformative === 'swirl' && (
              <label className="mt-3 block max-w-xs">
                <span className="text-xs font-medium text-[var(--muted)]">Swirl absorbed element</span>
                <select
                  value={swirlElement}
                  onChange={(e) => setSwirlElement(e.target.value as ElementType)}
                  className="mt-1 w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface)] px-2 py-2 text-sm text-[var(--text)]"
                >
                  {SWIRLABLE.map((el) => (
                    <option key={el} value={el}>{ELEMENT_LABEL[el]}</option>
                  ))}
                </select>
              </label>
            )}

            <div className="mt-4">
              <span className="text-xs font-medium text-[var(--muted)]">External buffs (toggle to stack)</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {BUFF_PRESETS.filter((b) => b.id !== 'none').map((b) => (
                  <button key={b.id} type="button" onClick={() => toggleBuff(b.id)} aria-pressed={buffIds.includes(b.id)} className={chip(buffIds.includes(b.id))}>
                    {b.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="gpanel p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="gpanel-title">Artifacts</h2>
              <div className="flex gap-2">
                <button type="button" onClick={() => setArtifacts(resolvePreset(character))} className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-medium text-[var(--muted)] transition-colors hover:text-[var(--text)]">
                  Load preset
                </button>
                <button type="button" onClick={() => setArtifacts(EMPTY_ARTIFACTS)} className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-medium text-[var(--muted)] transition-colors hover:text-[var(--text)]">
                  Clear
                </button>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {([
                ['sandsMain', 'Sands', SANDS_OPTIONS],
                ['gobletMain', 'Goblet', GOBLET_OPTIONS],
                ['circletMain', 'Circlet', CIRCLET_OPTIONS],
              ] as const).map(([slot, label, options]) => (
                <label key={slot} className="block">
                  <span className="text-xs font-medium text-[var(--muted)]">{label}</span>
                  <select
                    value={artifacts[slot].type}
                    onChange={(e) => setMain(slot, e.target.value as SecondaryStatType)}
                    className="mt-1 w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface)] px-2 py-1.5 text-[var(--text)]"
                  >
                    {options.map((o) => (
                      <option key={o} value={o}>{SECONDARY_LABEL[o]}</option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {SUB_FIELDS.map((s) => (
                <label key={s.key} className="block">
                  <span className="text-xs font-medium text-[var(--muted)]">{s.label}</span>
                  <input
                    type="number"
                    step={s.percent ? 1 : 10}
                    value={s.percent ? Number(((artifacts[s.key] ?? 0) * 100).toFixed(1)) : Math.round(artifacts[s.key] ?? 0)}
                    onChange={(e) => {
                      const raw = parseFloat(e.target.value) || 0;
                      setArtifact({ [s.key]: s.percent ? raw / 100 : raw } as Partial<ArtifactBuild>);
                    }}
                    className="mt-1 w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface)] px-2 py-1.5 text-right text-[var(--text)]"
                  />
                </label>
              ))}
            </div>
          </div>

        </div>

        <div className="space-y-5 lg:sticky lg:top-28 lg:self-start">
          <div className="gpanel p-5 text-center">
            <p className="text-sm font-medium uppercase tracking-wide text-[var(--muted)]">Expected damage</p>
            <p className="damage-number tnum mt-3 text-5xl">{formatNumber(result.expected)}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">{result.skillLabel} · averaged over crits · {result.reactionName}</p>

            <div className="mt-5 grid grid-cols-3 gap-3 border-t border-[var(--line)] pt-5">
              <div>
                <p className="text-xs text-[var(--muted)]">Non-crit</p>
                <p className="tnum text-lg font-semibold text-[var(--text)]">{formatNumber(result.nonCrit)}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--muted)]">Crit hit</p>
                <p className="tnum text-lg font-semibold text-forest-600">{formatNumber(result.critHit)}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--muted)]">Reaction</p>
                <p className="tnum text-lg font-semibold text-[var(--text)]">
                  {result.transformative > 0 ? formatNumber(result.transformative) : '—'}
                </p>
              </div>
            </div>
            {result.transformative > 0 && <p className="mt-1 text-xs text-[var(--muted)]">{result.transformativeName} reaction damage</p>}
          </div>

          <div className="gpanel p-5">
            <h3 className="gpanel-title">Damage breakdown</h3>
            <p className="mt-1 text-xs text-[var(--muted)]">Each multiplier’s contribution — red bars mark your weakest links.</p>
            <div className="mt-4 space-y-3">
              {multipliers.map((m) => {
                const pct = Math.max((m.value / m.baseline) * 100, 4);
                const weak = m.value < m.baseline * 0.85;
                return (
                  <div key={m.name}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[var(--muted)]">{m.name}</span>
                      <span className={`tnum font-medium ${weak ? 'text-pyro' : 'text-[var(--text)]'}`}>{m.display}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]">
                      <div className={`h-full rounded-full ${weak ? 'bg-pyro/70' : 'bg-forest-600'}`} style={{ width: `${Math.min(pct, 150)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="gpanel p-5">
            <h3 className="gpanel-title">Panel</h3>
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--line)] text-left text-xs text-[var(--muted)]">
                  <th className="py-1.5 font-medium">Stat</th>
                  <th className="py-1.5 text-right font-medium">Base</th>
                  <th className="py-1.5 text-right font-medium">Mod</th>
                  <th className="py-1.5 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {statRows.map((row) => {
                  const mod = row.total - row.base;
                  const fmt = (v: number) => (row.pct ? formatPercent(v) : formatNumber(v));
                  return (
                    <tr key={row.label} className="border-b border-[var(--line)] last:border-0">
                      <td className="py-1.5 text-[var(--muted)]">{row.label}</td>
                      <td className="tnum py-1.5 text-right text-[var(--muted)]">{fmt(row.base)}</td>
                      <td className="tnum py-1.5 text-right text-[var(--text)]">{mod >= 0 ? '+' : ''}{fmt(mod)}</td>
                      <td className="tnum py-1.5 text-right font-semibold text-[var(--text)]">{fmt(row.total)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {critRateRaw > 1 && (
              <p className="mt-2 text-xs text-pyro">CRIT Rate is overcapped ({(critRateRaw * 100).toFixed(1)}% before the 100% cap).</p>
            )}
            <p className="mt-3 text-xs text-[var(--muted)]">
              <span className={ELEMENT_STYLES[character.element].text}>{ELEMENT_STYLES[character.element].label}</span> damage
              {' · '}vs {enemy.name}
              {' · '}{buffNames.length > 0 ? `Buffs: ${buffNames.join(', ')}` : 'No external buffs'}
            </p>
          </div>

          {advice.length > 0 && (
            <div className="gpanel border-forest-500/30 p-5">
              <h3 className="gpanel-title">Highest-value upgrades</h3>
              <ul className="mt-3 space-y-3">
                {advice.map((a, i) => (
                  <li key={a.label} className="flex items-start gap-3">
                    <span className="tnum mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-forest-600/12 text-xs font-semibold text-forest-600">
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--text)]">
                        {a.label} <span className="tnum ml-1 font-semibold text-dendro">+{formatPercent(a.gainPercent)}</span>
                      </p>
                      <p className="mt-0.5 text-xs leading-relaxed text-[var(--muted)]">{a.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
