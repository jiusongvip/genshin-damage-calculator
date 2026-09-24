import { describe, expect, it } from 'vitest';
import { DEFAULT_PARTY, bennettAtkBonusRatio, resolvePartyBuffs } from './partyBuffs';
import type { PartyState } from './partyBuffs';

/**
 * Party buffs are the last big reason our bare numbers read low versus paimon.
 * These pin the pure resolver: each switch contributes exactly its documented
 * number, and the swirl-only entries contribute 0 to a non-matching element —
 * the failure mode a global fold would cause (a Physical hit eating Pyro DMG).
 */

const on = (patch: Partial<PartyState>): PartyState => ({ ...DEFAULT_PARTY, ...patch });

describe('resolvePartyBuffs', () => {
  it('is inert with nothing declared', () => {
    expect(resolvePartyBuffs(DEFAULT_PARTY, 'pyro')).toEqual({});
  });

  it('Bennett Q gives flat ATK = base × the burst ATK Bonus Ratio (lvl10 = 100.8%)', () => {
    expect(bennettAtkBonusRatio(10)).toBeCloseTo(1.008, 6);
    // 865 base ATK (Lv90 Bennett + a 674 sword) × 1.008 = 871.92, applied to
    // any element — it is a raw ATK buff, not an element-conditional one.
    expect(resolvePartyBuffs(on({ bennett: 1, bennettBase: 865, bennettLevel: 10 }), 'cryo').flatATK).toBeCloseTo(871.92, 2);
  });

  it('Bennett ratio tracks the talent level, not a hardcode', () => {
    expect(bennettAtkBonusRatio(13)).toBeCloseTo(1.19, 6);
    const at13 = resolvePartyBuffs(on({ bennett: 1, bennettBase: 1000, bennettLevel: 13 }), 'pyro').flatATK!;
    expect(at13).toBeCloseTo(1190, 1);
  });

  it('Kazuha A4: 0.04% elemental DMG per EM, only on the swirled element', () => {
    const p = on({ kazuha: 1, kazuhaEM: 800, partyElement: 'pyro' });
    expect(resolvePartyBuffs(p, 'pyro').dmgBonus).toBeCloseTo(0.32, 6);
    expect(resolvePartyBuffs(p, 'hydro').dmgBonus ?? 0).toBe(0);
  });

  it('Viridescent Venerer: -40% RES to the swirled element only', () => {
    const p = on({ viridescent: 1, partyElement: 'electro' });
    expect(resolvePartyBuffs(p, 'electro').resShred).toBeCloseTo(0.4, 6);
    expect(resolvePartyBuffs(p, 'pyro').resShred ?? 0).toBe(0);
  });

  it('Zhongli: -20% RES to every element including Physical', () => {
    const p = on({ zhongli: 1 });
    expect(resolvePartyBuffs(p, 'pyro').resShred).toBeCloseTo(0.2, 6);
    expect(resolvePartyBuffs(p, 'physical').resShred).toBeCloseTo(0.2, 6);
  });

  it('stacks Zhongli + VV on the swirled element', () => {
    const p = on({ zhongli: 1, viridescent: 1, partyElement: 'anemo' });
    expect(resolvePartyBuffs(p, 'anemo').resShred).toBeCloseTo(0.6, 6);
  });

  it('Noblesse Oblige and the Pyro / Hydro resonances are element-independent', () => {
    expect(resolvePartyBuffs(on({ noblesse: 1 }), 'hydro').atkPercent).toBeCloseTo(0.2, 6);
    expect(resolvePartyBuffs(on({ pyroResonance: 1 }), 'hydro').atkPercent).toBeCloseTo(0.25, 6);
    expect(resolvePartyBuffs(on({ hydroResonance: 1 }), 'pyro').hpPercent).toBeCloseTo(0.25, 6);
  });

  it('atk% sources add together', () => {
    const p = on({ noblesse: 1, pyroResonance: 1 });
    expect(resolvePartyBuffs(p, 'pyro').atkPercent).toBeCloseTo(0.45, 6);
  });
});

describe('Bennett C1', () => {
  it('adds 20% of the base ATK to the ratio (paimon: 865 at Burst 10 -> +1045 ATK)', () => {
    const buff = resolvePartyBuffs({ ...DEFAULT_PARTY, bennett: 1, bennettBase: 865, bennettLevel: 10, bennettC1: 1 }, 'pyro');
    expect(buff.flatATK).toBeCloseTo(865 * 1.208, 6);
    expect(Math.round(buff.flatATK!)).toBe(1045);
  });
});
