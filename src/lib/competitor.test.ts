import { describe, expect, it } from 'vitest';
import { addBuffs, computeDamage } from './damage';
import type { ElementType, ScalingStat } from './damage';
import { CHARACTERS } from '../data/characters';
import { getWeapon } from '../data/weapons';
import { DEFAULT_BUFFS, NO_ARTIFACTS } from '../data/presets';
import { DEFAULT_PARTY, resolvePartyBuffs } from '../data/partyBuffs';
import { talentRowsFor } from '../data/generated/talents';
import { unscopedBuffs } from '../data/constellations';
import { infusedElement, stateEffects, stateRowBonus } from '../data/selfStates';
import { rowAttackType } from '../components/calculator/constants';

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

// ---------------------------------------------------------------------------
// Hu Tao with Paramita Papilio (brief #5 Task 5)
// ---------------------------------------------------------------------------

/**
 * damage.paimon.app, read on 2026-09-23 with this panel:
 *   Hu Tao Lv90 C0 · talents 9/9/9 · Deathmatch R1 (ATK +16% stack) · enemy Lv100 / 10% RES
 *   "Guide to Afterlife active" ON · "Character HP below 50%" ON (A4, +33% Pyro)
 *   HP 20332 · ATK 1363 with the Skill off, 2574 with it on ("ATK Increase 1211")
 *   CRIT 71.8% / 210.6% · Pyro DMG 94.6% · Physical DMG 0%
 *
 * We match the Skill-off panel with flat stat buffs (as for Klee), then switch
 * the state on through data/selfStates.ts: the ATK gain, the Pyro infusion of
 * Normal / Charged / Plunging hits and every multiplier are ours.
 */
describe('cross-check — Hu Tao (Paramita Papilio) vs damage.paimon.app', () => {
  const huTao = CHARACTERS.find((c) => c.id === 'hu-tao')!;
  const deathmatch = getWeapon('deathmatch')!;
  const lv = { normal: 9, skill: 9, burst: 9 };
  const base = (buffs = DEFAULT_BUFFS) =>
    computeDamage({ character: huTao, weapon: deathmatch, artifacts: NO_ARTIFACTS, buffs, enemy, characterLevel: 90, amplified: 'none', transformative: 'none' });
  const wb = base();
  const panel = addBuffs(DEFAULT_BUFFS, {
    flatHP: 20332 - wb.totalHP,
    flatATK: 1363 - wb.totalATK,
    critRate: 0.718 - wb.critRate,
    critDMG: 2.106 - wb.critDMG,
  });
  const withSkill = addBuffs(panel, unscopedBuffs(stateEffects('hu-tao', ['hu-tao-e'], {}, lv)));

  const hit = (label: string) => {
    const row = talentRowsFor('hu-tao')!.find((r) => r.isDamage && r.label === label)!;
    const element = infusedElement('hu-tao', ['hu-tao-e'], row.group, row.element);
    return computeDamage({
      character: huTao,
      weapon: deathmatch,
      artifacts: NO_ARTIFACTS,
      // Paimon's 94.6% is Pyro-only; the panel has no Physical bonus.
      buffs: addBuffs(withSkill, { dmgBonus: element === 'pyro' ? 0.946 - wb.dmgBonus : 0 }),
      enemy,
      characterLevel: 90,
      attackType: row.group === 'burst' ? 'burst' : row.group === 'skill' ? 'skill' : row.group === 'charged' ? 'charged' : 'normal',
      skillMultiplier: row.values[lv[row.group === 'skill' ? 'skill' : row.group === 'burst' ? 'burst' : 'normal'] - 1] * Math.max(1, row.hits),
      element,
      scaling: row.scaling as ScalingStat,
      amplified: 'none',
      transformative: 'none',
    });
  };

  it('the Skill adds 5.957% of Max HP as ATK (paimon: 1363 -> 2574)', () => {
    expect(base(panel).totalATK).toBeCloseTo(1363, 0);
    expect(Math.abs(base(withSkill).totalATK - 2574)).toBeLessThan(1.5);
  });

  const reference: Record<string, Trio> = {
    '1-Hit DMG': [1732, 5380, 4349],
    '2-Hit DMG': [1783, 5537, 4476],
    '3-Hit DMG': [2255, 7005, 5663],
    '4-Hit DMG': [2425, 7531, 6089],
    '5-Hit DMG': [2529, 7856, 6352],
    '6-Hit DMG': [3175, 9863, 7974],
    'Charged Attack': [5022, 15600, 12612],
    'Plunge DMG': [2417, 7506, 6068],
    'Low Plunge DMG': [4832, 15009, 12134],
    'High Plunge DMG': [6036, 18747, 15156],
    'Blood Blossom DMG': [2390, 7423, 6001],
    'Skill DMG': [10331, 32088, 25942],
    'Low HP Skill DMG': [12914, 40110, 32428],
  };
  for (const [label, [nonCrit, crit, avg]] of Object.entries(reference)) {
    it(`${label} within 0.5%`, () => {
      const r = hit(label);
      expect(Math.abs(r.nonCrit - nonCrit) / nonCrit).toBeLessThan(0.005);
      expect(Math.abs(r.critHit - crit) / crit).toBeLessThan(0.005);
      expect(Math.abs(r.expected - avg) / avg).toBeLessThan(0.005);
    });
  }
});

// ---------------------------------------------------------------------------
// Raiden Shogun with the Eye and Resolve (brief #5 Task 5)
// ---------------------------------------------------------------------------

/**
 * damage.paimon.app, read on 2026-09-24 with this panel:
 *   Raiden Lv90 C0 · talents 9/9/9 · Deathmatch R1 (ATK +16% stack) · enemy Lv100 / 10% RES
 *   "(Elemental Skill) Elemental Burst DMG" 27.0% ON
 *   HP 17687 · ATK 1796 · ER 132% · CRIT 71.8% / 172.2%
 *   Electro DMG 12.8% (her A4 from 32% excess ER — not modelled by us, so it is
 *   declared here as a panel stat) · Physical DMG 0%
 *   Resolve Bonus Per Stack 6.61% (Burst) / 1.23% (Normal Attack) at Burst 9
 *
 * The Eye's 27% and every Resolve bonus come from data/selfStates.ts. Paimon
 * lists the 0-stack hits and the 30 / 60-stack Musou no Hitotachi and Isshin
 * totals.
 */
describe('cross-check — Raiden Shogun (Eye + Resolve) vs damage.paimon.app', () => {
  const raiden = CHARACTERS.find((c) => c.id === 'raiden-shogun')!;
  const deathmatch = getWeapon('deathmatch')!;
  const lv = { normal: 9, skill: 9, burst: 9 };
  const wb = computeDamage({ character: raiden, weapon: deathmatch, artifacts: NO_ARTIFACTS, buffs: DEFAULT_BUFFS, enemy, characterLevel: 90, amplified: 'none', transformative: 'none' });
  const panel = addBuffs(DEFAULT_BUFFS, {
    flatATK: 1796 - wb.totalATK,
    critRate: 0.718 - wb.critRate,
    critDMG: 1.722 - wb.critDMG,
  });

  const rows = talentRowsFor('raiden-shogun')!.filter((r) => r.isDamage);
  const hit = (id: string, stacks: number | null) => {
    const row = rows.find((r) => r.id === id)!;
    const on = stacks == null ? ['raiden-e'] : ['raiden-e', 'raiden-q'];
    const inputs: Record<string, number> = stacks == null ? {} : { 'raiden-q': stacks };
    const bucket = row.group === 'skill' ? 'skill' : row.group === 'burst' ? 'burst' : 'normal';
    return computeDamage({
      character: raiden,
      weapon: deathmatch,
      artifacts: NO_ARTIFACTS,
      buffs: addBuffs(panel, unscopedBuffs(stateEffects('raiden-shogun', on, inputs, lv)), {
        dmgBonus: row.element === 'electro' ? 0.128 - wb.dmgBonus : -wb.dmgBonus,
      }),
      enemy,
      characterLevel: 90,
      attackType: rowAttackType('raiden-shogun', row),
      skillMultiplier: row.values[lv[bucket] - 1] * Math.max(1, row.hits) + stateRowBonus('raiden-shogun', on, inputs, lv, row),
      element: row.element as ElementType,
      scaling: row.scaling as ScalingStat,
      amplified: 'none',
      transformative: 'none',
    });
  };
  const within = (r: { nonCrit: number; critHit: number; expected: number }, [nonCrit, crit, avg]: Trio, tol = 0.005) => {
    expect(Math.abs(r.nonCrit - nonCrit) / nonCrit).toBeLessThan(tol);
    expect(Math.abs(r.critHit - crit) / crit).toBeLessThan(tol);
    expect(Math.abs(r.expected - avg) / avg).toBeLessThan(tol);
  };

  const single: [string, string, Trio][] = [
    ['Normal 1-Hit (Physical)', 'combat1-0-1-hit-dmg', [574, 1561, 1282]],
    ['Normal 5-Hit (Physical)', 'combat1-4-5-hit-dmg', [947, 2577, 2117]],
    ['Charged (Physical)', 'combat1-5-charged-attack-dmg', [1441, 3922, 3221]],
    ['Plunge (Physical)', 'combat1-7-plunge-dmg', [925, 2518, 2068]],
    ['Skill DMG', 'combat2-0-skill-dmg', [1770, 4818, 3957]],
    ['Coordinated ATK', 'combat2-1-coordinated-atk-dmg', [634, 1726, 1418]],
    ['Musou no Hitotachi, 0 stacks', 'combat3-0-musou-no-hitotachi-base-dmg', [7501, 20418, 16770]],
    ['Isshin 1-Hit, 0 stacks', 'combat3-3-1-hit-dmg', [828, 2255, 1852]],
    ['Isshin 2-Hit, 0 stacks', 'combat3-4-2-hit-dmg', [814, 2215, 1819]],
    ['Isshin 3-Hit, 0 stacks', 'combat3-5-3-hit-dmg', [997, 2713, 2228]],
    ['Isshin 4-Hit, 0 stacks', 'combat3-6-4-hit-dmg', [1145, 3118, 2561]],
    ['Isshin 5-Hit, 0 stacks', 'combat3-7-5-hit-dmg', [1369, 3727, 3061]],
    ['Isshin Charged, 0 stacks', 'combat3-8-charged-attack-dmg', [2517, 6852, 5628]],
    ['Isshin Plunge (Burst DMG), 0 stacks', 'combat3-10-plunge-dmg', [1293, 3520, 2891]],
  ];
  for (const [name, id, ref] of single) it(`${name} within 0.5%`, () => within(hit(id, null), ref));

  it('Musou no Hitotachi at 30 and 60 stacks within 0.5%', () => {
    within(hit('combat3-0-musou-no-hitotachi-base-dmg', 30), [9684, 26361, 21650]);
    within(hit('combat3-0-musou-no-hitotachi-base-dmg', 60), [11868, 32303, 26531]);
  });

  // Bennett's Fantastic Voyage on the same panel, via paimon's PARTY BUFFS ›
  // Bennett › "ATK Bonus (Weapon Lv 90, Character Lv 90or100, C1~)" with
  // Base ATK 865 (Aquila Favonia) and Talent Lv 10. Paimon's label says C1~,
  // and its +1045 ATK is 865 x (100.8% + 20%) — so it assumes C1.
  describe('with Bennett Q (base ATK 865, Burst 10, C1)', () => {
    const party = { ...DEFAULT_PARTY, bennett: 1, bennettBase: 865, bennettLevel: 10, bennettC1: 1 };
    const withBennett = (id: string) => {
      const row = rows.find((r) => r.id === id)!;
      const bucket = row.group === 'skill' ? 'skill' : row.group === 'burst' ? 'burst' : 'normal';
      return computeDamage({
        character: raiden,
        weapon: deathmatch,
        artifacts: NO_ARTIFACTS,
        buffs: addBuffs(panel, unscopedBuffs(stateEffects('raiden-shogun', ['raiden-e'], {}, lv)), resolvePartyBuffs(party, row.element as ElementType), {
          dmgBonus: row.element === 'electro' ? 0.128 - wb.dmgBonus : -wb.dmgBonus,
        }),
        enemy,
        characterLevel: 90,
        attackType: rowAttackType('raiden-shogun', row),
        skillMultiplier: row.values[lv[bucket] - 1] * Math.max(1, row.hits),
        element: row.element as ElementType,
        scaling: row.scaling as ScalingStat,
        amplified: 'none',
        transformative: 'none',
      });
    };

    it('ATK 1796 -> 2841', () => {
      expect(Math.abs(withBennett('combat1-0-1-hit-dmg').totalATK - 2841)).toBeLessThan(1.5);
    });
    const ref: [string, Trio][] = [
      ['combat1-0-1-hit-dmg', [907, 2470, 2028]],
      ['combat1-1-2-hit-dmg', [909, 2475, 2033]],
      ['combat2-0-skill-dmg', [2800, 7620, 6259]],
      ['combat2-1-coordinated-atk-dmg', [1003, 2731, 2243]],
      ['combat3-0-musou-no-hitotachi-base-dmg', [11865, 32298, 26526]],
    ];
    for (const [id, trio] of ref) it(`${id} within 0.5%`, () => within(withBennett(id), trio));
  });

  // Where we and paimon disagree — reported, not tolerated (brief #5 Task 5).
  //
  // 1. Musou Isshin Low / High Plunge. genshin-db (and the in-game table) give
  //    117.5% / 234.9% / 293.4% at Burst 9 — the usual 2x / 2.5x of the plain
  //    plunge. Paimon shows 1293 / 2086 / 2606: its plain plunge matches ours,
  //    its Low / High are 1.61x / 2.02x of it. We follow the data.
  it('Isshin Low / High Plunge keep the 2x / 2.5x ratio of the talent table (paimon: 1.61x / 2.02x)', () => {
    const plunge = hit('combat3-10-plunge-dmg', null).nonCrit;
    expect(hit('combat3-11-low-plunge-dmg', null).nonCrit / plunge).toBeCloseTo(2.0, 2);
    expect(hit('combat3-11-high-plunge-dmg', null).nonCrit / plunge).toBeCloseTo(2.498, 2);
    expect(plunge).toBeCloseTo(1293, -1);
  });

  // 2. Musou Isshin combo totals. Paimon's own numbers are not linear in
  //    stacks: Total 3686 (0) -> 7193 (30) -> 9232 (60), i.e. +3507 then +2039,
  //    and its 0-stack Total (3686) is not the sum of its own 1-5 Hit rows
  //    (5153). Its 30 -> 60 step equals 5 parts x 30 stacks x 1.23%; the 4-Hit
  //    is two hits, so the combo has 6 parts and we add Resolve to each.
  it('Musou Isshin combo: sum of the paimon hits at 0 stacks, then linear per part (paimon totals disagree)', () => {
    const combo = ['combat3-3-1-hit-dmg', 'combat3-4-2-hit-dmg', 'combat3-5-3-hit-dmg', 'combat3-6-4-hit-dmg', 'combat3-7-5-hit-dmg'];
    const total = (stacks: number | null) => combo.reduce((s, id) => s + hit(id, stacks).nonCrit, 0);
    expect(Math.abs(total(null) - (828 + 814 + 997 + 1145 + 1369)) / 5153).toBeLessThan(0.005);
    const step = total(30) - total(null);
    expect(total(60) - total(30)).toBeCloseTo(step, 6);
    // One part at 30 stacks, priced like every other Isshin hit on this panel.
    const perPart = (step / 6) * 5;
    expect(Math.abs(perPart - (9232 - 7193)) / 2039).toBeLessThan(0.005);
  });
});
