import { describe, expect, it } from 'vitest';
import { overlayBaseline, snapshotBaseline } from './DamageTable';
import type { DamageGroupVm, DamageRowVm } from './DamageTable';

function row(id: string, expected: number, extra: Partial<DamageRowVm> = {}): DamageRowVm {
  return {
    id,
    label: id,
    group: 'normal',
    element: 'pyro',
    value: 1,
    nonCrit: expected / 2,
    crit: expected * 1.5,
    expected,
    active: false,
    ...extra,
  };
}

/** A table shaped like the real one: one Normal group with a Total, one Skill group without. */
function table(): DamageGroupVm[] {
  return [
    {
      group: 'normal',
      label: 'Normal Attack',
      rows: [row('n1', 1000), row('n2', 2000)],
      total: { nonCrit: 1500, crit: 4500, expected: 3000 },
    },
    {
      group: 'skill',
      label: 'Elemental Skill',
      rows: [row('s1', 5000, { group: 'skill' })],
      total: null,
    },
  ];
}

describe('snapshotBaseline', () => {
  it('records damage rows by id and group totals by group', () => {
    const b = snapshotBaseline('baizhu', table());
    expect(b.characterId).toBe('baizhu');
    expect([...b.rows.entries()]).toEqual([
      ['n1', 1000],
      ['n2', 2000],
      ['s1', 5000],
    ]);
    expect([...b.totals.entries()]).toEqual([['normal', 3000]]);
  });

  it('skips display-only rows, which carry text instead of damage', () => {
    const groups = table();
    groups[0].rows.push(row('cd', 0, { text: '10s' }));
    const b = snapshotBaseline('baizhu', groups);
    expect(b.rows.has('cd')).toBe(false);
  });
});

describe('overlayBaseline', () => {
  it('is a no-op when nothing is pinned, so the column stays hidden', () => {
    const groups = table();
    expect(overlayBaseline(groups, null, 'baizhu')).toBe(groups);
  });

  it('attaches the pinned number to each matching row and group total', () => {
    const groups = table();
    const out = overlayBaseline(groups, snapshotBaseline('baizhu', groups), 'baizhu');
    expect(out[0].rows.map((r) => r.diff)).toEqual([1000, 2000]);
    expect(out[1].rows[0].diff).toBe(5000);
    expect(out[0].total?.diff).toBe(3000);
    // The Skill group has no Total DMG, and must stay that way.
    expect(out[1].total).toBeNull();
  });

  it('ignores a baseline pinned on a different character', () => {
    // Row ids are NOT namespaced by character — the real generated table uses
    // ids like "combat1-0-1-hit-dmg" on every character — so a foreign baseline
    // would match row-for-row and report garbage instead of failing loudly.
    const groups = table();
    const foreign = snapshotBaseline('ganyu', groups);
    expect(overlayBaseline(groups, foreign, 'baizhu')).toBe(groups);
  });

  it('leaves a row that did not exist at pin time without a diff, so it reads "—"', () => {
    const groups = table();
    const b = snapshotBaseline('baizhu', groups);
    const grown = table();
    grown[0].rows.push(row('n3', 9999));
    const out = overlayBaseline(grown, b, 'baizhu');
    expect(out[0].rows.find((r) => r.id === 'n3')!.diff).toBeUndefined();
    expect(out[0].rows.find((r) => r.id === 'n1')!.diff).toBe(1000);
  });

  it('does not mutate the live table it overlays', () => {
    const groups = table();
    overlayBaseline(groups, snapshotBaseline('baizhu', groups), 'baizhu');
    expect(groups[0].rows[0].diff).toBeUndefined();
    expect(groups[0].total!.diff).toBeUndefined();
  });
});
