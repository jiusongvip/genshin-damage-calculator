import { describe, expect, it } from 'vitest';
import { RELEASED_CHARACTERS } from '../../data/characters';
import type { ArtifactSub } from '../../lib/damage';
import {
  defaultsFor,
  draftFromQuery,
  draftToQuery,
  mainValueFor,
  sanitize,
} from './draft';
import type { Draft } from './draft';

/**
 * The address bar is the single source of truth for a shareable panel (and,
 * later, for local saves). These tests pin the contract that a round trip
 * through the query string reproduces the draft exactly — for every editable
 * field, but especially the ones a stale hand-written reader used to drop:
 * talent levels, the picked per-hit row, per-element resistance, artifact
 * sub-stats, and constellations + passives.
 */

const huTao = RELEASED_CHARACTERS.find((c) => c.id === 'hu-tao')!;

/** Build a draft off a character's defaults by applying a patch, sanitized the
 *  same way the restore path sanitizes — so the expected value is honest. */
const mk = (patch: Partial<Draft> = {}, base = defaultsFor(huTao)): Draft => sanitize({ ...base, ...patch });

const roundTrip = (d: Draft, base = defaultsFor(huTao)): Draft =>
  draftFromQuery(new URLSearchParams(draftToQuery(d, base)), base);

describe('draft ↔ URL query', () => {
  it('writes an empty query for a pristine default draft', () => {
    for (const c of RELEASED_CHARACTERS.slice(0, 12)) {
      const d = defaultsFor(c);
      expect(draftToQuery(d, d), c.id).toBe('');
    }
  });

  it('round-trips the default draft unchanged', () => {
    const d = defaultsFor(huTao);
    expect(roundTrip(d)).toEqual(d);
  });

  it('round-trips talent levels', () => {
    const d = mk({ talentLevels: { normal: 6, skill: 10, burst: 13 } });
    expect(roundTrip(d)).toEqual(d);
    expect(draftToQuery(d, defaultsFor(huTao))).toContain('tl=6.10.13');
  });

  it('round-trips the selected per-hit row and its element / scaling', () => {
    const d = mk({
      activeRowId: 'combat1-0-2-hit-dmg',
      elementOverride: 'pyro',
      scalingOverride: 'hp',
    });
    expect(roundTrip(d)).toEqual(d);
  });

  it('round-trips per-element resistance and a custom enemy', () => {
    const d = mk({
      customEnemy: true,
      enemyLevel: 95,
      enemyResMap: { pyro: 0.15, physical: -0.35 },
    });
    const back = roundTrip(d);
    expect(back).toEqual(d);
    expect(back.enemyResMap).toEqual({ pyro: 0.15, physical: -0.35 });
  });

  it('round-trips artifact sub-stats, main stats, and set picks', () => {
    const base = defaultsFor(huTao);
    const pieceSubs = base.artifacts.pieceSubs!.map((p, i) =>
      i === 2 ? ([{ type: 'critDMG', value: 0.2 }, { type: 'atk%', value: 0.05 }] as ArtifactSub[]) : p,
    );
    const d = mk({
      artifacts: {
        ...base.artifacts,
        pieceSubs,
        gobletMain: { type: 'physical', value: mainValueFor('physical') },
        circletMain: { type: 'critRate', value: mainValueFor('critRate') },
        sets: { flower: '', plume: '', sands: 'gladiators-finale', goblet: '', circlet: 'noblesse' },
      },
    });
    expect(roundTrip(d)).toEqual(d);
  });

  it('round-trips constellation and enabled passives', () => {
    const d = mk({ constellation: 2, passiveOn: [0, 1] });
    expect(roundTrip(d)).toEqual(d);
    expect(draftToQuery(d, defaultsFor(huTao))).toContain('cn=2');
    expect(draftToQuery(d, defaultsFor(huTao))).toContain('pv=0.1');
  });

  it('round-trips a kitchen-sink draft across every editable zone', () => {
    const d = mk({
      level: 1,
      weaponId: 'staff-of-homa',
      weaponRefine: 5,
      weaponStacks: 2,
      enemyId: 'custom',
      customEnemy: true,
      enemyLevel: 100,
      attackType: 'normal',
      skillMult: 0.6324,
      statOverride: 3200,
      baseDmgBonus: 0.1,
      flatBaseDmg: 40,
      dmgBonus: 0.466,
      naDmgBonus: 0.15,
      critRate: 0.55,
      critDMG: 1.2,
      critMode: 'crit',
      em: 340,
      amplified: 'melt',
      transformative: 'swirl',
      swirlElement: 'cryo',
      reactionBonus: 0.2,
      defShred: 0.5,
      defIgnore: 0.15,
      resShred: 0.4,
      dmgReduction: 0.1,
      constellation: 6,
      passiveOn: [0, 1, 2],
    });
    expect(roundTrip(d)).toEqual(d);
  });

  it('omits values that equal the character default (short links)', () => {
    const base = defaultsFor(huTao);
    const qs = new URLSearchParams(draftToQuery({ ...base, dmgBonus: 0, critRate: 0 }, base));
    expect(qs.has('db')).toBe(false);
    expect(qs.has('cr')).toBe(false);
  });

  it('reads keys the old build understood (forward/back compatible)', () => {
    // An external link written by the pre-refactor serializer must still load.
    const legacy = new URLSearchParams('c=hu-tao&lv=90&db=0.466&cr=0.55&cd=1.2&tl=10.10.10');
    const d = draftFromQuery(legacy, defaultsFor(huTao));
    expect(d.charId).toBe('hu-tao');
    expect(d.dmgBonus).toBeCloseTo(0.466, 6);
    expect(d.critRate).toBeCloseTo(0.55, 6);
    expect(d.critDMG).toBeCloseTo(1.2, 6);
  });
});
