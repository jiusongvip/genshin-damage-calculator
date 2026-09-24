import { RELEASED_CHARACTERS as CHARACTERS } from '../../data/characters';
import { ENEMIES } from '../../data/enemies';
import { MAIN_STATS, resolvePreset } from '../../data/presets';
import { signatureTalent } from '../../data/talents';
import type { TalentKey } from '../../data/talents';
import { talentRowsFor } from '../../data/generated/talents';
import type { TalentGroup } from '../../data/generated/talents';
import { CONSTELLATION_TALENT_BONUS } from '../../data/generated/constellationTalents';
import { DEFAULT_PARTY } from '../../data/partyBuffs';
import type { PartyState } from '../../data/partyBuffs';
import type {
  AdditiveReaction,
  AmplifiedReaction,
  ArtifactBuild,
  ElementType,
  ScalingStat,
  SecondaryStatType,
  TransformativeReaction,
} from '../../lib/damage';

/**
 * The editable state of the calculator, plus every pure helper that reads or
 * repairs it. Split out of SingleCalculator.tsx so the view file is about the
 * view; nothing here imports React.
 */

export type CritMode = 'expected' | 'crit' | 'nonCrit';

/** Everything the user can edit, in one object so URL save/restore is trivial. */
export interface Draft {
  charId: string;
  level: number;
  weaponId: string;
  /** Weapon refinement rank 1-5. */
  weaponRefine: number;
  /** Selected passive stack count (0..maxStacks). */
  weaponStacks: number;
  enemyId: string;
  customEnemy: boolean;
  enemyLevel: number;
  /** Per-element resistance overrides on top of the selected enemy preset. */
  enemyResMap: Partial<Record<ElementType, number>>;
  attackType: TalentKey;
  skillMult: number;
  /** Per-talent levels (1-15). Charged/Plunge share the Normal level. */
  talentLevels: { normal: number; skill: number; burst: number };
  /** Row currently loaded from the damage table, if any. */
  activeRowId: string | null;
  /** Element / scaling overrides set by the picked row. */
  elementOverride: ElementType | null;
  scalingOverride: ScalingStat | null;
  statOverride: number | null;
  baseDmgBonus: number;
  flatBaseDmg: number;
  dmgBonus: number;
  naDmgBonus: number;
  caDmgBonus: number;
  skillDmgBonus: number;
  burstDmgBonus: number;
  dmgReduction: number;
  critRate: number;
  critDMG: number;
  critMode: CritMode;
  em: number;
  /** Hand-declared stat bonuses (M3 §1a) — atk/hp/def + energy recharge. */
  atkPercent: number;
  flatATK: number;
  hpPercent: number;
  flatHP: number;
  defPercent: number;
  flatDEF: number;
  er: number;
  amplified: AmplifiedReaction;
  additive: AdditiveReaction;
  transformative: TransformativeReaction;
  swirlElement: ElementType;
  reactionBonus: number;
  ampReactionBonus: number;
  transformReactionBonus: number;
  defShred: number;
  defIgnore: number;
  resShred: number;
  /** Constellation level 0-6. */
  constellation: number;
  /** Enabled ascension-passive indices. */
  passiveOn: number[];
  /** Declared teammate buffs — see data/partyBuffs.ts. Flattened onto the draft
   *  (every field 0/1 or numeric) so the URL / localStorage serializer is uniform. */
  party: PartyState;
  /** Artifact set bonuses are derived from the pieces below. */
  artifacts: ArtifactBuild;
}

export const EMPTY_SETS = { flower: '', plume: '', sands: '', goblet: '', circlet: '' };

export const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

/** Which of the three talent-level buckets a table group belongs to. */
export const bucketOf = (group: TalentGroup): 'normal' | 'skill' | 'burst' =>
  group === 'skill' ? 'skill' : group === 'burst' ? 'burst' : 'normal';

/**
 * Multiplier for an attack type at a given talent level, read from the per-hit
 * table so the headline result tracks the talent-level inputs. See attackPick
 * for which hit (or combo) that is.
 */
export function signatureMultiplierAt(
  charId: string,
  attackType: TalentKey,
  levels: { normal: number; skill: number; burst: number },
): number {
  return attackPick(charId, attackType, levels)?.multiplier ?? 0;
}

/** What the headline describes for one attack type: the multiplier plus the
 *  element, scaling and (for a single hit) the table row it came from. */
export interface AttackPick {
  multiplier: number;
  /** The table row the multiplier is, or null when it is a whole-combo sum. */
  rowId: string | null;
  element: ElementType;
  scaling: ScalingStat;
}

/**
 * The hit (or combo) an attack type stands for. The headline used to take the
 * multiplier from here but the element from the character — so Hu Tao's
 * Physical normal combo was priced as Pyro and the headline agreed with no row
 * of the table under it. Element and scaling now come from the same rows.
 *
 * Normal: the whole combo — the one group the table totals — but only when
 * every hit shares one element and scaling; otherwise its biggest row.
 * Charged / Skill / Burst: the biggest single row. Their rows are often
 * alternatives (Neuvillette's two charged forms, Hu Tao's normal vs low-HP
 * burst), so a sum would be a number no row of the table shows.
 */
export function attackPick(
  charId: string,
  attackType: TalentKey,
  levels: { normal: number; skill: number; burst: number },
): AttackPick | null {
  const rows = (talentRowsFor(charId) ?? []).filter((r) => r.isDamage && r.group === attackType);
  if (rows.length === 0) return null;
  const level = levels[bucketOf(attackType)];
  const valueOf = (r: (typeof rows)[number]) => (r.values[level - 1] ?? 0) * Math.max(1, r.hits);
  const uniform = rows.every((r) => r.element === rows[0].element && r.scaling === rows[0].scaling);
  if (attackType === 'normal' && uniform) {
    return {
      multiplier: rows.reduce((s, r) => s + valueOf(r), 0),
      rowId: null,
      element: rows[0].element,
      scaling: rows[0].scaling,
    };
  }
  const best = rows.reduce((m, r) => (valueOf(r) > valueOf(m) ? r : m), rows[0]);
  return { multiplier: valueOf(best), rowId: best.id, element: best.element, scaling: best.scaling };
}

/** The draft fields an attack type implies — what picking it (or loading it
 *  from a URL that only says `at=`) should set. */
export function attackFields(
  charId: string,
  attackType: TalentKey,
  levels: { normal: number; skill: number; burst: number },
): Pick<Draft, 'attackType' | 'skillMult' | 'activeRowId' | 'elementOverride' | 'scalingOverride'> | null {
  const pick = attackPick(charId, attackType, levels);
  if (!pick) return null;
  return {
    attackType,
    skillMult: pick.multiplier,
    activeRowId: pick.rowId,
    elementOverride: pick.element,
    scalingOverride: pick.scaling,
  };
}

/** C3 / C5 raise one combat talent by 3 — which one is per character. */
export function constellationTalentAdd(charId: string, bucket: 'normal' | 'skill' | 'burst', cn: number): number {
  const b = CONSTELLATION_TALENT_BONUS[charId] ?? {};
  return (cn >= 3 && b[3] === bucket ? 3 : 0) + (cn >= 5 && b[5] === bucket ? 3 : 0);
}

export function effectiveTalentLevels(
  charId: string,
  levels: { normal: number; skill: number; burst: number },
  cn: number,
): { normal: number; skill: number; burst: number } {
  const bump = (k: 'normal' | 'skill' | 'burst') => Math.min(15, levels[k] + constellationTalentAdd(charId, k, cn));
  return { normal: bump('normal'), skill: bump('skill'), burst: bump('burst') };
}

/** Format a non-damage row's value (seconds, energy, stacks). */
export function formatRowText(label: string, percent: boolean, value: number): string {
  if (percent) return `${(value * 100).toFixed(1)}%`;
  if (/(Duration|Interval|\bCD\b|CD$)/i.test(label)) return `${Number(value.toFixed(1))}s`;
  return `${Number(value.toFixed(2))}`;
}

export function defaultsFor(c: (typeof CHARACTERS)[number]): Draft {
  const talentLevels = { normal: 10, skill: 10, burst: 10 };
  const attackType = signatureTalent(c.id)?.key ?? 'burst';
  // No per-hit rows (the two dataset gaps): the placeholder multiplier on the
  // character, priced at the character's own element as before.
  const attack = attackFields(c.id, attackType, talentLevels) ?? {
    attackType,
    skillMult: c.skillMultiplier,
    activeRowId: null,
    elementOverride: null,
    scalingOverride: null,
  };
  return {
    charId: c.id,
    level: 90,
    weaponId: c.bestWeapon,
    weaponRefine: 1,
    weaponStacks: 0,
    enemyId: ENEMIES[0].id,
    customEnemy: false,
    enemyLevel: ENEMIES[0].level,
    enemyResMap: {},
    ...attack,
    talentLevels,
    statOverride: null,
    baseDmgBonus: 0,
    flatBaseDmg: 0,
    dmgBonus: 0,
    naDmgBonus: 0,
    caDmgBonus: 0,
    skillDmgBonus: 0,
    burstDmgBonus: 0,
    dmgReduction: 0,
    critRate: 0,
    critDMG: 0,
    critMode: 'expected',
    em: 0,
    atkPercent: 0,
    flatATK: 0,
    hpPercent: 0,
    flatHP: 0,
    defPercent: 0,
    flatDEF: 0,
    er: 0,
    amplified: 'none',
    additive: 'none',
    transformative: 'none',
    swirlElement: 'pyro',
    reactionBonus: 0,
    ampReactionBonus: 0,
    transformReactionBonus: 0,
    defShred: 0,
    defIgnore: 0,
    resShred: 0,
    constellation: 0,
    passiveOn: [],
    party: { ...DEFAULT_PARTY },
    artifacts: { ...resolvePreset(c) },
  };
}

/** Clamp every numeric field to its allowed range (used when restoring a URL). */
export function sanitize(d: Draft): Draft {
  return {
    ...d,
    level: Math.round(clamp(d.level, 1, 90)),
    weaponRefine: Math.round(clamp(d.weaponRefine ?? 1, 1, 5)),
    weaponStacks: Math.round(clamp(d.weaponStacks ?? 0, 0, 20)),
    enemyLevel: Math.round(clamp(d.enemyLevel, 1, 100)),
    enemyResMap: Object.fromEntries(
      Object.entries(d.enemyResMap ?? {}).map(([k, v]) => [k, clamp(Number(v) || 0, -1, 1)]),
    ) as Partial<Record<ElementType, number>>,
    skillMult: clamp(d.skillMult, 0, 100),
    talentLevels: {
      normal: Math.round(clamp(d.talentLevels?.normal ?? 10, 1, 15)),
      skill: Math.round(clamp(d.talentLevels?.skill ?? 10, 1, 15)),
      burst: Math.round(clamp(d.talentLevels?.burst ?? 10, 1, 15)),
    },
    statOverride: d.statOverride == null ? null : clamp(d.statOverride, 0, 1_000_000),
    baseDmgBonus: clamp(d.baseDmgBonus, -1, 10),
    flatBaseDmg: clamp(d.flatBaseDmg, 0, 1_000_000),
    dmgBonus: clamp(d.dmgBonus, 0, 20),
    naDmgBonus: clamp(d.naDmgBonus, -1, 20),
    caDmgBonus: clamp(d.caDmgBonus, -1, 20),
    skillDmgBonus: clamp(d.skillDmgBonus, -1, 20),
    burstDmgBonus: clamp(d.burstDmgBonus, -1, 20),
    dmgReduction: clamp(d.dmgReduction, 0, 1),
    critRate: clamp(d.critRate, 0, 1),
    critDMG: clamp(d.critDMG, 0, 10),
    em: clamp(d.em, 0, 3000),
    atkPercent: clamp(d.atkPercent ?? 0, -1, 20),
    flatATK: clamp(d.flatATK ?? 0, 0, 1_000_000),
    hpPercent: clamp(d.hpPercent ?? 0, -1, 20),
    flatHP: clamp(d.flatHP ?? 0, 0, 1_000_000),
    defPercent: clamp(d.defPercent ?? 0, -1, 20),
    flatDEF: clamp(d.flatDEF ?? 0, 0, 1_000_000),
    er: clamp(d.er ?? 0, -1, 20),
    reactionBonus: clamp(d.reactionBonus, 0, 10),
    ampReactionBonus: clamp(d.ampReactionBonus, 0, 10),
    transformReactionBonus: clamp(d.transformReactionBonus, 0, 10),
    defShred: clamp(d.defShred, 0, 1),
    defIgnore: clamp(d.defIgnore, 0, 1),
    resShred: clamp(d.resShred, 0, 2),
    constellation: Math.round(clamp(d.constellation ?? 0, 0, 6)),
    passiveOn: (d.passiveOn ?? []).filter((n) => Number.isInteger(n) && n >= 0 && n <= 9),
    party: {
      bennett: d.party?.bennett ? 1 : 0,
      bennettBase: clamp(d.party?.bennettBase ?? DEFAULT_PARTY.bennettBase, 0, 3000),
      bennettLevel: Math.round(clamp(d.party?.bennettLevel ?? DEFAULT_PARTY.bennettLevel, 1, 15)),
      kazuha: d.party?.kazuha ? 1 : 0,
      kazuhaEM: clamp(d.party?.kazuhaEM ?? DEFAULT_PARTY.kazuhaEM, 0, 2000),
      viridescent: d.party?.viridescent ? 1 : 0,
      partyElement: (d.party?.partyElement ?? DEFAULT_PARTY.partyElement) as ElementType,
      zhongli: d.party?.zhongli ? 1 : 0,
      noblesse: d.party?.noblesse ? 1 : 0,
      pyroResonance: d.party?.pyroResonance ? 1 : 0,
      hydroResonance: d.party?.hydroResonance ? 1 : 0,
    },
    artifacts: {
      ...d.artifacts,
      flowerHP: clamp(d.artifacts.flowerHP ?? 0, 0, 1_000_000),
      plumeATK: clamp(d.artifacts.plumeATK ?? 0, 0, 1_000_000),
      pieceSubs: Array.from({ length: 5 }, (_, i) =>
        (d.artifacts.pieceSubs?.[i] ?? []).slice(0, 4).map((sub) =>
          sub ? { type: sub.type, value: clamp(Number(sub.value) || 0, 0, 1_000_000) } : undefined,
        ),
      ),
    },
  };
}

/** The canonical main-stat value for a slot type. */
export function mainValueFor(type: SecondaryStatType): number {
  switch (type) {
    case 'atk%':
      return MAIN_STATS.atkPercent;
    case 'hp%':
      return MAIN_STATS.hpPercent;
    case 'def%':
      return MAIN_STATS.defPercent;
    case 'em':
      return MAIN_STATS.em;
    case 'er':
      return MAIN_STATS.er;
    case 'critRate':
      return MAIN_STATS.critRate;
    case 'critDMG':
      return MAIN_STATS.critDMG;
    case 'dmg%':
      return MAIN_STATS.dmgBonus;
    case 'physical':
      return MAIN_STATS.physical;
    default:
      return 0;
  }
}

/** Human label for a main stat value, e.g. "46.6%" or "187". */
export function formatMainValue(type: SecondaryStatType): string {
  const v = mainValueFor(type);
  return ['atk%', 'hp%', 'def%', 'critRate', 'critDMG', 'dmg%', 'physical', 'er'].includes(type)
    ? `${(v * 100).toFixed(1)}%`
    : `${Math.round(v)}`;
}

// ---------------------------------------------------------------------------
// URL (de)serialisation
//
// The calculator's whole editable state lives in the address bar so a share
// link reproduces the exact panel. Both directions are pure so the e2e reload
// test, the local-save feature, and the round-trip test share one source of
// truth. A field is only written when it differs from the character's default,
// which keeps a fresh link short.
// ---------------------------------------------------------------------------

const encSubs = (subs: Draft['artifacts']['pieceSubs']): string =>
  (subs ?? [])
    .map((piece) => (piece ?? []).filter(Boolean).map((s) => `${s!.type}~${s!.value}`).join(','))
    .join(';');

const encSets = (sets: Draft['artifacts']['sets']): string =>
  [sets?.flower ?? '', sets?.plume ?? '', sets?.sands ?? '', sets?.goblet ?? '', sets?.circlet ?? ''].join(',');

const encResMap = (map: Partial<Record<ElementType, number>>): string =>
  Object.entries(map ?? {})
    .filter(([, v]) => v != null)
    .map(([k, v]) => `${k}:${v}`)
    .join(',');

/** URL value for an explicitly empty row / element / scaling override. */
const NONE = '-';

/** The multiplier the reader derives when `sm` is absent — writer and reader must agree. */
function derivedSkillMult(charId: string, attackType: TalentKey, levels: Draft['talentLevels'], fallback: number): number {
  return signatureMultiplierAt(charId, attackType, levels) || fallback;
}

/** Serialise a draft to a query string (no leading `?`), omitting default values. */
export function draftToQuery(draft: Draft, defaults: Draft): string {
  const p = new URLSearchParams();
  const put = (k: string, v: string | number | null | undefined) => {
    if (v === null || v === undefined || v === '') return;
    p.set(k, String(v));
  };
  // A numeric field is written only when it departs from the default (± float noise).
  const num = (k: string, v: number, d: number) => {
    if (Math.abs(v - d) > 1e-9) put(k, Number(v.toFixed(6)));
  };

  put('c', draft.charId === defaults.charId ? null : draft.charId);
  num('lv', draft.level, defaults.level);
  put('w', draft.weaponId === defaults.weaponId ? null : draft.weaponId);
  num('wr', draft.weaponRefine, defaults.weaponRefine);
  num('ws', draft.weaponStacks, defaults.weaponStacks);
  put('e', draft.enemyId === defaults.enemyId ? null : draft.enemyId);
  if (draft.customEnemy) put('el', draft.enemyLevel);
  if (draft.enemyResMap && Object.keys(draft.enemyResMap).length) put('erm', encResMap(draft.enemyResMap));
  put('at', draft.attackType === defaults.attackType ? null : draft.attackType);
  const derived = derivedSkillMult(draft.charId, draft.attackType, draft.talentLevels, defaults.skillMult);
  num('sm', draft.skillMult, derived);
  const tl = draft.talentLevels;
  const dtl = defaults.talentLevels;
  if (tl.normal !== dtl.normal || tl.skill !== dtl.skill || tl.burst !== dtl.burst)
    put('tl', `${tl.normal}.${tl.skill}.${tl.burst}`);
  // Row / element / scaling are implied by the attack type; write them only
  // when the draft departs from that, with '-' for an explicit "none".
  const implied = attackFields(draft.charId, draft.attackType, draft.talentLevels);
  const orNone = (v: string | null) => v ?? NONE;
  if (draft.activeRowId !== (implied?.activeRowId ?? null)) put('row', orNone(draft.activeRowId));
  if (draft.elementOverride !== (implied?.elementOverride ?? null)) put('ce', orNone(draft.elementOverride));
  if (draft.scalingOverride !== (implied?.scalingOverride ?? null)) put('cs', orNone(draft.scalingOverride));
  if (draft.statOverride != null) put('st', draft.statOverride);
  num('bd', draft.baseDmgBonus, defaults.baseDmgBonus);
  num('fb', draft.flatBaseDmg, defaults.flatBaseDmg);
  num('db', draft.dmgBonus, defaults.dmgBonus);
  num('na', draft.naDmgBonus, defaults.naDmgBonus);
  num('ca', draft.caDmgBonus, defaults.caDmgBonus);
  num('sk', draft.skillDmgBonus, defaults.skillDmgBonus);
  num('bu', draft.burstDmgBonus, defaults.burstDmgBonus);
  num('dr', draft.dmgReduction, defaults.dmgReduction);
  num('cr', draft.critRate, defaults.critRate);
  num('cd', draft.critDMG, defaults.critDMG);
  put('cm', draft.critMode === 'expected' ? null : draft.critMode);
  num('em', draft.em, defaults.em);
  num('ap', draft.atkPercent, defaults.atkPercent);
  num('fa', draft.flatATK, defaults.flatATK);
  num('hp', draft.hpPercent, defaults.hpPercent);
  num('fh', draft.flatHP, defaults.flatHP);
  num('dp', draft.defPercent, defaults.defPercent);
  num('fd', draft.flatDEF, defaults.flatDEF);
  num('er', draft.er, defaults.er);
  put('amp', draft.amplified === 'none' ? null : draft.amplified);
  put('ad', draft.additive === 'none' ? null : draft.additive);
  put('tr', draft.transformative === 'none' ? null : draft.transformative);
  put('se', draft.swirlElement === defaults.swirlElement ? null : draft.swirlElement);
  num('rb', draft.reactionBonus, defaults.reactionBonus);
  num('arb', draft.ampReactionBonus, defaults.ampReactionBonus);
  num('trb', draft.transformReactionBonus, defaults.transformReactionBonus);
  num('ds', draft.defShred, defaults.defShred);
  num('di', draft.defIgnore, defaults.defIgnore);
  num('rs', draft.resShred, defaults.resShred);
  num('cn', draft.constellation, defaults.constellation);
  if (draft.passiveOn.length) put('pv', draft.passiveOn.join('.'));
  const pq = draft.party, pd = defaults.party;
  if (pq.bennett) put('pb', 1);
  num('pbb', pq.bennettBase, pd.bennettBase);
  num('pbl', pq.bennettLevel, pd.bennettLevel);
  if (pq.kazuha) put('pk', 1);
  num('pke', pq.kazuhaEM, pd.kazuhaEM);
  if (pq.viridescent) put('vv', 1);
  put('pwe', pq.partyElement === pd.partyElement ? null : pq.partyElement);
  if (pq.zhongli) put('zl', 1);
  if (pq.noblesse) put('nb', 1);
  if (pq.pyroResonance) put('rp', 1);
  if (pq.hydroResonance) put('rh', 1);
  put('sand', draft.artifacts.sandsMain.type === defaults.artifacts.sandsMain.type ? null : draft.artifacts.sandsMain.type);
  put('gob', draft.artifacts.gobletMain.type === defaults.artifacts.gobletMain.type ? null : draft.artifacts.gobletMain.type);
  put('circ', draft.artifacts.circletMain.type === defaults.artifacts.circletMain.type ? null : draft.artifacts.circletMain.type);
  const ps = encSets(draft.artifacts.sets);
  if (ps !== encSets(defaults.artifacts.sets)) p.set('ps', ps);
  const subs = encSubs(draft.artifacts.pieceSubs);
  if (subs !== encSubs(defaults.artifacts.pieceSubs)) p.set('subs', subs);
  return p.toString();
}

/** Rebuild a sanitized draft from a query string, filling gaps from the character defaults. */
export function draftFromQuery(params: URLSearchParams, defaults: Draft): Draft {
  const num = (k: string, fallback: number) => {
    const v = parseFloat(params.get(k) ?? '');
    return Number.isFinite(v) ? v : fallback;
  };
  const charId = params.get('c') ?? defaults.charId;
  const restoredAttack = (params.get('at') as TalentKey) ?? defaults.attackType;
  const tlParts = (params.get('tl') ?? '').split('.').map((x) => parseInt(x, 10));
  const restoredLevels = {
    normal: Number.isFinite(tlParts[0]) ? clamp(tlParts[0], 1, 15) : defaults.talentLevels.normal,
    skill: Number.isFinite(tlParts[1]) ? clamp(tlParts[1], 1, 15) : defaults.talentLevels.skill,
    burst: Number.isFinite(tlParts[2]) ? clamp(tlParts[2], 1, 15) : defaults.talentLevels.burst,
  };
  const implied = attackFields(charId, restoredAttack, restoredLevels);
  const readImplied = (k: string, fallback: string | null | undefined): string | null => {
    const v = params.get(k);
    if (v === NONE) return null;
    return v ?? fallback ?? null;
  };
  return sanitize({
    ...defaults,
    charId,
    level: num('lv', defaults.level),
    weaponId: params.get('w') ?? defaults.weaponId,
    weaponRefine: num('wr', defaults.weaponRefine),
    weaponStacks: num('ws', defaults.weaponStacks),
    enemyId: params.get('e') ?? defaults.enemyId,
    customEnemy: params.has('el'),
    enemyLevel: num('el', defaults.enemyLevel),
    enemyResMap: Object.fromEntries(
      (params.get('erm') ?? '')
        .split(',')
        .map((pair) => pair.split(':'))
        .filter((kv) => kv.length === 2 && kv[1] !== '')
        .map(([k, v]) => [k, clamp(parseFloat(v) || 0, -1, 1)]),
    ) as Partial<Record<ElementType, number>>,
    attackType: restoredAttack,
    skillMult: params.has('sm')
      ? num('sm', defaults.skillMult)
      : derivedSkillMult(charId, restoredAttack, restoredLevels, defaults.skillMult),
    talentLevels: restoredLevels,
    activeRowId: readImplied('row', implied?.activeRowId),
    elementOverride: readImplied('ce', implied?.elementOverride) as ElementType | null,
    scalingOverride: readImplied('cs', implied?.scalingOverride) as ScalingStat | null,
    statOverride: params.has('st') ? num('st', 0) : null,
    baseDmgBonus: num('bd', defaults.baseDmgBonus),
    flatBaseDmg: num('fb', defaults.flatBaseDmg),
    dmgBonus: num('db', defaults.dmgBonus),
    naDmgBonus: num('na', defaults.naDmgBonus),
    caDmgBonus: num('ca', defaults.caDmgBonus),
    skillDmgBonus: num('sk', defaults.skillDmgBonus),
    burstDmgBonus: num('bu', defaults.burstDmgBonus),
    dmgReduction: num('dr', defaults.dmgReduction),
    critRate: num('cr', defaults.critRate),
    critDMG: num('cd', defaults.critDMG),
    critMode: (params.get('cm') as CritMode) ?? defaults.critMode,
    em: num('em', defaults.em),
    atkPercent: num('ap', defaults.atkPercent),
    flatATK: num('fa', defaults.flatATK),
    hpPercent: num('hp', defaults.hpPercent),
    flatHP: num('fh', defaults.flatHP),
    defPercent: num('dp', defaults.defPercent),
    flatDEF: num('fd', defaults.flatDEF),
    er: num('er', defaults.er),
    amplified: (params.get('amp') as AmplifiedReaction) ?? defaults.amplified,
    additive: (params.get('ad') as AdditiveReaction) ?? defaults.additive,
    transformative: (params.get('tr') as TransformativeReaction) ?? defaults.transformative,
    swirlElement: (params.get('se') as ElementType) ?? defaults.swirlElement,
    reactionBonus: num('rb', defaults.reactionBonus),
    ampReactionBonus: num('arb', defaults.ampReactionBonus),
    transformReactionBonus: num('trb', defaults.transformReactionBonus),
    defShred: num('ds', defaults.defShred),
    defIgnore: num('di', defaults.defIgnore),
    resShred: num('rs', defaults.resShred),
    constellation: num('cn', defaults.constellation),
    passiveOn: (params.get('pv') ?? '')
      .split('.')
      .map((x) => parseInt(x, 10))
      .filter((n) => Number.isInteger(n) && n >= 0),
    party: {
      bennett: params.get('pb') === '1' ? 1 : defaults.party.bennett,
      bennettBase: num('pbb', defaults.party.bennettBase),
      bennettLevel: num('pbl', defaults.party.bennettLevel),
      kazuha: params.get('pk') === '1' ? 1 : defaults.party.kazuha,
      kazuhaEM: num('pke', defaults.party.kazuhaEM),
      viridescent: params.get('vv') === '1' ? 1 : defaults.party.viridescent,
      partyElement: (params.get('pwe') as ElementType) ?? defaults.party.partyElement,
      zhongli: params.get('zl') === '1' ? 1 : defaults.party.zhongli,
      noblesse: params.get('nb') === '1' ? 1 : defaults.party.noblesse,
      pyroResonance: params.get('rp') === '1' ? 1 : defaults.party.pyroResonance,
      hydroResonance: params.get('rh') === '1' ? 1 : defaults.party.hydroResonance,
    },
    artifacts: {
      ...defaults.artifacts,
      sandsMain: params.has('sand')
        ? { type: params.get('sand') as SecondaryStatType, value: mainValueFor(params.get('sand') as SecondaryStatType) }
        : { ...defaults.artifacts.sandsMain },
      gobletMain: params.has('gob')
        ? { type: params.get('gob') as SecondaryStatType, value: mainValueFor(params.get('gob') as SecondaryStatType) }
        : { ...defaults.artifacts.gobletMain },
      circletMain: params.has('circ')
        ? { type: params.get('circ') as SecondaryStatType, value: mainValueFor(params.get('circ') as SecondaryStatType) }
        : { ...defaults.artifacts.circletMain },
      sets: params.has('ps')
        ? (() => {
            const parts = (params.get('ps') ?? '').split(',');
            return { flower: parts[0] ?? '', plume: parts[1] ?? '', sands: parts[2] ?? '', goblet: parts[3] ?? '', circlet: parts[4] ?? '' };
          })()
        : { ...(defaults.artifacts.sets ?? EMPTY_SETS) },
      pieceSubs: params.has('subs')
        ? (params.get('subs') ?? '').split(';').map((piece) =>
            piece
              .split(',')
              .filter(Boolean)
              .map((entry) => {
                const [type, value] = entry.split('~');
                return { type: type as SecondaryStatType, value: clamp(parseFloat(value) || 0, 0, 1_000_000) };
              }),
          )
        : (defaults.artifacts.pieceSubs ?? []),
    },
  });
}
