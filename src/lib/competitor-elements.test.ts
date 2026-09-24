import { describe, expect, it } from 'vitest';
import { addBuffs, computeDamage } from './damage';
import type { ElementType, ScalingStat } from './damage';
import { CHARACTERS } from '../data/characters';
import { getWeapon } from '../data/weapons';
import { DEFAULT_BUFFS, NO_ARTIFACTS } from '../data/presets';
import { talentRowsFor } from '../data/generated/talents';
import { rowAttackType } from '../components/calculator/constants';

/**
 * Brief #6 Task 1 — the rows the section element rule moves, checked against
 * damage.paimon.app hit by hit. See competitor.test.ts for the Klee / Hu Tao /
 * Raiden precedent: the equipment behind the competitor's numbers is theirs and
 * we absorb it into flat stat buffs, so what can still go wrong on our side is
 * a row's multiplier, its hit count and — the point of this file — its element.
 *
 * Read on 2026-09-24, one fresh page load per character so every panel is that
 * character's own default rather than whatever the previous pick left behind.
 * All three are Lv90 with talents 9/9/9 against the site's default enemy
 * (Lv100 / 10% RES, DEF multiplier 48.7%).
 */

type Trio = [nonCrit: number, crit: number, average: number];

type Panel = {
  charId: string;
  atk: number;
  critRate: number;
  critDMG: number;
  /** Elemental / Physical DMG bonus the panel carries, keyed by the element it reaches. */
  dmg: Partial<Record<ElementType, number>>;
};

const enemy = { id: 'paimon-ref', name: 'paimon.app reference', level: 100, resistances: { default: 0.1 } };

function paimonPanel(panel: Panel) {
  const character = CHARACTERS.find((c) => c.id === panel.charId)!;
  const weapon = getWeapon(character.bestWeapon)!;
  const wb = computeDamage({ character, weapon, artifacts: NO_ARTIFACTS, buffs: DEFAULT_BUFFS, enemy, characterLevel: 90, amplified: 'none', transformative: 'none' });
  const buffs = addBuffs(DEFAULT_BUFFS, {
    flatATK: panel.atk - wb.totalATK,
    critRate: panel.critRate - wb.critRate,
    critDMG: panel.critDMG - wb.critDMG,
  });
  const rows = talentRowsFor(panel.charId)!.filter((r) => r.isDamage);

  /** One paimon row, priced with the DMG bonus the element it lands on carries. */
  const hit = (label: string, over: { element?: ElementType; multMul?: number } = {}) => {
    const row = rows.find((r) => r.label === label && r.group !== 'skill' && r.group !== 'burst')!;
    const element = over.element ?? (row.element as ElementType);
    return computeDamage({
      character,
      weapon,
      artifacts: NO_ARTIFACTS,
      buffs: addBuffs(buffs, { dmgBonus: (panel.dmg[element] ?? 0) - wb.dmgBonus }),
      enemy,
      characterLevel: 90,
      attackType: rowAttackType(panel.charId, row),
      skillMultiplier: row.values[8] * Math.max(1, row.hits) * (over.multMul ?? 1),
      element,
      scaling: row.scaling as ScalingStat,
      amplified: 'none',
      transformative: 'none',
    });
  };
  const row = (label: string) => rows.find((r) => r.label === label)!;
  return { wb, buffs, hit, row };
}

const check = (r: { nonCrit: number; critHit: number; expected: number }, [nonCrit, crit, avg]: Trio) => {
  expect(Math.abs(r.nonCrit - nonCrit) / nonCrit).toBeLessThan(0.005);
  expect(Math.abs(r.critHit - crit) / crit).toBeLessThan(0.005);
  expect(Math.abs(r.expected - avg) / avg).toBeLessThan(0.005);
};

// Ganyu's default build carries a 20% Cryo DMG bonus and no Physical bonus, so
// her combo is the sharpest element test available: price the Normal rows as
// Cryo — the bug Task 1 fixes — and every one of them comes out 20% high.
const ganyu = paimonPanel({ charId: 'ganyu', atk: 886, critRate: 0.35, critDMG: 2.106, dmg: { cryo: 0.2 } });

describe('cross-check — Ganyu: Physical combo, Cryo aimed shots', () => {
  const rows: [string, Trio][] = [
    ['1-Hit DMG', [226, 703, 393]],
    ['2-Hit DMG', [254, 789, 441]],
    ['3-Hit DMG', [325, 1008, 564]],
    ['4-Hit DMG', [325, 1008, 564]],
    ['5-Hit DMG', [344, 1069, 598]],
    ['6-Hit DMG', [411, 1277, 714]],
    ['Aimed Shot', [313, 972, 544]],
    ['Plunge DMG', [405, 1259, 704]],
    ['Low Plunge DMG', [811, 2518, 1408]],
    ['High Plunge DMG', [1013, 3145, 1759]],
    // The one Cryo row whose Average is not moved by a conditional crit bonus.
    ['Aimed Shot Charge Level 1', [982, 3051, 1706]],
  ];
  for (const [label, trio] of rows) it(`${label} within 0.5%`, () => check(ganyu.hit(label), trio));

  // Paimon prices Ganyu's two Frostflake rows at 55% CRIT Rate while the panel
  // it shows reads 35%, i.e. +20% applied to those rows alone — an Ice Lotus
  // mark / Blizzard Strayer style conditional. That is a state to declare, not a
  // talent or element disagreement, so the check stops at the two columns the
  // element rule can move and records their crit rate instead.
  for (const [label, [nonCrit, crit, avg]] of [
    ['Frostflake Arrow DMG', [1014, 3149, 2188]],
    ['Frostflake Arrow Bloom DMG', [1724, 5354, 3720]],
  ] as [string, Trio][]) {
    it(`${label} matches on Non-crit and Crit within 0.5%`, () => {
      const r = ganyu.hit(label);
      expect(Math.abs(r.nonCrit - nonCrit) / nonCrit).toBeLessThan(0.005);
      expect(Math.abs(r.critHit - crit) / crit).toBeLessThan(0.005);
    });

    it(`${label}: paimon's Average implies 55% CRIT Rate, our panel's 35%`, () => {
      const r = ganyu.hit(label);
      const rateFrom = (a: number, nc: number) => (a / nc - 1) / r.critDMG;
      expect(rateFrom(avg, nonCrit)).toBeCloseTo(0.55, 2);
      expect(rateFrom(r.expected, r.nonCrit)).toBeCloseTo(0.35, 2);
    });
  }

  it('the combo Total is the sum of the six hits', () => {
    const sum = (k: 'nonCrit' | 'critHit' | 'expected') =>
      ['1-Hit DMG', '2-Hit DMG', '3-Hit DMG', '4-Hit DMG', '5-Hit DMG', '6-Hit DMG'].reduce((s, l) => s + ganyu.hit(l)[k], 0);
    check({ nonCrit: sum('nonCrit'), critHit: sum('critHit'), expected: sum('expected') }, [1885, 5854, 3274]);
  });

  it('her own 20% Cryo bonus does not reach the Physical combo', () => {
    expect(ganyu.hit('1-Hit DMG').nonCrit).toBeLessThan(230);
    expect(ganyu.hit('1-Hit DMG', { element: 'cryo' }).nonCrit / ganyu.hit('1-Hit DMG').nonCrit).toBeCloseTo(1.2, 4);
  });
});

// Fischl's panel has no elemental and no Physical bonus at all, so her rows
// price the multipliers and hit counts with no element term in the way.
const fischl = paimonPanel({ charId: 'fischl', atk: 789, critRate: 0.35, critDMG: 1.722, dmg: {} });

describe('cross-check — Fischl: Physical combo, Electro charged shot', () => {
  const ref: [string, Trio][] = [
    ['1-Hit DMG', [280, 763, 449]],
    ['2-Hit DMG', [297, 809, 476]],
    ['3-Hit DMG', [369, 1005, 592]],
    ['4-Hit DMG', [367, 998, 588]],
    ['5-Hit DMG', [458, 1246, 734]],
    ['Aimed Shot', [279, 759, 447]],
    ['Fully-Charged Aimed Shot', [729, 1984, 1168]],
    ['Plunge DMG', [361, 983, 579]],
    ['Low Plunge DMG', [722, 1965, 1157]],
    ['High Plunge DMG', [902, 2455, 1445]],
  ];
  for (const [label, trio] of ref) it(`${label} within 0.5%`, () => check(fischl.hit(label), trio));
});

/**
 * Lohen and Kazuha are the two rows where paimon's colour dot disagrees with the
 * talent text and costs it nothing: their default panels carry 0.0% Cryo, 0.0%
 * Anemo and 0.0% Physical DMG bonus, so every one of these numbers is the same
 * whichever element the row is tagged with. We reproduce them with the Physical
 * rows the talent text gives us — the disagreement is cosmetic on their side.
 * (Kazuha's Anemo plunge is a named state: "If this Plunging Attack is triggered
 * by Chihayaburu, it will be converted to Plunging Attack: Midare Ranzan".)
 */
const lohen = paimonPanel({ charId: 'lohen', atk: 902, critRate: 0.35, critDMG: 2.106, dmg: {} });

describe('cross-check — Lohen: paimon colours him Cryo on a 0% Cryo panel', () => {
  const ref: [string, Trio][] = [
    ['1-Hit DMG', [392, 1219, 681]],
    ['2-Hit DMG', [410, 1274, 712]],
    ['3-Hit DMG', [554, 1721, 963]],
    ['4-Hit DMG', [547, 1698, 950]],
    ['5-Hit DMG', [670, 2080, 1163]],
    ['Charged Attack DMG', [957, 2973, 1663]],
    ['Plunge DMG', [465, 1443, 807]],
    ['Low Plunge DMG', [929, 2885, 1614]],
    ['High Plunge DMG', [1160, 3604, 2015]],
  ];
  for (const [label, trio] of ref) it(`${label} within 0.5%`, () => check(lohen.hit(label), trio));

  it('his combo Total is the sum of the five hits', () => {
    const sum = (k: 'nonCrit' | 'critHit' | 'expected') =>
      ['1-Hit DMG', '2-Hit DMG', '3-Hit DMG', '4-Hit DMG', '5-Hit DMG'].reduce((s, l) => s + lohen.hit(l)[k], 0);
    check({ nonCrit: sum('nonCrit'), critHit: sum('critHit'), expected: sum('expected') }, [2573, 7991, 4469]);
  });
});

const kazuha = paimonPanel({ charId: 'kazuha', atk: 820, critRate: 0.35, critDMG: 1.722, dmg: {} });

describe('cross-check — Kazuha: Physical combo, Anemo-coloured plunge on a 0% Anemo panel', () => {
  const ref: [string, Trio][] = [
    ['1-Hit DMG', [297, 809, 476]],
    ['2-Hit DMG', [299, 813, 479]],
    ['3-Hit DMG', [375, 1020, 601]],
    ['4-Hit DMG', [401, 1092, 643]],
    ['5-Hit DMG', [503, 1368, 806]],
    ['Charged Attack DMG', [777, 2115, 1245]],
    ['Plunge DMG', [541, 1471, 866]],
    ['Low Plunge DMG', [1081, 2942, 1732]],
    ['High Plunge DMG', [1350, 3675, 2164]],
  ];
  for (const [label, trio] of ref) it(`${label} within 0.5%`, () => check(kazuha.hit(label), trio));
});

/**
 * Yoimiya is the panel where paimon's default is a state. Every row it prices
 * for her combo is 1.5879x ours, which is exactly her Skill's "Blazing Arrow
 * DMG = 158.79% Normal Attack DMG" at Talent 9 — Niidama is on, and its Pyro
 * colouring of the combo is the same decision. So the standing disagreement is
 * about a default, not about the talent table: with the state declared, our
 * engine reproduces their numbers row for row.
 */
const yoimiya = paimonPanel({ charId: 'yoimiya', atk: 865, critRate: 0.542, critDMG: 1.722, dmg: { pyro: 0.736 } });
const blazing = yoimiya.row('Blazing Arrow DMG').values[8];

describe('cross-check — Yoimiya: paimon defaults to her Elemental Skill', () => {
  const infused: [string, Trio][] = [
    ['1-Hit DMG', [1253, 3412, 2423]],
    ['2-Hit DMG', [1202, 3273, 2325]],
    ['3-Hit DMG', [1563, 4255, 3022]],
    ['4-Hit DMG', [1633, 4444, 3156]],
    ['5-Hit DMG', [1862, 5067, 3599]],
  ];
  for (const [label, trio] of infused) {
    it(`${label} matches paimon once Niidama is priced in, within 0.5%`, () => {
      check(yoimiya.hit(label, { element: 'pyro', multMul: blazing }), trio);
    });
  }

  const plain: [string, Trio][] = [
    ['Fully-Charged Aimed Shot', [1388, 3778, 2684]],
    ['Kindling Arrow DMG', [184, 500, 355]],
    ['Plunge DMG', [687, 1871, 1329]],
    ['Low Plunge DMG', [1375, 3742, 2658]],
    ['High Plunge DMG', [1717, 4674, 3320]],
  ];
  for (const [label, trio] of plain) {
    it(`${label} takes the Pyro bonus without Niidama, within 0.5%`, () => {
      check(yoimiya.hit(label, { element: 'pyro' }), trio);
    });
  }

  it('our default page prices her combo 2.757x below that panel', () => {
    const ratio = yoimiya.hit('1-Hit DMG', { element: 'pyro', multMul: blazing }).nonCrit / yoimiya.hit('1-Hit DMG').nonCrit;
    expect(ratio).toBeCloseTo(1.736 * blazing, 3);
  });

  // The one place paimon's Niidama model leaks: the talent reads "arrows fired
  // by Yoimiya's Normal Attack", and an Aimed Shot is a Charged Attack, so the
  // 158.79% does not reach it in game.
  it('paimon multiplies her Aimed Shot by Niidama too (843 vs our 531)', () => {
    expect(yoimiya.hit('Aimed Shot', { element: 'pyro', multMul: blazing }).nonCrit).toBeCloseTo(843, -1);
    expect(yoimiya.hit('Aimed Shot', { element: 'pyro' }).nonCrit).toBeCloseTo(531, -1);
  });
});
