import { describe, expect, it } from 'vitest';
import { addBuffs, computeDamage } from './damage';
import type { ElementType, ScalingStat } from './damage';
import { CHARACTERS } from '../data/characters';
import { getWeapon } from '../data/weapons';
import { DEFAULT_BUFFS, NO_ARTIFACTS } from '../data/presets';
import { talentRowsFor } from '../data/generated/talents';

/**
 * Cross-check against damage.paimon.app (the reference calculator we mirror).
 *
 * The competitor's Klee page was read on 2026-09-20 with this panel:
 *   level 90 · talents 9 · Lost Prayer R1 (0 stacks) · enemy Lv100 / 10% RES
 *   ATK 1888 · CRIT 68.1% / 172.2% · Pyro DMG 90.4%
 *   Charged Attack DMG +50% · Vaporize/Melt +15% · Overloaded/Burning +40%
 *
 * We rebuild that exact panel on our engine and compare each Normal hit. The
 * only modelled difference is the ascension stat, which our level curve stores
 * rounded (0.29) versus the panel's 0.288 — a ~0.1% gap, inside tolerance.
 */

const klee = CHARACTERS.find((c) => c.id === 'klee')!;
const weapon = getWeapon('lost-prayer')!;
const enemy = { id: 'paimon-ref', name: 'paimon.app reference', level: 100, resistances: { default: 0.1 } };

const whiteboard = computeDamage({
  character: klee,
  weapon,
  artifacts: NO_ARTIFACTS,
  buffs: DEFAULT_BUFFS,
  enemy,
  characterLevel: 90,
  amplified: 'none',
  transformative: 'none',
});

const paimonBuffs = addBuffs(DEFAULT_BUFFS, {
  flatATK: 1888 - whiteboard.totalATK,
  critRate: 0.681 - whiteboard.critRate,
  critDMG: 1.722 - whiteboard.critDMG,
  dmgBonus: 0.904 - whiteboard.dmgBonus,
  caDmgBonus: 0.5,
  // Crimson Witch only reaches these reactions — not Shatter (see below).
  reactionDmg: { vaporize: 0.15, melt: 0.15, overload: 0.4, burning: 0.4, burgeon: 0.4 },
});

const normals = talentRowsFor('klee')!.filter((r) => r.isDamage && r.group === 'normal');
const rowByLabel = (label: string) => normals.find((r) => r.label === label)!;

const hitAtLevel9 = (label: string) => {
  const row = rowByLabel(label);
  return computeDamage({
    character: klee,
    weapon,
    artifacts: NO_ARTIFACTS,
    buffs: paimonBuffs,
    enemy,
    characterLevel: 90,
    attackType: 'normal',
    skillMultiplier: row.values[8], // talent level 9
    element: row.element as ElementType,
    scaling: row.scaling as ScalingStat,
    amplified: 'none',
    transformative: 'none',
  });
};

type Trio = [nonCrit: number, crit: number, average: number];
const paimon: Record<string, Trio> = {
  '1-Hit DMG': [1934, 5263, 4200],
  '2-Hit DMG': [1672, 4551, 3632],
  '3-Hit DMG': [2409, 6558, 5234],
};

describe('cross-check — Klee vs damage.paimon.app', () => {
  it('reproduces the panel it was configured with', () => {
    const r = hitAtLevel9('1-Hit DMG');
    expect(Math.round(r.totalATK)).toBe(1888);
    expect(r.critRate).toBeCloseTo(0.681, 3);
    expect(r.critDMG).toBeCloseTo(1.722, 3);
    expect(r.dmgBonus).toBeCloseTo(0.904, 3);
  });

  for (const [label, [nc, cr, avg]] of Object.entries(paimon)) {
    it(`${label} matches within 0.5%`, () => {
      const r = hitAtLevel9(label);
      expect(Math.abs(r.nonCrit - nc) / nc).toBeLessThan(0.005);
      expect(Math.abs(r.critHit - cr) / cr).toBeLessThan(0.005);
      expect(Math.abs(r.expected - avg) / avg).toBeLessThan(0.005);
    });
  }

  it('Normal Attack Total DMG matches within 0.5%', () => {
    const total = ['1-Hit DMG', '2-Hit DMG', '3-Hit DMG'].map(hitAtLevel9);
    const sum = (k: 'nonCrit' | 'critHit' | 'expected') => total.reduce((a, r) => a + r[k], 0);
    expect(Math.abs(sum('nonCrit') - 6015) / 6015).toBeLessThan(0.005);
    expect(Math.abs(sum('critHit') - 16373) / 16373).toBeLessThan(0.005);
    expect(Math.abs(sum('expected') - 13066) / 13066).toBeLessThan(0.005);
  });
});

/**
 * Transformative reaction values from the same panel. Crimson Witch's +40%
 * reaches Overloaded / Burning / Burgeon but not Shatter, which is why Shatter
 * is much lower on both sides. Our level coefficient (KQM table, 1446.85 at 90)
 * runs ~1.6% above the competitor's, so we assert a 2% tolerance.
 */
describe('cross-check — transformative reactions vs damage.paimon.app', () => {
  const reference: Record<string, number> = { overload: 4933, shatter: 3844, burgeon: 5382, burning: 448 };

  const transformValue = (reaction: string) =>
    computeDamage({
      character: klee,
      weapon,
      artifacts: NO_ARTIFACTS,
      buffs: paimonBuffs,
      enemy,
      characterLevel: 90,
      amplified: 'none',
      transformative: reaction as never,
    }).transformative;

  for (const [reaction, expected] of Object.entries(reference)) {
    it(`${reaction} matches within 2%`, () => {
      const value = transformValue(reaction);
      expect(Math.abs(value - expected) / expected).toBeLessThan(0.02);
    });
  }

  it('Shatter does not receive the Crimson Witch reaction bonus', () => {
    const withBonus = computeDamage({
      character: klee,
      weapon,
      artifacts: NO_ARTIFACTS,
      buffs: addBuffs(paimonBuffs, { reactionDmg: { shatter: 0.4 } }),
      enemy,
      characterLevel: 90,
      amplified: 'none',
      transformative: 'shatter',
    }).transformative;
    expect(withBonus / transformValue('shatter')).toBeGreaterThan(1.3);
  });
});
