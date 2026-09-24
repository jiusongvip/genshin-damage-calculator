import { describe, expect, it } from 'vitest';
import { RELEASED_CHARACTERS } from '../data/characters';
import { attackFields, defaultsFor, draftFromQuery, draftToQuery } from '../components/calculator/draft';
import { draftHeadline, draftToGroups, resolveBuild } from './draft-build';
import { buildCharacterPageData, hasPublishableData } from './character-pages';

/**
 * One character, one number. The headline used to price Hu Tao's Physical
 * normal combo as Pyro (17,885) while the table under it said 14,242 and the
 * home-page card, on a third code path, said 14,805. These pin every surface
 * to the same rows.
 */
const withRows = RELEASED_CHARACTERS.filter(hasPublishableData);

describe('headline agrees with the per-hit table', () => {
  it.each(withRows.map((c) => [c.id, c] as const))('%s', (_id, c) => {
    const draft = defaultsFor(c);
    const build = resolveBuild(draft);
    const headline = draftHeadline(draft, build).expected;
    const groups = draftToGroups(draft, build);
    const candidates = groups.flatMap((g) => [
      ...g.rows.filter((r) => r.text === undefined).map((r) => r.expected),
      ...(g.total ? [g.total.expected] : []),
    ]);
    const closest = candidates.reduce((m, v) => (Math.abs(v - headline) < Math.abs(m - headline) ? v : m), Infinity);
    expect(Math.abs(closest - headline) / headline).toBeLessThan(1e-9);
  });
});

describe('character page headline is the calculator headline', () => {
  it.each(withRows.map((c) => [c.id, c] as const))('%s', (_id, c) => {
    const page = buildCharacterPageData(c);
    const equipped = page.weapons.find((w) => w.equipped)!;
    expect(equipped.expected).toBeCloseTo(draftHeadline(defaultsFor(c)).expected, 6);
  });
});

describe('attack type implies its row, element and scaling', () => {
  const huTao = RELEASED_CHARACTERS.find((c) => c.id === 'hu-tao')!;

  it("Hu Tao's default is the Physical normal combo, not a Pyro one", () => {
    const d = defaultsFor(huTao);
    expect(d.attackType).toBe('normal');
    expect(d.elementOverride).toBe('physical');
    expect(d.activeRowId).toBeNull();
  });

  it('a Burst pick loads its biggest row', () => {
    const f = attackFields('hu-tao', 'burst', { normal: 10, skill: 10, burst: 10 })!;
    expect(f.activeRowId).toBe('combat3-1-low-hp-skill-dmg');
    expect(f.elementOverride).toBe('pyro');
    expect(f.skillMult).toBeCloseTo(6.1744, 4);
  });

  it('a default panel still writes no query string', () => {
    for (const c of withRows) expect(draftToQuery(defaultsFor(c), defaultsFor(c))).toBe('');
  });

  it('a link that only says at= restores the implied row (old links included)', () => {
    const d = draftFromQuery(new URLSearchParams('at=burst'), defaultsFor(huTao));
    expect(d.activeRowId).toBe('combat3-1-low-hp-skill-dmg');
    expect(d.elementOverride).toBe('pyro');
  });

  it('an explicitly detached row survives the round trip', () => {
    const defaults = defaultsFor(huTao);
    const burst = { ...defaults, ...attackFields('hu-tao', 'burst', defaults.talentLevels)!, activeRowId: null };
    const back = draftFromQuery(new URLSearchParams(draftToQuery(burst, defaults)), defaults);
    expect(back.activeRowId).toBeNull();
    expect(back.elementOverride).toBe('pyro');
  });
});
