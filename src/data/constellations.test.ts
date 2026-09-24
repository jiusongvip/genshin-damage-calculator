import { describe, expect, it } from 'vitest';
import { RELEASED_CHARACTERS } from './characters';
import { CONSTELLATION_EFFECTS, PASSIVE_EFFECTS, scopedSelfBuffs, unscopedSelfBuffs } from './constellations';
import { defaultsFor } from '../components/calculator/draft';
import { draftToGroups } from '../lib/draft-build';

/**
 * Element- and attack-limited self buffs resolve per hit. Hu Tao's Sanguine
 * Rouge is "+33% Pyro DMG"; folded globally it also lifted her Physical normals.
 */
const huTao = RELEASED_CHARACTERS.find((c) => c.id === 'hu-tao')!;

const rowsOf = (passiveOn: number[]) =>
  new Map(
    draftToGroups({ ...defaultsFor(huTao), passiveOn })
      .flatMap((g) => g.rows)
      .filter((r) => r.text === undefined)
      .map((r) => [r.id, r] as const),
  );

describe('scoped self buffs', () => {
  it('Hu Tao A4 lifts Pyro hits and leaves Physical hits alone', () => {
    const off = rowsOf([]);
    const on = rowsOf([1]);
    let pyro = 0;
    for (const [id, row] of off) {
      const after = on.get(id)!;
      if (row.element === 'physical') expect(after.expected).toBe(row.expected);
      else {
        expect(after.expected).toBeGreaterThan(row.expected);
        pyro++;
      }
    }
    expect(pyro).toBeGreaterThan(0);
  });

  it('a non-matching hit gets nothing from a scoped effect', () => {
    expect(scopedSelfBuffs('hu-tao', 0, [1], { element: 'physical', attack: 'normal' })).toEqual({});
    expect(scopedSelfBuffs('hu-tao', 0, [1], { element: 'pyro', attack: 'normal' }).dmgBonus).toBeCloseTo(0.33, 6);
  });

  it('attack and label scopes', () => {
    expect(scopedSelfBuffs('tighnari', 1, [], { element: 'dendro', attack: 'normal' })).toEqual({});
    expect(scopedSelfBuffs('tighnari', 1, [], { element: 'dendro', attack: 'charged' }).critRate).toBeCloseTo(0.15, 6);
    const ej = { element: 'hydro', attack: 'charged' } as const;
    expect(scopedSelfBuffs('neuvillette', 2, [0], { ...ej, label: 'Charged Attack DMG' })).toEqual({});
    const hit = scopedSelfBuffs('neuvillette', 2, [0], { ...ej, label: 'Charged Attack: Equitable Judgment' });
    expect(hit.critDMG).toBeCloseTo(0.42, 6);
    expect(hit.baseDmgBonus).toBeCloseTo(0.6, 6);
  });

  it('scoped effects never reach the global buff state', () => {
    for (const [id, table] of [...Object.entries(CONSTELLATION_EFFECTS), ...Object.entries(PASSIVE_EFFECTS)]) {
      for (const [k, eff] of Object.entries(table)) {
        if (!eff.only) continue;
        const global = unscopedSelfBuffs(id, 6, [Number(k)]) as Record<string, unknown>;
        expect(global.only).toBeUndefined();
        for (const stat of Object.keys(eff).filter((s) => s !== 'only')) {
          const others = [...Object.values(CONSTELLATION_EFFECTS[id] ?? {}), ...Object.values(PASSIVE_EFFECTS[id] ?? {})]
            .filter((e) => !e.only && (e as Record<string, unknown>)[stat] != null);
          if (others.length === 0) expect(global[stat] ?? 0).toBe(0);
        }
      }
    }
  });
});
