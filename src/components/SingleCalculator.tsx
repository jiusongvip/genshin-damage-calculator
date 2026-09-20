import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { RELEASED_CHARACTERS as CHARACTERS } from '../data/characters';
import { weaponsForType } from '../data/weapons';
import { ENEMIES } from '../data/enemies';
import { NO_ARTIFACTS, DEFAULT_BUFFS } from '../data/presets';
import { addBuffs, computeDamage, formatNumber, formatPercent } from '../lib/damage';
import type {
  AdditiveReaction,
  AmplifiedReaction,
  BuffState,
  ElementType,
  TransformativeReaction,
} from '../lib/damage';
import { ELEMENT_LABEL } from '../data/elements';
import { TALENTS, signatureTalent } from '../data/talents';
import type { TalentKey } from '../data/talents';
import { ElementIcon } from './TeamCalculator';

const ELEMENTS: ElementType[] = ['pyro', 'hydro', 'electro', 'cryo', 'anemo', 'geo', 'dendro'];
const SWIRLABLE: ElementType[] = ['pyro', 'hydro', 'electro', 'cryo'];
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
  };
}

/** Percent input: shows 12.3 for 0.123 and writes back the fraction. */
function Pct({
  value,
  onChange,
  label,
  step = 1,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
  step?: number;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-[var(--muted)]">{label}</span>
      <div className="mt-1 flex items-center gap-1">
        <input
          type="number"
          inputMode="decimal"
          step={step}
          value={Number((value * 100).toFixed(2))}
          onChange={(e) => onChange((parseFloat(e.target.value) || 0) / 100)}
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
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
  step?: number;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-[var(--muted)]">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="mt-1 w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface)] px-2 py-1.5 text-right text-[var(--text)]"
      />
    </label>
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

  // Whiteboard (character + weapon, no artifacts, no buffs) — the defaults the
  // six zones start from and what "reset" restores.
  const whiteboard = useMemo(
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

  const whiteCritRate = whiteboard.critRate;
  const whiteCritDMG = whiteboard.critDMG;
  const whiteEM = whiteboard.em;
  const scaling = character.scaling ?? 'atk';

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

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
      {
        critRate: draft.critRate ? draft.critRate - whiteCritRate : 0,
        critDMG: draft.critDMG ? draft.critDMG - whiteCritDMG : 0,
      },
      { em: draft.em ? draft.em - whiteEM : 0 },
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
  }, [draft, scaling, whiteboard.baseStat, whiteCritRate, whiteCritDMG, whiteEM]);

  const result = useMemo(
    () =>
      computeDamage({
        character,
        weapon,
        artifacts: NO_ARTIFACTS,
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
    [character, weapon, buffs, enemy, draft.level, draft.attackType, draft.skillMult, draft.amplified, draft.additive, draft.transformative, draft.swirlElement],
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
    setDraft({
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
    });
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
            <img src={`/images/portraits/${character.id}.webp`} alt="" width="256" height="256" className="absolute inset-0 h-full w-full object-cover" />
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
          <select
            value={weapon?.id ?? ''}
            onChange={(e) => set('weaponId', e.target.value)}
            className="h-8 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 text-sm text-[var(--text)]"
          >
            {weaponOptions.map((w) => (
              <option key={w.id} value={w.id}>{w.name} · {w.rarity}★</option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
          Enemy
          <select
            value={draft.customEnemy ? 'custom' : draft.enemyId}
            onChange={(e) => {
              if (e.target.value === 'custom') {
                setDraft((d) => ({ ...d, customEnemy: true, enemyLevel: enemy.level, enemyRes: enemy.resistances.default }));
              } else {
                setDraft((d) => ({ ...d, customEnemy: false, enemyId: e.target.value }));
              }
            }}
            className="h-8 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 text-sm text-[var(--text)]"
          >
            {ENEMIES.map((en) => (
              <option key={en.id} value={en.id}>{en.name} · Lv{en.level}</option>
            ))}
            <option value="custom">Custom…</option>
          </select>
        </label>
        {draft.customEnemy && (
          <>
            <label className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
              Lv
              <input type="number" value={draft.enemyLevel} onChange={(e) => set('enemyLevel', parseInt(e.target.value, 10) || 90)} className="h-8 w-16 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 text-right text-sm text-[var(--text)]" />
            </label>
            <label className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
              RES %
              <input type="number" value={Math.round(draft.enemyRes * 100)} onChange={(e) => set('enemyRes', (parseFloat(e.target.value) || 0) / 100)} className="h-8 w-16 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 text-right text-sm text-[var(--text)]" />
            </label>
          </>
        )}
      </div>

      {/* ============ Character picker ============ */}
      {pickerOpen && (
        <dialog
          ref={pickerDialog}
          className="gear-dialog"
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
                  <div className="mt-2 grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))' }}>
                    {g.rows.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => { pickCharacter(c.id); setPickerOpen(false); }}
                        title={c.name}
                        className={`relative aspect-square overflow-hidden rounded-xl ring-1 transition-all ${c.id === character.id ? 'ring-2 ring-forest-500' : 'ring-[var(--line)] hover:ring-forest-400'}`}
                      >
                        <img src={`/images/portraits/${c.id}.webp`} alt={`${c.name} portrait`} width="256" height="256" loading="lazy" decoding="async" className={`h-full w-full object-cover ${c.id === character.id ? 'opacity-70' : ''}`} />
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
                  value={Math.round(draft.statOverride ?? whiteboard.baseStat)}
                  onChange={(e) => set('statOverride', parseFloat(e.target.value) || 0)}
                  className="mt-1 w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface)] px-2 py-1.5 text-right text-[var(--text)]"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-[var(--muted)]">Skill type</span>
                <select
                  value={draft.attackType}
                  onChange={(e) => {
                    const t = e.target.value as TalentKey;
                    const tal = TALENTS[character.id];
                    setDraft((d) => ({ ...d, attackType: t, skillMult: tal && tal[t] > 0 ? tal[t] : d.skillMult }));
                  }}
                  className="mt-1 w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface)] px-2 py-2 text-sm text-[var(--text)]"
                >
                  {ATTACKS.map((a) => (
                    <option key={a.value} value={a.value}>{a.label}</option>
                  ))}
                </select>
              </label>
              <Pct label="Skill multiplier" value={draft.skillMult / 100} onChange={(v) => set('skillMult', v * 100)} step={1} />
              <div className="grid grid-cols-2 gap-3">
                <Pct label="Base DMG bonus" value={draft.baseDmgBonus} onChange={(v) => set('baseDmgBonus', v)} />
                <Num label="Flat base DMG" value={draft.flatBaseDmg} onChange={(v) => set('flatBaseDmg', v)} step={10} />
              </div>
            </div>
            <p className="mt-2 text-xs text-[var(--muted)]">{SCALING_LABEL[scaling]} {formatNumber(result.baseStat)} × {formatPercent(result.skillMultiplier)} = {formatNumber(baseDamage)}</p>
          </Zone>

          {/* 2 — Bonus */}
          <Zone id="bonus" index={2} title="DMG bonus" value={`×${dmgMult.toFixed(3)}`} changed={!!(draft.dmgBonus || draft.dmgReduction)} onReset={() => setDraft((d) => ({ ...d, dmgBonus: 0, dmgReduction: 0 }))} onEnter={setHighlight}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Pct label="Elemental / Physical DMG" value={draft.dmgBonus} onChange={(v) => set('dmgBonus', v)} />
              <Pct label="Target DMG reduction" value={draft.dmgReduction} onChange={(v) => set('dmgReduction', v)} />
            </div>
            <p className="mt-2 text-xs text-[var(--muted)]">1 + {formatPercent(result.dmgBonus)} − {formatPercent(draft.dmgReduction)} = {dmgMult.toFixed(3)}</p>
          </Zone>

          {/* 3 — Crit */}
          <Zone id="crit" index={3} title="CRIT" value={`×${critMult.toFixed(3)}`} changed={!!(draft.critRate || draft.critDMG || draft.critMode !== 'expected')} onReset={() => setDraft((d) => ({ ...d, critRate: 0, critDMG: 0, critMode: 'expected' }))} onEnter={setHighlight}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Pct label="CRIT Rate" value={draft.critRate || whiteCritRate} onChange={(v) => set('critRate', v)} />
              <Pct label="CRIT DMG" value={draft.critDMG || whiteCritDMG} onChange={(v) => set('critDMG', v)} />
              <label className="block">
                <span className="text-xs font-medium text-[var(--muted)]">Settlement</span>
                <select
                  value={draft.critMode}
                  onChange={(e) => set('critMode', e.target.value as CritMode)}
                  className="mt-1 w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface)] px-2 py-2 text-sm text-[var(--text)]"
                >
                  <option value="expected">Expected (average)</option>
                  <option value="crit">Always CRIT</option>
                  <option value="nonCrit">Never CRIT</option>
                </select>
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
                <span className="text-xs font-medium text-[var(--muted)]">Amplifying (multiplies the hit)</span>
                <select value={draft.amplified} onChange={(e) => set('amplified', e.target.value as AmplifiedReaction)} className="mt-1 w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface)] px-2 py-2 text-sm text-[var(--text)]">
                  {AMPLIFIED.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-[var(--muted)]">Additive (added to base DMG)</span>
                <select value={draft.additive} onChange={(e) => set('additive', e.target.value as AdditiveReaction)} className="mt-1 w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface)] px-2 py-2 text-sm text-[var(--text)]">
                  {ADDITIVE.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-[var(--muted)]">Transformative (separate hit, no CRIT)</span>
                <select value={draft.transformative} onChange={(e) => set('transformative', e.target.value as TransformativeReaction)} className="mt-1 w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface)] px-2 py-2 text-sm text-[var(--text)]">
                  {TRANSFORMATIVE.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
                </select>
              </label>
              {draft.transformative === 'swirl' && (
                <label className="block">
                  <span className="text-xs font-medium text-[var(--muted)]">Swirl absorbed element</span>
                  <select value={draft.swirlElement} onChange={(e) => set('swirlElement', e.target.value as ElementType)} className="mt-1 w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface)] px-2 py-2 text-sm text-[var(--text)]">
                    {SWIRLABLE.map((el) => (<option key={el} value={el}>{ELEMENT_LABEL[el]}</option>))}
                  </select>
                </label>
              )}
              <Num label="Elemental Mastery" value={draft.em || Math.round(whiteEM)} onChange={(v) => set('em', v)} step={10} />
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Pct label="Reaction bonus" value={draft.reactionBonus} onChange={(v) => set('reactionBonus', v)} />
              <Pct label="Amplifying bonus" value={draft.ampReactionBonus} onChange={(v) => set('ampReactionBonus', v)} />
              <Pct label="Transformative bonus" value={draft.transformReactionBonus} onChange={(v) => set('transformReactionBonus', v)} />
            </div>
            <p className="mt-2 text-xs text-[var(--muted)]">{result.reactionName}{result.additive > 0 ? ` · ${result.additiveName} adds ${formatNumber(result.additive)} to base` : ''}</p>
          </Zone>

          {/* 5 — DEF */}
          <Zone id="def" index={5} title="Enemy DEF" value={`×${result.defMultiplier.toFixed(3)}`} changed={!!(draft.defShred || draft.defIgnore)} onReset={() => setDraft((d) => ({ ...d, defShred: 0, defIgnore: 0 }))} onEnter={setHighlight}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Pct label="DEF reduction" value={draft.defShred} onChange={(v) => set('defShred', v)} />
              <Pct label="DEF ignore" value={draft.defIgnore} onChange={(v) => set('defIgnore', v)} />
            </div>
            <p className="mt-2 text-xs text-[var(--muted)]">({draft.level}+100) / (({draft.level}+100) + ({enemy.level}+100)(1−{formatPercent(draft.defShred)})(1−{formatPercent(draft.defIgnore)})) = {result.defMultiplier.toFixed(3)}</p>
          </Zone>

          {/* 6 — RES */}
          <Zone id="res" index={6} title="Enemy RES" value={`×${result.resMultiplier.toFixed(3)}`} changed={!!draft.resShred} onReset={() => set('resShred', 0)} onEnter={setHighlight}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Pct label={`${ELEMENT_LABEL[character.element]} RES (base)`} value={enemy.resistances[character.element] ?? enemy.resistances.default} onChange={(v) => setDraft((d) => ({ ...d, customEnemy: true, enemyRes: v }))} />
              <Pct label="RES reduction" value={draft.resShred} onChange={(v) => set('resShred', v)} />
            </div>
            <p className="mt-2 text-xs text-[var(--muted)]">Effective RES {(formatPercent((enemy.resistances[character.element] ?? enemy.resistances.default) - draft.resShred))} → ×{result.resMultiplier.toFixed(3)} {result.resMultiplier > 1 ? '(negative RES, amplified)' : (result.resMultiplier === 1 ? '(standard band)' : '(reduced)')}</p>
          </Zone>
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
            Reference panel · character + weapon only · <strong className="text-[var(--text)]">no artifacts</strong>. Numbers are the calculator’s own model, not scraped game data.
          </p>
        </div>
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {character.name} expected damage {formatNumber(expected)}.
      </p>
    </div>
  );
}
