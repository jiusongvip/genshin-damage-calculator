import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { createPortal } from 'react-dom';
// Unreleased characters are datamined, so their stats are guesses and the art
// is not ours to publish — the roster ships released characters only. Swap this
// for `CHARACTERS` to put them back; the "Upcoming" badge below is already
// wired up for that case.
import { RELEASED_CHARACTERS as CHARACTERS } from '../data/characters';
import { getWeapon, weaponsForType } from '../data/weapons';
import { ENEMIES } from '../data/enemies';
import { DEFAULT_BUFFS, BUFF_PRESETS, BUFF_BY_CHARACTER, NO_ARTIFACTS } from '../data/presets';
import { addBuffs, computeDamage, formatNumber } from '../lib/damage';
import type { AdditiveReaction, AmplifiedReaction, BuffState, CharacterData, ElementType, SecondaryStatType, TransformativeReaction } from '../lib/damage';
import { ELEMENT_LABEL } from '../data/elements';
import { signatureTalent } from '../data/talents';

const ELEMENTS: ElementType[] = ['pyro', 'hydro', 'electro', 'cryo', 'anemo', 'geo', 'dendro'];
const WEAPON_TYPES = ['sword', 'claymore', 'polearm', 'bow', 'catalyst'] as const;

const SECONDARY_LABEL: Record<SecondaryStatType, string> = {
  'atk%': 'ATK',
  'hp%': 'HP',
  'def%': 'DEF',
  critRate: 'CRIT Rate',
  critDMG: 'CRIT DMG',
  em: 'Elemental Mastery',
  er: 'Energy Recharge',
  physical: 'Physical DMG',
  'dmg%': 'DMG Bonus',
};

/** "CRIT DMG 66.2%" / "Elemental Mastery 221" for a weapon's secondary stat. */
function formatSecondary(type: SecondaryStatType, value: number): string {
  const label = SECONDARY_LABEL[type];
  return type === 'em' ? `${Math.round(value)} ${label}` : `${(value * 100).toFixed(1)}% ${label}`;
}

// Element-tinted tile backgrounds (the transparent avatar sits on top).
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

// Elemental resonance — two of the same element. Damage-relevant, unconditional
// resonances are folded into the calculation; conditional ones are shown only.
const RESONANCE: Record<string, { name: string; effect: string; buffs: Partial<BuffState> }> = {
  pyro: { name: 'Fervent Flames', effect: '+25% ATK', buffs: { atkPercent: 0.25 } },
  hydro: { name: 'Soothing Water', effect: '+25% Max HP', buffs: { hpPercent: 0.25 } },
  dendro: { name: 'Sprawling Greenery', effect: '+50 Elemental Mastery', buffs: { em: 50 } },
  cryo: { name: 'Shattering Ice', effect: '+15% CRIT Rate vs Frozen / Cryo-affected', buffs: {} },
  electro: { name: 'High Voltage', effect: 'Electro-Charged generates Energy', buffs: {} },
  geo: { name: 'Enduring Rock', effect: '+15% Shield Strength; +15% DMG while shielded', buffs: {} },
  anemo: { name: 'Impetuous Winds', effect: '−15% Stamina cost, +10% movement SPD, −5% Skill CD', buffs: {} },
};

const ROTATION_SECONDS = 20;

/** Elements a Swirl can absorb, in the order we pick one when several are present. */
const SWIRLABLE: ElementType[] = ['pyro', 'hydro', 'electro', 'cryo'];
const MAX_TEAM = 4;

/**
 * Fallback team, used only if the page does not pass one in. The real default
 * is computed at build time from the site's own reference-damage table and
 * handed over as `defaultTeam`, so it tracks the data instead of rotting.
 */
const FALLBACK_TEAM = ['hu-tao', 'xingqiu', 'bennett', 'kazuha'];

/** Per-character overrides set in the Gear dialog. Bare numbers: no artifacts. */
type CharConfig = { level: number; weaponId: string };

type ReactionPick = {
  amplified: AmplifiedReaction;
  additive: AdditiveReaction;
  transformative: TransformativeReaction;
};

/**
 * Pick the reaction THIS character actually triggers, given who else is on the
 * team. Priority: amplifying (Vaporize / Melt) → additive (Aggravate / Spread)
 * → transformative (Overload, Bloom family, …). Returns none when no teammate
 * can supply the needed aura.
 */
function reactionFor(element: ElementType, team: Set<ElementType>): ReactionPick {
  const has = (e: ElementType) => team.has(e);
  const amp = (a: AmplifiedReaction): ReactionPick => ({ amplified: a, additive: 'none', transformative: 'none' });
  const add = (a: AdditiveReaction): ReactionPick => ({ amplified: 'none', additive: a, transformative: 'none' });
  const tr = (t: TransformativeReaction): ReactionPick => ({ amplified: 'none', additive: 'none', transformative: t });

  if (element === 'pyro') {
    if (has('cryo')) return amp('melt'); // Pyro on Cryo → 2.0
    if (has('dendro') && has('hydro')) return tr('burgeon'); // Pyro detonates a Bloom core
    if (has('hydro')) return amp('vaporize'); // Pyro on Hydro → 1.5
    if (has('electro')) return tr('overload');
    if (has('dendro')) return tr('burning');
  }
  if (element === 'hydro') {
    if (has('pyro')) return amp('vaporize'); // Hydro on Pyro → 2.0
    if (has('electro')) return tr('electroCharged');
    if (has('dendro')) return tr('bloom');
  }
  if (element === 'cryo') {
    if (has('pyro')) return amp('melt'); // Cryo on Pyro → 1.5
    if (has('electro')) return tr('superconduct');
  }
  if (element === 'electro') {
    if (has('dendro')) {
      if (has('hydro')) return tr('hyperbloom');
      return add('aggravate');
    }
    if (has('pyro')) return tr('overload');
    if (has('hydro')) return tr('electroCharged');
    if (has('cryo')) return tr('superconduct');
  }
  if (element === 'dendro') {
    if (has('electro')) {
      if (has('hydro')) return tr('bloom');
      return add('spread');
    }
    if (has('hydro')) return tr('bloom');
    if (has('pyro')) return tr('burning');
  }
  if (element === 'anemo' && (has('pyro') || has('hydro') || has('electro') || has('cryo'))) {
    return tr('swirl');
  }
  return { amplified: 'none', additive: 'none', transformative: 'none' };
}

/** Human-readable summary of what a buff actually does, e.g. "+900 ATK · −40% RES". */
function describeBuffs(buffs: Partial<BuffState>): string {
  const pct = (v: number) => `${v > 0 ? '+' : '−'}${Math.round(Math.abs(v) * 100)}%`;
  const parts: string[] = [];
  if (buffs.flatATK) parts.push(`+${buffs.flatATK} ATK`);
  if (buffs.atkPercent) parts.push(`${pct(buffs.atkPercent)} ATK`);
  if (buffs.hpPercent) parts.push(`${pct(buffs.hpPercent)} Max HP`);
  if (buffs.em) parts.push(`+${buffs.em} EM`);
  if (buffs.dmgBonus) parts.push(`${pct(buffs.dmgBonus)} DMG`);
  if (buffs.critRate) parts.push(`${pct(buffs.critRate)} CRIT Rate`);
  if (buffs.critDMG) parts.push(`${pct(buffs.critDMG)} CRIT DMG`);
  if (buffs.resShred) parts.push(`${pct(-buffs.resShred)} enemy RES`);
  if (buffs.defShred) parts.push(`${pct(-buffs.defShred)} enemy DEF`);
  return parts.join(' · ');
}

/** Resolve a buff-source id to the avatar to show: a character portrait or an element logo. */
function sourceAvatar(
  id: string,
): { kind: 'char'; charId: string } | { kind: 'element'; element: ElementType } | null {
  if (id.startsWith('char-')) return { kind: 'char', charId: id.slice(5) };
  if (id.startsWith('res-')) return { kind: 'element', element: id.slice(4) as ElementType };
  return null;
}

/** The element logo that replaces the old coloured dot everywhere. */
export function ElementIcon({ el, className = 'h-4 w-4' }: { el: string; className?: string }) {
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

/**
 * Smooth count-up so damage figures never jump abruptly.
 *
 * The animation is decoration; the final number is the product. requestAnimation-
 * Frame stops firing in a background tab, behind an occluded window and under
 * battery saver, so the tween alone would leave the headline damage frozen on a
 * stale value with no way back. Every exit path therefore snaps to `target`:
 * a reduced-motion preference skips the tween entirely, a watchdog fires just
 * after the animation should have finished, and unmount-time cleanup commits the
 * final value rather than abandoning it mid-tween.
 */
function useCountUp(target: number, duration = 550) {
  const [value, setValue] = useState(target);
  const valueRef = useRef(target);

  useEffect(() => {
    const from = valueRef.current;
    if (from === target) return;

    const commit = () => {
      valueRef.current = target;
      setValue(target);
    };

    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      commit();
      return;
    }

    let raf = 0;
    let done = false;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      if (p < 1) {
        const next = from + (target - from) * eased;
        valueRef.current = next;
        setValue(next);
        raf = requestAnimationFrame(tick);
      } else {
        done = true;
        commit();
      }
    };
    raf = requestAnimationFrame(tick);

    // Fires if rAF never ran, or ran too slowly to reach the end.
    const watchdog = window.setTimeout(() => {
      if (!done) {
        done = true;
        cancelAnimationFrame(raf);
        commit();
      }
    }, duration + 120);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(watchdog);
      if (!done) commit();
    };
  }, [target, duration]);

  return value;
}

type Flyer = { key: number; id: string; x: number; y: number; w: number; h: number; dx: number; dy: number };

export default function TeamCalculator({ defaultTeam }: { defaultTeam?: string[] } = {}) {
  const initialTeam = useMemo(() => {
    const wanted = defaultTeam?.length ? defaultTeam : FALLBACK_TEAM;
    return wanted.filter((id) => CHARACTERS.some((c) => c.id === id)).slice(0, MAX_TEAM);
  }, [defaultTeam]);

  const [selected, setSelected] = useState<string[]>(initialTeam);
  // The pre-filled team is only a showcase, so the page never opens on an empty
  // calculator. The first character the user picks takes the whole team over —
  // nobody should have to empty four slots before building their own.
  const [isDemo, setIsDemo] = useState(() => initialTeam.length > 0);
  const [query, setQuery] = useState('');
  const [elementFilter, setElementFilter] = useState<'all' | ElementType>('all');
  const [weaponFilter, setWeaponFilter] = useState<'all' | string>('all');
  const [rarityFilter, setRarityFilter] = useState<'all' | '4' | '5'>('all');
  const [configs, setConfigs] = useState<Record<string, CharConfig>>({});
  // Character whose level / weapon dialog is open.
  const [gearFor, setGearFor] = useState<string | null>(null);

  // Target the whole team is measured against — DEF and RES multipliers depend
  // on it, so it is first-class rather than a hard-coded enemy.
  const [enemyId, setEnemyId] = useState(ENEMIES[0].id);
  const [customEnemy, setCustomEnemy] = useState(false);
  const [enemyLevel, setEnemyLevel] = useState(90);
  const [enemyRes, setEnemyRes] = useState(0.1);
  const baseEnemy = ENEMIES.find((e) => e.id === enemyId) ?? ENEMIES[0];
  const enemy = useMemo(
    () =>
      customEnemy
        ? { ...baseEnemy, level: enemyLevel, resistances: { ...baseEnemy.resistances, default: enemyRes } }
        : baseEnemy,
    [customEnemy, enemyLevel, enemyRes, baseEnemy],
  );

  // Interaction state
  const [flyers, setFlyers] = useState<Flyer[]>([]);
  const [flash, setFlash] = useState<string | null>(null);
  const [bump, setBump] = useState(false);
  // Bumped on every click that finds the team full; keyed onto the 4/4 counter
  // so each click restarts its flash.
  const [fullKey, setFullKey] = useState(0);
  // Spoken to screen readers, since the flash alone says nothing to them.
  const [announce, setAnnounce] = useState('');
  const [popSlot, setPopSlot] = useState<number | null>(null);
  // Portals need a real document, which the server render does not have.
  const [mounted, setMounted] = useState(false);
  const [popKey, setPopKey] = useState(0);
  const flyKey = useRef(0);
  const prevTotal = useRef<number | null>(null);
  const slotRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const barRef = useRef<HTMLDivElement | null>(null);
  const [barH, setBarH] = useState(76);
  const gearDialog = useRef<HTMLDialogElement | null>(null);
  const cardRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const configFor = (c: CharacterData): CharConfig =>
    configs[c.id] ?? { level: 90, weaponId: c.bestWeapon };
  const updateConfig = (c: CharacterData, patch: Partial<CharConfig>) => {
    // Tuning someone's gear means the user has adopted this team, example or
    // not; otherwise their next pick would take over and throw the edit away.
    setIsDemo(false);
    setConfigs((prev) => ({
      ...prev,
      [c.id]: { ...(prev[c.id] ?? { level: 90, weaponId: c.bestWeapon }), ...patch },
    }));
  };

  const roster = useMemo(
    () =>
      CHARACTERS.filter(
        (c) =>
          (elementFilter === 'all' || c.element === elementFilter) &&
          (weaponFilter === 'all' || c.weaponType === weaponFilter) &&
          (rarityFilter === 'all' || String(c.rarity) === rarityFilter) &&
          (query.trim() === '' || c.name.toLowerCase().includes(query.trim().toLowerCase())),
      ),
    [elementFilter, weaponFilter, rarityFilter, query],
  );

  const groups = useMemo(
    () =>
      ELEMENTS.map((el) => ({ element: el, rows: roster.filter((c) => c.element === el) })).filter(
        (g) => g.rows.length > 0,
      ),
    [roster],
  );

  const synergy = useMemo(() => {
    const teamElements = selected
      .map((id) => CHARACTERS.find((c) => c.id === id)?.element)
      .filter(Boolean) as ElementType[];
    const counts: Record<string, number> = {};
    for (const el of teamElements) counts[el] = (counts[el] ?? 0) + 1;
    const resonances: ElementType[] = (Object.keys(RESONANCE) as ElementType[]).filter(
      (el) => (counts[el] ?? 0) >= 2,
    );
    return { resonances };
  }, [selected]);

  /** Every buff source that is currently active (auto-detected characters + resonance). */
  const buffSources = useMemo(() => {
    const srcs: { id: string; label: string; effect: string; buffs: Partial<BuffState> }[] = [];
    for (const id of selected) {
      const presetId = BUFF_BY_CHARACTER[id];
      if (!presetId) continue;
      const preset = BUFF_PRESETS.find((b) => b.id === presetId);
      if (preset) {
        srcs.push({ id: `char-${id}`, label: preset.label, effect: describeBuffs(preset.buffs), buffs: preset.buffs });
      }
    }
    for (const el of synergy.resonances) {
      srcs.push({ id: `res-${el}`, label: RESONANCE[el].name, effect: RESONANCE[el].effect, buffs: RESONANCE[el].buffs });
    }
    return srcs;
  }, [selected, synergy]);

  const buffs = useMemo(
    () => addBuffs(DEFAULT_BUFFS, ...buffSources.map((s) => s.buffs)),
    [buffSources],
  );

  const computeRows = (merged: BuffState) => {
    const teamSet = new Set(
      selected.map((id) => CHARACTERS.find((x) => x.id === id)?.element).filter(Boolean) as ElementType[],
    );
    return selected.map((id) => {
      const c = CHARACTERS.find((x) => x.id === id)!;
      const cfg = configs[c.id] ?? { level: 90, weaponId: c.bestWeapon };
      const weapon = getWeapon(cfg.weaponId) ?? getWeapon(c.bestWeapon) ?? weaponsForType(c.weaponType)[0];
      const pick = reactionFor(c.element, teamSet);
      const attackType = signatureTalent(c.id)?.key ?? 'burst';
      const r = computeDamage({
        character: c,
        weapon,
        // Bare numbers: character and weapon only, no artifacts yet.
        artifacts: NO_ARTIFACTS,
        buffs: merged,
        enemy,
        characterLevel: cfg.level,
        attackType,
        amplified: pick.amplified,
        transformative: pick.transformative,
        additive: pick.additive,
        // Swirl deals the absorbed element's damage, so it is resisted as that
        // element rather than as Anemo.
        swirlElement: pick.transformative === 'swirl' ? SWIRLABLE.find((e) => teamSet.has(e)) : undefined,
      });
      const reactionLabel =
        pick.amplified !== 'none'
          ? r.reactionName
          : pick.additive !== 'none'
            ? r.additiveName
            : pick.transformative !== 'none'
              ? r.transformativeName
              : 'No reaction';
      return { character: c, weapon, result: r, reactionLabel };
    });
  };

  const rows = useMemo(() => computeRows(buffs), [selected, buffs, configs, enemy]);
  const total = rows.reduce((sum, x) => sum + x.result.expected + x.result.transformative, 0);
  const dps = total / ROTATION_SECONDS;

  /** Per-source damage contribution — so instead of just the resonance name, the
   *  user sees exactly how much damage it is worth. Memoised: each entry costs a
   *  full team recompute, and the count-up animation re-renders ~60x/second. */
  const breakdown = useMemo(
    () =>
      buffSources.map((src) => {
        const without = addBuffs(
          DEFAULT_BUFFS,
          ...buffSources.filter((other) => other.id !== src.id).map((other) => other.buffs),
        );
        const t = computeRows(without).reduce((sum, x) => sum + x.result.expected + x.result.transformative, 0);
        return { ...src, delta: total - t };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- computeRows is derived from these
    [buffSources, selected, configs, total],
  );

  /** Only the elemental-resonance sources belong in the synergy module. */
  const resonanceBreakdown = breakdown.filter((b) => b.id.startsWith('res-'));

  const animatedTotal = useCountUp(total);
  const animatedDps = useCountUp(dps);

  // Genshin-style burst every time the figure changes.
  useEffect(() => {
    if (prevTotal.current === total) return;
    prevTotal.current = total;
    setPopKey((k) => k + 1);
  }, [total]);

  const remove = (id: string) => {
    setIsDemo(false);
    setSelected((prev) => prev.filter((x) => x !== id));
  };

  const clearTeam = () => {
    setIsDemo(false);
    setSelected([]);
    setGearFor(null);
  };

  /** Launch the avatar from its card to the team slot it is about to fill. */
  const flyToSlot = (id: string, idx: number) => {
    const cardEl = cardRefs.current[id];
    const slotEl = slotRefs.current[idx];
    if (!cardEl || !slotEl) return;
    const a = cardEl.getBoundingClientRect();
    const b = slotEl.getBoundingClientRect();
    setFlyers((f) => [
      ...f,
      {
        key: ++flyKey.current,
        id,
        x: a.left,
        y: a.top,
        w: a.width,
        h: a.height,
        dx: b.left + b.width / 2 - (a.left + a.width / 2),
        dy: b.top + b.height / 2 - (a.top + a.height / 2),
      },
    ]);
  };

  /** Shared add/takeover feedback: slot pop, counter bump, card flash. */
  const pulse = (id: string, idx: number) => {
    setPopSlot(idx);
    setBump(true);
    setFlash(id);
    window.setTimeout(() => setBump(false), 500);
    window.setTimeout(() => setPopSlot(null), 500);
    window.setTimeout(() => setFlash(null), 500);
  };

  const add = (id: string) => {
    const idx = selected.length;
    flyToSlot(id, idx);
    setSelected((prev) => (prev.includes(id) ? prev : [...prev, id]));
    pulse(id, idx);
  };

  const toggle = (id: string) => {
    if (selected.includes(id)) {
      remove(id);
      return;
    }
    // A full team changes nothing: the only feedback is the 4/4 counter
    // flashing, loud enough to draw the eye to the bar. This also covers the
    // pre-filled example team, so a fifth pick never yanks the team away.
    if (selected.length >= MAX_TEAM) {
      setFullKey((k) => k + 1);
      setAnnounce(`Team is full (${MAX_TEAM}/${MAX_TEAM}). Remove a character to add another.`);
      window.setTimeout(() => setAnnounce(''), 2500);
      return;
    }
    add(id);
  };

  useEffect(() => setMounted(true), []);

  // The bar's height changes with the screen width; the filter sidebar needs it to stick directly underneath without overlap.
  useEffect(() => {
    const el = barRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setBarH(el.offsetHeight));
    ro.observe(el);
    setBarH(el.offsetHeight);
    return () => ro.disconnect();
  }, []);

  // Drive the native <dialog> from state so Escape, focus trapping and the
  // top layer all come from the browser.
  useEffect(() => {
    const d = gearDialog.current;
    if (!d) return;
    if (gearFor && !d.open) d.showModal();
    if (!gearFor && d.open) d.close();
  }, [gearFor]);

  const gearCharacter = gearFor ? CHARACTERS.find((c) => c.id === gearFor) : undefined;
  const gearConfig = gearCharacter ? configFor(gearCharacter) : undefined;
  const gearRow = gearFor ? rows.find((r) => r.character.id === gearFor) : undefined;

  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
      active
        ? 'border-forest-600 bg-forest-600/10 text-forest-700'
        : 'border-[var(--line)] text-[var(--muted)] hover:text-[var(--text)]'
    }`;

  return (
    <div className="relative">
      {/* ============ Sticky result bar ============ */}
      {/* One row, frosted, pinned to the very top, and only as wide as its
          content: a full-width bar left a gap of empty glass in the middle and
          covered roster cards on both sides of it for nothing. */}
      <div ref={barRef} className="sticky top-2 z-40">
        <div className="calc-bar mx-auto w-fit max-w-full rounded-2xl px-3 py-2 sm:px-4">
          <div className="flex items-center justify-between gap-3 sm:gap-6">
            {/* Left: the team total. Natural width from sm up — the bar is only
                as wide as its content, so letting this column flex would squeeze
                the DPS line onto a row of its own. */}
            <div className="min-w-0 flex-1 sm:flex-none">
              <p className="flex items-center gap-2 whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.18em] text-forest-600">
                Team damage
                {isDemo && (
                  <span className="hidden truncate rounded-full bg-forest-600/10 px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-forest-700 sm:inline">
                    Example team<span className="hidden lg:inline"> — Clear to start your own</span>
                  </span>
                )}
              </p>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                <span className="relative inline-block leading-none">
                  <span key={popKey} className="damage-pop damage-number tnum block text-xl sm:text-3xl">
                    {formatNumber(animatedTotal)}
                  </span>
                  <span key={`burst-${popKey}`} className="damage-burst" aria-hidden="true" />
                </span>
                {/* DPS and the phone-only Clear stay on one line, so the bar is
                    three short rows on a phone rather than four. */}
                <span className="flex items-baseline gap-2 whitespace-nowrap">
                  <span className="tnum text-[11px] font-medium text-[var(--muted)]">
                    {selected.length === 0 ? (
                      'Pick a character below to start'
                    ) : (
                      <>
                        {formatNumber(animatedDps)} DPS <span className="hidden opacity-70 sm:inline">(20s est.)</span>
                      </>
                    )}
                  </span>
                  {selected.length > 0 && (
                    <button
                      type="button"
                      onClick={clearTeam}
                      className="text-[11px] font-medium text-[var(--muted)] underline decoration-[var(--line)] underline-offset-2 transition-colors hover:text-pyro sm:hidden"
                    >
                      Clear
                    </button>
                  )}
                </span>
              </div>
            </div>

            {/* Right: count, clear, and the four slots with a Gear button each */}
            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              {/* The counter is the whole "team is full" feedback, so it shows on
                  every screen size. Keyed on fullKey so each rejected click
                  restarts the flash. */}
              <div className="text-center">
                <span
                  key={fullKey}
                  className={`tnum block text-base font-bold leading-none text-forest-600 sm:text-lg ${
                    fullKey > 0 ? 'counter-alert' : bump ? 'counter-pop' : ''
                  }`}
                >
                  {selected.length}/{MAX_TEAM}
                </span>
                <span className="mt-0.5 hidden text-[10px] uppercase tracking-wider text-[var(--muted)] sm:block">team</span>
              </div>
              {selected.length > 0 && (
                <button
                  type="button"
                  onClick={clearTeam}
                  className="hidden shrink-0 rounded-full border border-[var(--line)] bg-white/70 px-2.5 py-1 text-[11px] font-medium text-[var(--muted)] transition-colors hover:border-pyro/50 hover:text-pyro sm:inline-flex"
                >
                  Clear
                </button>
              )}
              <div className="flex gap-1.5 sm:gap-2">
                {Array.from({ length: MAX_TEAM }).map((_, i) => {
                  const id = selected[i];
                  const c = id ? CHARACTERS.find((x) => x.id === id) : undefined;
                  return (
                    <div key={i} className="flex flex-col items-center gap-1">
                      <button
                        ref={(el) => {
                          slotRefs.current[i] = el;
                        }}
                        type="button"
                        onClick={() => id && remove(id)}
                        title={c ? `${c.name} — click to remove` : 'Empty slot'}
                        aria-label={c ? `Remove ${c.name}` : `Empty team slot ${i + 1}`}
                        className={`relative h-9 w-9 shrink-0 overflow-hidden rounded-xl transition sm:h-10 sm:w-10 ${
                          c ? 'ring-1 ring-forest-400 hover:ring-2 hover:ring-pyro' : 'border border-dashed border-[var(--line)] bg-white/40'
                        }`}
                      >
                        {c ? (
                          <>
                            <span className={`absolute inset-0 bg-linear-to-b ${ELEMENT_BG[c.element] ?? ELEMENT_BG.physical}`} aria-hidden="true" />
                            <img
                              src={`/images/portraits/${c.id}.webp`}
                              alt=""
                              width="256"
                              height="256"
                              className={`absolute inset-0 h-full w-full object-cover ${popSlot === i ? 'slot-pop' : ''}`}
                            />
                            <ElementIcon el={c.element} className="absolute right-0.5 top-0.5 h-3.5 w-3.5" />
                          </>
                        ) : (
                          <span className="grid h-full w-full place-items-center text-sm text-[var(--muted)]">+</span>
                        )}
                      </button>
                      {/* Opens the level / weapon dialog. An invisible twin holds
                          the space on empty slots so the row never jumps. */}
                      {c ? (
                        <button
                          type="button"
                          onClick={() => setGearFor(c.id)}
                          className="gear-btn"
                          aria-label={`${c.name}: change level and weapon`}
                          aria-haspopup="dialog"
                        >
                          Gear
                        </button>
                      ) : (
                        <span className="gear-btn invisible" aria-hidden="true">
                          Gear
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ============ Filter sidebar + roster ============ */}
      <div className="mt-5 flex flex-col gap-4 md:flex-row md:items-start">
        {/* Element and weapon filters as two vertical columns, sticky just under
            the bar from tablet up. Phones have no room beside the grid, so
            there they lie flat as two rows above it. */}
        <nav
          aria-label="Filter characters"
          className="flex flex-col gap-2 md:sticky md:flex-row md:gap-3 md:self-start"
          style={{ top: barH + 20 }}
        >
          <div className="flex flex-wrap gap-1.5 md:flex-col md:flex-nowrap md:gap-2" role="group" aria-label="Element">
            <button
              type="button"
              onClick={() => setElementFilter('all')}
              aria-pressed={elementFilter === 'all'}
              title="All elements"
              className="element-tile h-9 w-9 text-[11px] font-bold text-[var(--text)] md:h-11 md:w-11"
            >
              All
            </button>
            {ELEMENTS.map((el) => (
              <button
                key={el}
                type="button"
                onClick={() => setElementFilter(el)}
                aria-pressed={elementFilter === el}
                title={ELEMENT_LABEL[el]}
                className="element-tile h-9 w-9 p-1 md:h-11 md:w-11 md:p-1.5"
              >
                <img
                  src={`/images/element-${el}.webp`}
                  alt={ELEMENT_LABEL[el]}
                  width="120"
                  height="120"
                  className="h-full w-full object-contain"
                  decoding="async"
                />
              </button>
            ))}
          </div>
          <div
            className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 md:mx-0 md:w-28 md:flex-col md:overflow-visible md:px-0 md:pb-0 [&>button]:shrink-0"
            role="group"
            aria-label="Weapon"
          >
            <button type="button" onClick={() => setWeaponFilter('all')} aria-pressed={weaponFilter === 'all'} className={`${chip(weaponFilter === 'all')} md:w-full md:text-left`}>
              All weapons
            </button>
            {WEAPON_TYPES.map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setWeaponFilter(w)}
                aria-pressed={weaponFilter === w}
                className={`${chip(weaponFilter === w)} md:w-full md:text-left`}
              >
                {w[0].toUpperCase() + w.slice(1)}
              </button>
            ))}
          </div>
        </nav>

        <div className="min-w-0 flex-1">
          {/* ============ Search + rarity ============ */}
          <div className="flex flex-wrap items-center gap-2.5">
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
                <button key={r} type="button" onClick={() => setRarityFilter(r)} aria-pressed={rarityFilter === r} className={chip(rarityFilter === r)}>
                  {r === 'all' ? 'All ★' : `${r}★`}
                </button>
              ))}
            </div>
            <span className="ml-auto text-sm text-[var(--muted)]">
              <span className="font-semibold text-[var(--text)]">{roster.length}</span> characters
            </span>
          </div>

          {/* ============ Enemy target ============ */}
          <div className="mt-3 flex flex-wrap items-center gap-2.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-forest-600">Enemy</span>
            <select
              value={customEnemy ? 'custom' : enemyId}
              onChange={(e) => {
                if (e.target.value === 'custom') {
                  setEnemyLevel(enemy.level);
                  setEnemyRes(enemy.resistances.default);
                  setCustomEnemy(true);
                } else {
                  setCustomEnemy(false);
                  setEnemyId(e.target.value);
                }
              }}
              className="h-8 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 text-sm text-[var(--text)]"
              aria-label="Enemy target"
            >
              {ENEMIES.map((en) => (
                <option key={en.id} value={en.id}>
                  {en.name} · Lv{en.level} · {Math.round(en.resistances.default * 100)}% RES
                </option>
              ))}
              <option value="custom">Custom target…</option>
            </select>
            {customEnemy && (
              <>
                <label className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
                  Level
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={enemyLevel}
                    onChange={(e) => setEnemyLevel(Math.min(100, Math.max(1, parseInt(e.target.value, 10) || 90)))}
                    className="h-8 w-16 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 text-right text-sm text-[var(--text)]"
                  />
                </label>
                <label className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
                  RES %
                  <input
                    type="number"
                    value={Math.round(enemyRes * 100)}
                    onChange={(e) => setEnemyRes((parseFloat(e.target.value) || 0) / 100)}
                    className="h-8 w-16 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 text-right text-sm text-[var(--text)]"
                  />
                </label>
              </>
            )}
            <span className="ml-auto hidden text-[11px] text-[var(--muted)] sm:inline">
              Sets the DEF &amp; RES multipliers for every character
            </span>
          </div>

          {/* ============ Roster grid ============ */}
          {roster.length === 0 ? (
            <p className="panel mt-5 py-16 text-center text-sm text-[var(--muted)]">No characters match those filters.</p>
          ) : (
            <div className="mt-5 space-y-6">
              {groups.map((g) => (
                <div key={g.element}>
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
                    <ElementIcon el={g.element} className="h-4 w-4" />
                    {ELEMENT_LABEL[g.element]}
                    <span className="text-xs font-normal text-[var(--muted)]">({g.rows.length})</span>
                  </h3>
                  <div className="mt-2.5 grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}>
                    {g.rows.map((c) => {
                      const isSelected = selected.includes(c.id);
                      return (
                        <button
                          key={c.id}
                          ref={(el) => {
                            cardRefs.current[c.id] = el;
                          }}
                          type="button"
                          onClick={() => toggle(c.id)}
                          aria-pressed={isSelected}
                          title={c.name}
                          className={`group relative block aspect-square w-full overflow-hidden rounded-xl ring-1 transition-all ${
                            isSelected ? 'ring-2 ring-forest-500' : 'ring-[var(--line)] hover:ring-forest-400'
                          } ${flash === c.id ? 'card-flash-add' : ''}`}
                        >
                          <span className={`absolute inset-0 bg-linear-to-b ${ELEMENT_BG[c.element] ?? ELEMENT_BG.physical}`} aria-hidden="true" />
                          <img
                            src={`/images/portraits/${c.id}.webp`}
                            alt={`${c.name} portrait`}
                            width="256"
                            height="256"
                            className={`absolute inset-0 h-full w-full object-cover transition-all duration-300 ${
                              isSelected ? 'scale-105 opacity-50 grayscale-[0.75]' : 'opacity-100 group-hover:scale-110'
                            }`}
                            loading="lazy"
                            decoding="async"
                          />
                          <ElementIcon el={c.element} className="absolute right-2 top-2 h-5 w-5" />
                          {c.unreleased && (
                            <span
                              className="absolute left-1.5 bottom-11 rounded-full bg-amber-500/95 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white shadow"
                              title="Not in the live game yet — stats are unverified"
                            >
                              Upcoming
                            </span>
                          )}
                          {isSelected && (
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
      </div>

      {/* ============ Team synergy (hero style, compact) ============ */}
      {selected.length > 0 && (
        <section className="relative mt-6 overflow-hidden rounded-2xl border border-[var(--line)]">
          <div className="absolute inset-0 bg-linear-to-br from-forest-500/[0.08] via-transparent to-forest-200/[0.45]" aria-hidden="true"></div>
          <div className="relative px-5 py-6 text-center md:px-8 md:py-7">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-forest-600">Team synergy</p>
            <h2 className="mt-1.5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-2xl font-semibold tracking-tight text-[var(--text)] md:text-3xl">
              {synergy.resonances.length > 0 ? (
                synergy.resonances.map((el) => (
                  <span key={el} className="inline-flex items-center gap-2" title={RESONANCE[el].effect}>
                    <ElementIcon el={el} className="h-7 w-7" />
                    {RESONANCE[el].name}
                  </span>
                ))
              ) : (
                <span className="text-[var(--muted)]">No resonance yet</span>
              )}
            </h2>

            {resonanceBreakdown.length > 0 ? (
              <div className="mt-5 flex flex-wrap justify-center gap-2.5 border-t border-[var(--line)] pt-5">
                {resonanceBreakdown.map((b) => {
                  const av = sourceAvatar(b.id);
                  const hasDamage = Math.max(0, b.delta) >= 0.5;
                  return (
                    <div
                      key={b.id}
                      className="flex items-center gap-2.5 rounded-xl border border-[var(--line)] bg-white/70 px-3 py-2"
                    >
                      {av?.kind === 'char' ? (
                        <img
                          src={`/images/portraits/${av.charId}.webp`}
                          alt=""
                          width="128"
                          height="128"
                          className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-[var(--line)]"
                          loading="lazy"
                          decoding="async"
                        />
                      ) : av?.kind === 'element' ? (
                        <ElementIcon el={av.element} className="h-9 w-9 shrink-0" />
                      ) : null}
                      <span className="text-left">
                        {av?.kind !== 'element' && (
                          <span className="block text-[10px] font-medium uppercase tracking-wide text-[var(--muted)]">
                            {b.label}
                          </span>
                        )}
                        <span className="block text-[11px] font-medium leading-tight text-forest-700">{b.effect}</span>
                        {hasDamage && (
                          <span className="tnum">
                            <span className="damage-number-sm text-xl">+{formatNumber(b.delta)}</span>
                            <span className="ml-1 text-[10px] font-semibold text-forest-600">
                              {total > 0 ? `${Math.round((Math.max(0, b.delta) / total) * 100)}%` : '0%'}
                            </span>
                          </span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="mt-5 border-t border-[var(--line)] pt-5 text-xs text-[var(--muted)]">
                Line up two of the same element to unlock a resonance.
              </p>
            )}
          </div>
        </section>
      )}

      {/* ============ Level / weapon dialog ============ */}
      {/* Opened by the Gear button under a team slot.
          A native <dialog> gives Escape-to-close, focus trapping and the top
          layer for free; clicking the backdrop closes it too. */}
      <dialog
        ref={gearDialog}
        className="gear-dialog"
        aria-labelledby="gear-dialog-title"
        onClose={() => setGearFor(null)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setGearFor(null);
        }}
      >
        {gearCharacter && gearConfig && (
          <div className="p-5">
            <div className="flex items-center gap-3">
              <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl ring-1 ring-[var(--line)]">
                <span className={`absolute inset-0 bg-linear-to-b ${ELEMENT_BG[gearCharacter.element] ?? ELEMENT_BG.physical}`} aria-hidden="true" />
                <img src={`/images/portraits/${gearCharacter.id}.webp`} alt="" width="256" height="256" className="absolute inset-0 h-full w-full object-cover" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 id="gear-dialog-title" className="flex items-center gap-1.5 truncate text-base font-semibold text-[var(--text)]">
                  <ElementIcon el={gearCharacter.element} className="h-4 w-4" />
                  {gearCharacter.name}
                </h2>
                <p className="text-xs text-[var(--muted)]">Level and weapon · no artifacts</p>
              </div>
              <div className="shrink-0 text-right">
                <span className="damage-number-sm tnum block text-lg font-semibold leading-none">
                  {gearRow ? formatNumber(gearRow.result.expected + gearRow.result.transformative) : '—'}
                </span>
                <span className="text-[10px] uppercase tracking-wider text-[var(--muted)]">damage</span>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <label className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium text-[var(--muted)]">Level</span>
                <input
                  type="number"
                  min={1}
                  max={90}
                  value={gearConfig.level}
                  onChange={(e) =>
                    updateConfig(gearCharacter, { level: Math.min(90, Math.max(1, parseInt(e.target.value, 10) || 90)) })
                  }
                  className="w-24 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-right text-[var(--text)]"
                />
              </label>
              <div className="text-sm">
                <span className="font-medium text-[var(--muted)]">Weapon</span>
                <div className="mt-1.5 max-h-72 overflow-y-auto rounded-lg border border-[var(--line)] bg-[var(--surface)]">
                  {weaponsForType(gearCharacter.weaponType).map((w) => {
                    const active = w.id === gearConfig.weaponId;
                    return (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => updateConfig(gearCharacter, { weaponId: w.id })}
                        aria-pressed={active}
                        className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors ${
                          active ? 'bg-forest-500/12' : 'hover:bg-[var(--soft)]'
                        }`}
                      >
                        <img
                          src={`/images/weapons/${w.id}.webp`}
                          alt=""
                          width="64"
                          height="64"
                          className="h-10 w-10 shrink-0 rounded-md object-contain"
                          loading="lazy"
                          decoding="async"
                          onError={(e) => {
                            e.currentTarget.style.visibility = 'hidden';
                          }}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-[var(--text)]">{w.name}</span>
                          <span className="block text-[10px] text-[var(--muted)]">
                            {w.rarity}★ · {formatSecondary(w.secondary.type, w.secondary.value)}
                          </span>
                        </span>
                        {active && <span className="shrink-0 text-forest-600" aria-hidden="true">✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                autoFocus
                onClick={() => setGearFor(null)}
                className="rounded-full bg-forest-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-forest-700"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </dialog>

      {/* ============ Flying avatars (add-to-cart) ============ */}
      {/* Rendered into <body>: the flyer is position:fixed and positioned from
          viewport coordinates, and any transformed or backdrop-filtered ancestor
          becomes its containing block and lands it in the wrong place. A portal
          keeps the coordinates meaning what they say, whatever the page wraps
          this component in. */}
      {mounted &&
        flyers.length > 0 &&
        createPortal(
          <>
            {flyers.map((f) => (
              <span
                key={f.key}
                className="flyer"
                style={{
                  left: f.x,
                  top: f.y,
                  width: f.w,
                  height: f.h,
                  ['--dx' as string]: `${f.dx}px`,
                  ['--dy' as string]: `${f.dy}px`,
                } as CSSProperties}
                onAnimationEnd={() => setFlyers((list) => list.filter((x) => x.key !== f.key))}
                aria-hidden="true"
              >
                <img src={`/images/portraits/${f.id}.webp`} alt="" className="h-full w-full rounded-xl object-cover shadow-2xl" />
              </span>
            ))}
          </>,
          document.body,
        )}

      {/* Screen-reader narration for the live-updating figures and swap mode. */}
      <p role="status" aria-live="polite" className="sr-only">
        {announce || `Team of ${selected.length}. Total damage ${formatNumber(total)}.`}
      </p>
    </div>
  );
}
