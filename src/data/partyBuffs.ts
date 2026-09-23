// ============================================================================
// Party buffs (DESIGN-5 M3).
//
// These are the buff a *teammate* brings — Bennett's burst, Kazuha's swirl
// bonus, Viridescent Venerer's RES shred. Following the iron rule, we model
// only effects that are self-contained, unconditional and clearly numeric, and
// only ever when the user declares them ("I have Bennett's burst up"). We never
// guess who is in the party or a buff's uptime.
//
// Element-specific entries (Kazuha, VV) are resolved per damage row, exactly
// like artifact set bonuses — a Physical hit must not eat a Pyro DMG bonus.
// ============================================================================

import type { BuffState, ElementType } from '../lib/damage';
import { talentRowsFor } from './generated/talents';

/**
 * The declared party buffs. Every count field is 0/1 (off/on) so it serialises
 * to the URL and localStorage without a bespoke format. Kept flat and numeric
 * on purpose — see the (de)serialisation in calculator/draft.ts.
 */
export interface PartyState {
  /** Bennett "Fantastic Voyage" flat ATK = base ATK × ATK Bonus Ratio. */
  bennett: number;
  bennettBase: number;
  bennettLevel: number;
  /** Kaedehara Kazuha A4: EM × 0.04% elemental DMG to the swirled element. */
  kazuha: number;
  kazuhaEM: number;
  /** Viridescent Venerer 4pc: -40% RES to the swirled element. */
  viridescent: number;
  /** The element Kazuha / VV were swirled on. */
  partyElement: ElementType;
  /** Zhongli's Dominus Legion: -20% to ALL elemental + Physical RES. */
  zhongli: number;
  /** Noblesse Oblige 4pc (on a teammate): +20% ATK. */
  noblesse: number;
  /** Elemental Resonance — Pyro: +25% ATK. */
  pyroResonance: number;
  /** Elemental Resonance — Hydro: +25% HP. */
  hydroResonance: number;
}

/** Everything off: a zero-input panel's numbers are unchanged by this feature. */
export const DEFAULT_PARTY: PartyState = {
  bennett: 0,
  bennettBase: 865, // Lv90 Bennett (191 base ATK) + a 674-base-ATK sword
  bennettLevel: 10,
  kazuha: 0,
  kazuhaEM: 800,
  viridescent: 0,
  partyElement: 'pyro',
  zhongli: 0,
  noblesse: 0,
  pyroResonance: 0,
  hydroResonance: 0,
};

/** Bennett's burst ATK ratio at a talent level, read live from the talent table. */
export function bennettAtkBonusRatio(level: number): number {
  const row = (talentRowsFor('bennett') ?? []).find((r) => r.label === 'ATK Bonus Ratio');
  if (!row) return 0;
  const lv = Math.min(15, Math.max(1, Math.round(level)));
  return row.values[lv - 1] ?? 0;
}

/**
 * Fold the declared party buffs into a BuffState patch for one damage row.
 * `element` is that row's element, so the swirl-only entries contribute 0 to
 * every other row (mirrors resolveSetBuffs).
 */
export function resolvePartyBuffs(party: PartyState, element: ElementType): Partial<BuffState> {
  const out: Partial<BuffState> = {};
  if (party.bennett) out.flatATK = (out.flatATK ?? 0) + party.bennettBase * bennettAtkBonusRatio(party.bennettLevel);
  if (party.noblesse) out.atkPercent = (out.atkPercent ?? 0) + 0.2;
  if (party.pyroResonance) out.atkPercent = (out.atkPercent ?? 0) + 0.25;
  if (party.hydroResonance) out.hpPercent = (out.hpPercent ?? 0) + 0.25;
  if (party.zhongli) out.resShred = (out.resShred ?? 0) + 0.2; // all elements, Physical included
  if (element === party.partyElement) {
    if (party.kazuha) out.dmgBonus = (out.dmgBonus ?? 0) + party.kazuhaEM * 0.0004;
    if (party.viridescent) out.resShred = (out.resShred ?? 0) + 0.4;
  }
  return out;
}
