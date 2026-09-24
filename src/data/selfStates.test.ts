import { describe, expect, it } from 'vitest';
import { RELEASED_CHARACTERS } from './characters';
import { defaultsFor, draftFromQuery, draftToQuery } from '../components/calculator/draft';
import type { Draft } from '../components/calculator/draft';
import { draftHeadline, draftToGroups, resolveBuild } from '../lib/draft-build';
import { STATE_PARAMS } from './generated/stateParams';
import { stateRowBonus } from './selfStates';
import { talentRowsFor } from './generated/talents';

/**
 * Self-states are declared toggles. Every rate below is read from genshin-db
 * via generated/stateParams.ts; the level-10 values are pinned here so a
 * regeneration that shifts them is noticed:
 *   Hu Tao    Guide to Afterlife  "ATK Increase" 6.26% Max HP, cap 400% Base ATK
 *   Raiden    Baleful Omen        0.30% Burst DMG per Energy, Burst cost 90
 *   Raiden    Secret Art: Musou   Resolve 7.00% initial / 1.31% per Isshin hit
 *   Noelle    Sweeping Time       ATK Bonus 72% DEF
 */
const char = (id: string) => RELEASED_CHARACTERS.find((c) => c.id === id)!;
const withStates = (id: string, stateOn: string[], extra: Partial<Draft> = {}): Draft => ({
  ...defaultsFor(char(id)),
  stateOn,
  ...extra,
});
const rows = (d: Draft) => new Map(draftToGroups(d).flatMap((g) => g.rows).map((r) => [r.id, r] as const));

describe('generated state parameters (talent level 10)', () => {
  it('match the in-game values', () => {
    expect(STATE_PARAMS['hu-tao'].atkFromHP[9]).toBeCloseTo(0.0626, 4);
    expect(STATE_PARAMS['raiden-shogun'].burstBonusPerEnergy[9]).toBeCloseTo(0.003, 6);
    expect(STATE_PARAMS['raiden-shogun'].burstEnergyCost[9]).toBe(90);
    expect(STATE_PARAMS['raiden-shogun'].resolveInitial[9]).toBeCloseTo(0.07, 3);
    expect(STATE_PARAMS['raiden-shogun'].resolvePerHit[9]).toBeCloseTo(0.0131, 4);
    expect(STATE_PARAMS.noelle.atkFromDEF[9]).toBeCloseTo(0.72, 6);
  });
});

describe('Hu Tao — Paramita Papilio', () => {
  it('adds 6.256% of Max HP as flat ATK', () => {
    const off = draftHeadline(defaultsFor(char('hu-tao')));
    const on = draftHeadline(withStates('hu-tao', ['hu-tao-e']));
    expect(on.totalHP).toBeCloseTo(off.totalHP, 6);
    expect(on.totalATK - off.totalATK).toBeCloseTo(0.06256 * off.totalHP, 3);
  });

  it('caps the bonus at 400% of Base ATK', () => {
    const huge = withStates('hu-tao', ['hu-tao-e'], { flatHP: 200_000 });
    const off = draftHeadline({ ...huge, stateOn: [] });
    const on = draftHeadline(huge);
    expect(0.06256 * on.totalHP).toBeGreaterThan(4 * on.baseATK);
    expect(on.totalATK - off.totalATK).toBeCloseTo(4 * on.baseATK, 3);
  });

  it('turns the Physical normal, charged and plunge rows Pyro — and the headline with them', () => {
    const d = withStates('hu-tao', ['hu-tao-e']);
    for (const r of rows(d).values()) if (r.text === undefined) expect(r.element).toBe('pyro');
    expect(d.elementOverride).toBe('physical'); // the draft still describes the uninfused combo
    const total = draftToGroups(d).find((g) => g.group === 'normal')!.total!.expected;
    expect(draftHeadline(d).expected).toBeCloseTo(total, 6);
  });
});

describe('Raiden Shogun', () => {
  it('Eye of Stormy Judgment: +27% Burst DMG at Skill 10', () => {
    const off = draftHeadline(defaultsFor(char('raiden-shogun')));
    const on = draftHeadline(withStates('raiden-shogun', ['raiden-e']));
    expect(on.dmgBonus - off.dmgBonus).toBeCloseTo(0.27, 6);
  });

  it('Resolve adds to Musou no Hitotachi per stack, and per part to each Isshin hit', () => {
    const lv = resolveBuild(defaultsFor(char('raiden-shogun'))).effLevels;
    const burst = talentRowsFor('raiden-shogun')!.filter((r) => r.group === 'burst' && r.isDamage);
    const initial = burst.find((r) => /Musou no Hitotachi/.test(r.label))!;
    const fourHit = burst.find((r) => r.label === '4-Hit DMG')!; // {param8}+{param9}: two parts
    const oneHit = burst.find((r) => r.label === '1-Hit DMG')!;
    const on = ['raiden-q'];
    expect(stateRowBonus('raiden-shogun', on, { 'raiden-q': 60 }, lv, initial)).toBeCloseTo(60 * 0.069984, 5);
    expect(stateRowBonus('raiden-shogun', on, { 'raiden-q': 60 }, lv, oneHit)).toBeCloseTo(60 * 0.013071, 5);
    expect(stateRowBonus('raiden-shogun', on, { 'raiden-q': 60 }, lv, fourHit)).toBeCloseTo(2 * 60 * 0.013071, 5);
    expect(stateRowBonus('raiden-shogun', on, { 'raiden-q': 0 }, lv, initial)).toBe(0);
    // Her ordinary Physical normals get nothing.
    const physical = talentRowsFor('raiden-shogun')!.find((r) => r.group === 'normal' && r.isDamage)!;
    expect(stateRowBonus('raiden-shogun', on, { 'raiden-q': 60 }, lv, physical)).toBe(0);
  });

  it('the headline and its row agree with Resolve on', () => {
    const d = withStates('raiden-shogun', ['raiden-e', 'raiden-q'], { stateInputs: { 'raiden-q': 60 } });
    const headline = draftHeadline(d).expected;
    expect(rows(d).get(d.activeRowId!)!.expected).toBeCloseTo(headline, 6);
    expect(headline).toBeGreaterThan(draftHeadline(defaultsFor(char('raiden-shogun'))).expected);
  });
});

describe('infusions and conversions', () => {
  it('Diluc Dawn: Pyro normals with the A4 +20% Pyro DMG', () => {
    const off = draftHeadline(defaultsFor(char('diluc')));
    const on = draftHeadline(withStates('diluc', ['diluc-q']));
    expect(off.element).toBe('physical');
    expect(on.element).toBe('pyro');
    expect(on.expected).toBeGreaterThan(off.expected);
  });

  it('Noelle Sweeping Time: ATK + 72% DEF, Geo normals', () => {
    const off = draftHeadline(defaultsFor(char('noelle')));
    const on = draftHeadline(withStates('noelle', ['noelle-q']));
    expect(on.totalATK - off.totalATK).toBeCloseTo(0.72 * off.totalDEF, 3);
    expect(on.element).toBe('geo');
  });

  it('Ayaka Senho: Cryo normals', () => {
    for (const r of rows(withStates('ayaka', ['ayaka-sprint'])).values())
      if (r.text === undefined && (r.group === 'normal' || r.group === 'charged')) expect(r.element).toBe('cryo');
  });
});

describe('URL', () => {
  it('states and their inputs round-trip; unknown ids are dropped', () => {
    const defaults = defaultsFor(char('raiden-shogun'));
    const d = { ...defaults, stateOn: ['raiden-e', 'raiden-q'], stateInputs: { 'raiden-q': 42 } };
    const back = draftFromQuery(new URLSearchParams(draftToQuery(d, defaults)), defaults);
    expect(back.stateOn).toEqual(['raiden-e', 'raiden-q']);
    expect(back.stateInputs).toEqual({ 'raiden-q': 42 });

    const junk = draftFromQuery(new URLSearchParams('ss=hu-tao-e.nope&si=raiden-q:999'), defaults);
    expect(junk.stateOn).toEqual([]);
    expect(junk.stateInputs).toEqual({ 'raiden-q': 60 });
  });
});
