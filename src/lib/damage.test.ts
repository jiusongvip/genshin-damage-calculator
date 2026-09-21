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
