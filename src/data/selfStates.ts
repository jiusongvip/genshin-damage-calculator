// ============================================================================
// Character self-states — "I'm in my Skill / Burst".
//
// Hu Tao's damage happens inside Paramita Papilio, Raiden's inside Musou
// Isshin; without the state the calculator priced them as if they never
// pressed E. These are toggles the reader declares, like party buffs: we never
// guess uptime. Numbers come from genshin-db (data/generated/stateParams.ts)
// at the effective talent level, never typed in here.
//
// Iron rule as everywhere: only self-buffs that are numeric and hold for the
// whole state. Second batch, not modelled yet (they change the multiplier
// structure or ramp over time): Yoimiya E, Neuvillette A1 stacks, Arlecchino's
// Bond of Life, Wanderer E.
// ============================================================================

import type { ElementType } from '../lib/damage';
import type { TalentGroup, TalentRow } from './generated/talents';
import { BURST_LABEL_PARTS, STATE_PARAMS } from './generated/stateParams';
import type { SelfEffect } from './constellations';

type Levels = { normal: number; skill: number; burst: number };

export interface SelfState {
  id: string;
  label: string;
  /** One line under the toggle: what it does, where the number comes from. */
  note: (levels: Levels, input: number) => string;
  /** Physical Normal / Charged / Plunging hits become this element. */
  infusion?: ElementType;
  /** Buffs while the state is on; `only` scopes them like constellation effects. */
  effects?: (levels: Levels, input: number) => SelfEffect[];
  /** Talent-multiplier added to one damage row (Raiden's Resolve). */
  rowBonus?: (row: TalentRow, levels: Levels, input: number) => number;
  /** A number the reader declares alongside the toggle (Resolve stacks). */
  input?: { label: string; min: number; max: number; default: number };
}

const param = (charId: string, key: string, level: number): number => {
  const series = STATE_PARAMS[charId]?.[key];
  if (!series) throw new Error(`stateParams: ${charId}.${key} missing — run npm run gen:state-params`);
  return series[Math.min(Math.max(level, 1), 15) - 1];
};

const pct = (v: number, digits = 1) => `${(v * 100).toFixed(digits)}%`;

export const SELF_STATES: Record<string, SelfState[]> = {
  'hu-tao': [
    {
      id: 'hu-tao-e',
      label: 'Paramita Papilio (Skill active)',
      infusion: 'pyro',
      effects: (lv) => [{ atkFromHPCapped: param('hu-tao', 'atkFromHP', lv.skill), atkFromHPCappedMax: 4 }],
      note: (lv) =>
        `ATK + ${pct(param('hu-tao', 'atkFromHP', lv.skill), 2)} of Max HP (capped at 400% of Base ATK); attacks deal Pyro DMG.`,
    },
  ],
  'raiden-shogun': [
    {
      id: 'raiden-e',
      label: 'Eye of Stormy Judgment (Skill active)',
      effects: (lv) => [
        {
          burstDmgBonus:
            param('raiden-shogun', 'burstBonusPerEnergy', lv.skill) * param('raiden-shogun', 'burstEnergyCost', lv.burst),
        },
      ],
      note: (lv) =>
        `Burst DMG + ${pct(param('raiden-shogun', 'burstBonusPerEnergy', lv.skill), 2)} per Energy × ${param('raiden-shogun', 'burstEnergyCost', lv.burst)} = ${pct(param('raiden-shogun', 'burstBonusPerEnergy', lv.skill) * param('raiden-shogun', 'burstEnergyCost', lv.burst))}.`,
    },
    {
      id: 'raiden-q',
      label: 'Resolve stacks consumed by the Burst',
      input: { label: 'Resolve stacks', min: 0, max: 60, default: 60 },
      rowBonus: (row, lv, stacks) => {
        if (!row.isDamage || row.element !== 'electro') return 0;
        if (row.group === 'burst' && /Musou no Hitotachi/.test(row.label))
          return stacks * param('raiden-shogun', 'resolveInitial', lv.burst);
        // Musou Isshin's Normal / Charged hits sit in the Burst group; its
        // plunges are the Electro rows of the Plunge group.
        if (row.group === 'burst' || row.group === 'plunge') {
          const parts = row.group === 'burst' ? BURST_LABEL_PARTS['raiden-shogun']?.[row.label] ?? 1 : 1;
          return stacks * parts * Math.max(1, row.hits) * param('raiden-shogun', 'resolvePerHit', lv.burst);
        }
        return 0;
      },
      note: (lv, stacks) =>
        `Musou no Hitotachi + ${pct(stacks * param('raiden-shogun', 'resolveInitial', lv.burst))}, each Musou Isshin hit + ${pct(stacks * param('raiden-shogun', 'resolvePerHit', lv.burst), 2)} ATK at ${stacks} stacks.`,
    },
  ],
  diluc: [
    {
      id: 'diluc-q',
      label: 'Dawn infusion (Burst active)',
      infusion: 'pyro',
      // A4 Blessing of Phoenix: +20% Pyro DMG while the Dawn infusion lasts.
      effects: () => [{ dmgBonus: 0.2, only: { element: 'pyro' } }],
      note: () => 'Attacks deal Pyro DMG; Blessing of Phoenix (A4) adds 20% Pyro DMG while it lasts.',
    },
  ],
  ayaka: [
    {
      id: 'ayaka-sprint',
      label: 'Kamisato Art: Senho (after the sprint)',
      infusion: 'cryo',
      note: () => 'Attacks deal Cryo DMG for a short while after the alternate sprint.',
    },
  ],
  noelle: [
    {
      id: 'noelle-q',
      label: 'Sweeping Time (Burst active)',
      infusion: 'geo',
      effects: (lv) => [{ atkFromDEF: param('noelle', 'atkFromDEF', lv.burst) }],
      note: (lv) => `ATK + ${pct(param('noelle', 'atkFromDEF', lv.burst), 0)} of DEF; attacks deal Geo DMG.`,
    },
  ],
};

export function selfStatesFor(charId: string): SelfState[] {
  return SELF_STATES[charId] ?? [];
}

/** The states a draft has switched on, with the value of their input. */
export function activeStates(charId: string, on: string[], inputs: Record<string, number>) {
  return selfStatesFor(charId)
    .filter((s) => on.includes(s.id))
    .map((s) => ({ state: s, input: inputs[s.id] ?? s.input?.default ?? 0 }));
}

const INFUSABLE: TalentGroup[] = ['normal', 'charged', 'plunge'];

/** A hit's element once active infusions are applied. */
export function infusedElement(
  charId: string,
  on: string[],
  group: TalentGroup,
  element: ElementType,
): ElementType {
  if (element !== 'physical' || !INFUSABLE.includes(group)) return element;
  const infusing = selfStatesFor(charId).find((s) => s.infusion && on.includes(s.id));
  return infusing?.infusion ?? element;
}

/** Every buff the active states grant (scoped entries still carry `only`). */
export function stateEffects(charId: string, on: string[], inputs: Record<string, number>, levels: Levels): SelfEffect[] {
  return activeStates(charId, on, inputs).flatMap(({ state, input }) => state.effects?.(levels, input) ?? []);
}

/** Multiplier the active states add to one row. */
export function stateRowBonus(
  charId: string,
  on: string[],
  inputs: Record<string, number>,
  levels: Levels,
  row: TalentRow,
): number {
  return activeStates(charId, on, inputs).reduce((s, { state, input }) => s + (state.rowBonus?.(row, levels, input) ?? 0), 0);
}
