import { describe, expect, it } from 'vitest';
import { addBuffs, computeDamage, levelMultiplierFor } from './damage';
import type { ElementType } from './damage';
import { CHARACTERS } from '../data/characters';
import { getWeapon } from '../data/weapons';
import { DEFAULT_BUFFS, NO_ARTIFACTS } from '../data/presets';
import { resolveSetBuffs } from '../data/artifactSets';
import { weaponBuffAt } from '../data/weaponPassives';
import { constellationBuffs } from '../data/constellations';
import { passiveBuffs } from '../data/constellations';

/**
 * Engine regression checks. These pin the KQM-verified rules that every other
 * feature leans on, so a data refresh or a new multiplier cannot silently bend
 * the formula. The scenarios mirror the calculator's acceptance table.
 */

const char = (id: string) => {
  const c = CHARACTERS.find((x) => x.id === id);
  if (!c) throw new Error(`missing character ${id}`);
  return c;
};

const enemy = (level: number, res: Partial<Record<ElementType, number>> & { default: number } = { default: 0.1 }) => ({
  id: 'test',
  name: 'Test',
  level,
  resistances: res,
});

const base = (id: string, weaponId: string, opts: Partial<Parameters<typeof computeDamage>[0]> = {}) =>
  computeDamage({
    character: char(id),
    weapon: getWeapon(weaponId)!,
    artifacts: NO_ARTIFACTS,
    buffs: DEFAULT_BUFFS,
    enemy: enemy(90),
    characterLevel: 90,
    amplified: 'none',
    transformative: 'none',
    ...opts,
  });

describe('Bennett whiteboard (character + weapon, no artifacts)', () => {
  const r = base('bennett', 'favonius-sword');

  it('totals base ATK from character + weapon', () => {
    expect(Math.round(r.totalATK)).toBe(645);
  });

  it('starts from the 5% / 50% base crit', () => {
    expect(r.critRate).toBeCloseTo(0.05, 6);
    expect(r.critDMG).toBeCloseTo(0.5, 6);
  });

  it('produces the reference expected damage', () => {
    expect(Math.round(r.expected)).toBe(1609);
  });
});

describe('enemy DEF multiplier', () => {
  it('is 0.500 for level 90 vs level 90', () => {
    expect(base('bennett', 'favonius-sword').defMultiplier).toBeCloseTo(0.5, 6);
  });

  it('is 0.487 for level 90 vs level 100', () => {
    const r = computeDamage({
      character: char('bennett'),
      weapon: getWeapon('favonius-sword')!,
      artifacts: NO_ARTIFACTS,
      buffs: DEFAULT_BUFFS,
      enemy: enemy(100),
      characterLevel: 90,
      amplified: 'none',
      transformative: 'none',
    });
    expect(r.defMultiplier).toBeCloseTo(0.487, 3);
  });
});

describe('enemy RES bands', () => {
  const resAt = (value: number) => base('bennett', 'favonius-sword', { enemy: enemy(90, { default: value }) }).resMultiplier;

  it('10% resistance → ×0.900', () => expect(resAt(0.1)).toBeCloseTo(0.9, 6));
  it('75% resistance → ×0.250', () => expect(resAt(0.75)).toBeCloseTo(0.25, 6));
  it('−20% resistance → ×1.100', () => expect(resAt(-0.2)).toBeCloseTo(1.1, 6));
});

describe('CRIT', () => {
  it('expected damage equals a guaranteed CRIT at 100% CRIT Rate', () => {
    const r = base('bennett', 'favonius-sword', { buffs: addBuffs(DEFAULT_BUFFS, { critRate: 0.95 }) });
    expect(r.critRate).toBeCloseTo(1, 6);
    expect(r.expected).toBeCloseTo(r.critHit, 6);
  });
});

describe('transformative reaction level coefficient', () => {
  it('level 60 Bloom coefficient matches the full table', () => {
    expect(levelMultiplierFor(60)).toBeCloseTo(492.8849, 3);
  });
});

describe('per-hit element override', () => {
  it('reads the resistance of the hit element, not the character element', () => {
    const e = enemy(90, { default: 0.1, physical: 0.7 });
    const pyro = base('bennett', 'favonius-sword', { enemy: e });
    const physical = base('bennett', 'favonius-sword', { enemy: e, element: 'physical' });
    expect(pyro.resMultiplier).toBeCloseTo(0.9, 6);
    expect(physical.resMultiplier).toBeCloseTo(0.3, 6);
  });
});

describe('curated buff sources', () => {
  it('Lost Prayer at R1 with 4 stacks grants +32% DMG bonus', () => {
    const buffs = weaponBuffAt('lost-prayer', 1, 4);
    expect(buffs.dmgBonus).toBeCloseTo(0.32, 6);
  });

  it('Raiden Shogun C2 ignores 60% DEF', () => {
    const buffs = addBuffs(DEFAULT_BUFFS, constellationBuffs('raiden-shogun', 2));
    expect(buffs.defIgnore).toBeCloseTo(0.6, 6);
    const r = computeDamage({
      character: char('raiden-shogun'),
      weapon: getWeapon('engulfing-lightning')!,
      artifacts: NO_ARTIFACTS,
      buffs,
      enemy: enemy(90),
      characterLevel: 90,
      amplified: 'none',
      transformative: 'none',
    });
    expect(r.defMultiplier).toBeCloseTo(0.7143, 3);
  });

  it('Crimson Witch 4pc grants +37.5% Pyro DMG bonus', () => {
    const buffs = resolveSetBuffs([{ id: 'crimson-witch-of-flames', pieces: 4 }], 'pyro', 'normal');
    expect(buffs.dmgBonus).toBeCloseTo(0.375, 6);
  });

  it('does not apply a Pyro set bonus to a Physical hit', () => {
    const buffs = resolveSetBuffs([{ id: 'crimson-witch-of-flames', pieces: 4 }], 'physical', 'normal');
    expect(buffs.dmgBonus ?? 0).toBe(0);
  });
});

describe('attribute conversions', () => {
  it('Engulfing Lightning adds ATK% from Energy Recharge, capped', () => {
    const enemy90 = enemy(90);
    const noPassive = computeDamage({
      character: char('raiden-shogun'),
      weapon: getWeapon('engulfing-lightning')!,
      artifacts: NO_ARTIFACTS,
      buffs: DEFAULT_BUFFS,
      enemy: enemy90,
      characterLevel: 90,
      amplified: 'none',
      transformative: 'none',
    });
    const withPassive = computeDamage({
      character: char('raiden-shogun'),
      weapon: getWeapon('engulfing-lightning')!,
      artifacts: NO_ARTIFACTS,
      buffs: addBuffs(DEFAULT_BUFFS, weaponBuffAt('engulfing-lightning', 1, 1)),
      enemy: enemy90,
      characterLevel: 90,
      amplified: 'none',
      transformative: 'none',
    });
    // ATK% gained = 28% of the ER bonus above 100% (here below the 80% cap).
    expect(withPassive.totalATK / noPassive.totalATK).toBeCloseTo(1 + 0.28 * noPassive.er, 3);
  });

  it('Staff of Homa adds flat ATK from Max HP', () => {
    const enemy90 = enemy(90);
    const buffs = addBuffs(DEFAULT_BUFFS, { atkFromHP: 0.008 });
    const r = computeDamage({
      character: char('hu-tao'),
      weapon: getWeapon('staff-of-homa')!,
      artifacts: NO_ARTIFACTS,
      buffs,
      enemy: enemy90,
      characterLevel: 90,
      amplified: 'none',
      transformative: 'none',
    });
    const plain = computeDamage({
      character: char('hu-tao'),
      weapon: getWeapon('staff-of-homa')!,
      artifacts: NO_ARTIFACTS,
      buffs: DEFAULT_BUFFS,
      enemy: enemy90,
      characterLevel: 90,
      amplified: 'none',
      transformative: 'none',
    });
    expect(r.totalATK - plain.totalATK).toBeCloseTo(0.008 * r.totalHP, 3);
  });
});

describe('curated constellation / passive buffs', () => {
  it('Keqing C4 grants +25% ATK', () => {
    expect(constellationBuffs('keqing', 4).atkPercent).toBeCloseTo(0.25, 6);
  });

  it('accumulates every level up to the selected constellation', () => {
    // Kazuha C2 (+200 EM) is included when asking for C2 and stays at C6.
    expect(constellationBuffs('kazuha', 2).em).toBeCloseTo(200, 6);
    expect(constellationBuffs('kazuha', 6).em).toBeCloseTo(200, 6);
  });

  it('Gaming C6 grants +40% CRIT DMG and +20% CRIT Rate', () => {
    const b = constellationBuffs('gaming', 6);
    expect(b.critDMG).toBeCloseTo(0.4, 6);
    expect(b.critRate).toBeCloseTo(0.2, 6);
  });

  it('Sucrose passive grants +50 Elemental Mastery', () => {
    expect(passiveBuffs('sucrose', [0]).em).toBeCloseTo(50, 6);
  });
});

/**
 * Task 3 (brief #2) — each newly modelled carry is pinned by one real per-hit
 * row at C0 and at the constellation level (or passive toggle) that moves it,
 * on the character's signature weapon, no artifacts, level-90 enemy. Reaction
 * stats (EM) are pinned through the reaction output they feed.
 */
const hit = (
  id: string,
  cn = 0,
  passiveOn: number[] = [],
  over: Partial<Parameters<typeof computeDamage>[0]> = {},
) =>
  base(id, char(id).bestWeapon, {
    buffs: addBuffs(DEFAULT_BUFFS, constellationBuffs(id, cn), passiveBuffs(id, passiveOn)),
    ...over,
  });

const NAHIDA_TRI_KARMA = 5.5728; // lv10 "Tri-Karma Purification DMG"
const COLUMBINA_SKILL = 0.301; // lv10 "Skill DMG" (scales off Max HP)

describe('carry constellations — one hit pinned at C0 and at the changing level', () => {
  it('Nahida C2 shreds 30% DEF', () => {
    expect(constellationBuffs('nahida', 2).defShred).toBeCloseTo(0.3, 6);
    const at = (cn: number) => hit('nahida', cn, [], { skillMultiplier: NAHIDA_TRI_KARMA, attackType: 'skill' }).expected;
    expect(Math.round(at(0))).toBe(2162);
    expect(Math.round(at(2))).toBe(2543);
  });

  it('Nahida C4 grants 100 EM (one seeded target), visible in Aggravate', () => {
    expect(constellationBuffs('nahida', 4).em).toBeCloseTo(100, 6);
    const at = (cn: number) =>
      hit('nahida', cn, [], { skillMultiplier: NAHIDA_TRI_KARMA, attackType: 'skill', additive: 'aggravate' }).expected;
    expect(Math.round(at(3))).toBe(4532);
    expect(Math.round(at(4))).toBe(4736);
  });

  it('Ayaka C4 shreds 30% DEF under Soumetsu', () => {
    expect(constellationBuffs('ayaka', 4).defShred).toBeCloseTo(0.3, 6);
    expect(Math.round(hit('ayaka', 0).expected)).toBe(2922);
    expect(Math.round(hit('ayaka', 4).expected)).toBe(3437);
  });

  it('Neuvillette C2 grants 42% CRIT DMG on Equitable Judgment', () => {
    expect(constellationBuffs('neuvillette', 2).critDMG).toBeCloseTo(0.42, 6);
    expect(Math.round(hit('neuvillette', 0).expected)).toBe(18762);
    expect(Math.round(hit('neuvillette', 2).expected)).toBe(19124);
  });

  it('Columbina C2 grants 40% Max HP onto her HP-scaled skill rows', () => {
    expect(constellationBuffs('columbina', 2).hpPercent).toBeCloseTo(0.4, 6);
    const at = (cn: number) =>
      hit('columbina', cn, [], { skillMultiplier: COLUMBINA_SKILL, attackType: 'skill', scaling: 'hp' }).expected;
    expect(Math.round(at(0))).toBe(2656);
    expect(Math.round(at(2))).toBe(3719);
  });

  it('Prune C2 ramps to 40% ATK during the burst', () => {
    expect(constellationBuffs('prune', 2).atkPercent).toBeCloseTo(0.4, 6);
    expect(Math.round(hit('prune', 0).expected)).toBe(1581);
    expect(Math.round(hit('prune', 2).expected)).toBe(2090);
  });

  it('Ifa C4 grants 100 EM after the Burst, visible in Swirl', () => {
    expect(constellationBuffs('ifa', 4).em).toBeCloseTo(100, 6);
    const swirl = (cn: number) => hit('ifa', cn, [], { transformative: 'swirl' }).transformative;
    expect(Math.round(swirl(0))).toBe(2492);
    expect(Math.round(swirl(4))).toBe(2938);
  });

  it('Mavuika C1 grants 40% ATK and C2 a further 200 Base ATK', () => {
    expect(constellationBuffs('mavuika', 1).atkPercent).toBeCloseTo(0.4, 6);
    expect(constellationBuffs('mavuika', 2).flatATK).toBeCloseTo(200, 6);
    expect(Math.round(hit('mavuika', 0).expected)).toBe(4523);
    expect(Math.round(hit('mavuika', 1).expected)).toBe(6332);
    expect(Math.round(hit('mavuika', 2).expected)).toBe(7154);
  });
});

describe('carry ascension passives — the toggle moves the pinned hit', () => {
  it('Yoimiya: Tricks of the Trouble-Maker = +20% Pyro DMG', () => {
    expect(passiveBuffs('yoimiya', [0]).dmgBonus).toBeCloseTo(0.2, 6);
    expect(Math.round(hit('yoimiya').expected)).toBe(4091);
    expect(Math.round(hit('yoimiya', 0, [0]).expected)).toBe(4909);
  });

  it('Ayaka: both passives feed their own buckets', () => {
    expect(passiveBuffs('ayaka', [0]).naDmgBonus).toBeCloseTo(0.3, 6);
    expect(passiveBuffs('ayaka', [1]).dmgBonus).toBeCloseTo(0.18, 6);
    const normal = { attackType: 'normal' as const };
    expect(Math.round(hit('ayaka', 0, [], normal).expected)).toBe(2922);
    expect(Math.round(hit('ayaka', 0, [0], normal).expected)).toBe(3798);
    expect(Math.round(hit('ayaka', 0, [1], normal).expected)).toBe(3447);
  });

  it('Arlecchino: The Balemoon Alone May Know = +40% Pyro DMG', () => {
    expect(passiveBuffs('arlecchino', [2]).dmgBonus).toBeCloseTo(0.4, 6);
    expect(Math.round(hit('arlecchino').expected)).toBe(4421);
    expect(Math.round(hit('arlecchino', 0, [2]).expected)).toBe(6190);
  });

  it('Neuvillette: Heir to the Ancient Sea’s Authority = ×1.6 base DMG at 3 stacks', () => {
    expect(passiveBuffs('neuvillette', [0]).baseDmgBonus).toBeCloseTo(0.6, 6);
    expect(Math.round(hit('neuvillette').expected)).toBe(18762);
    expect(Math.round(hit('neuvillette', 0, [0]).expected)).toBe(30019);
  });

  it('Mavuika: Gift of Flaming Flowers = +30% ATK', () => {
    expect(passiveBuffs('mavuika', [0]).atkPercent).toBeCloseTo(0.3, 6);
    expect(Math.round(hit('mavuika').expected)).toBe(4523);
    expect(Math.round(hit('mavuika', 0, [0]).expected)).toBe(5879);
  });

  it('Ifa: Mutual Aid Agreement = +80 EM, visible in Swirl', () => {
    expect(passiveBuffs('ifa', [1]).em).toBeCloseTo(80, 6);
    const swirl = (p: number[]) => hit('ifa', 0, p, { transformative: 'swirl' }).transformative;
    expect(Math.round(swirl([]))).toBe(2492);
    expect(Math.round(swirl([1]))).toBe(2852);
  });
});
