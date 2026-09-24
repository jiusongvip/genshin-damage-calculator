// ============================================================================
// The one source of truth for the calculator's per-hit damage table.
//
// Both the interactive React calculator and the static /characters/<id>/ pages
// call assembleDamageGroups, so the numbers on a rendered page are exactly what
// the calculator shows for the same build — there is no second copy of the
// row→engine math to drift out of sync.
//
// Kept React-free on purpose: this runs at build time inside getStaticPaths.
// ============================================================================

import { addBuffs, computeDamage } from './damage';
import type {
  AdditiveReaction,
  AmplifiedReaction,
  ArtifactBuild,
  BuffState,
  CharacterData,
  ElementType,
  EnemyData,
  TransformativeReaction,
  WeaponData,
} from './damage';
import type { SetPick } from '../data/artifactSets';
import { resolveSetBuffs } from '../data/artifactSets';
import type { PartyState } from '../data/partyBuffs';
import { DEFAULT_PARTY, resolvePartyBuffs } from '../data/partyBuffs';
import { scopedBuffs, scopedSelfBuffs } from '../data/constellations';
import { infusedElement, stateEffects, stateRowBonus } from '../data/selfStates';
import { talentRowsFor } from '../data/generated/talents';
import type { TalentGroup } from '../data/generated/talents';
import { rowAttackType } from '../components/calculator/constants';
import { bucketOf, formatRowText } from '../components/calculator/draft';

export interface DamageRowVm {
  id: string;
  label: string;
  group: TalentGroup;
  element: ElementType;
  /** Multiplier used for this hit at the current talent level. */
  value: number;
  nonCrit: number;
  crit: number;
  expected: number;
  /** Baseline expected damage for the same row (Diff mode), when available. */
  diff?: number;
  /** Display-only rows (CD, Duration, Energy) carry a text value. */
  text?: string;
  active: boolean;
}

export interface DamageGroupVm {
  group: TalentGroup;
  label: string;
  rows: DamageRowVm[];
  total: { nonCrit: number; crit: number; expected: number; diff?: number } | null;
}

export const GROUP_LABEL: Record<TalentGroup, string> = {
  normal: 'Normal Attack',
  charged: 'Charged Attack',
  plunge: 'Plunging Attack',
  skill: 'Elemental Skill',
  burst: 'Elemental Burst',
};

const ORDER: TalentGroup[] = ['normal', 'charged', 'plunge', 'skill', 'burst'];

export interface AssembleInput {
  character: CharacterData;
  weapon: WeaponData;
  artifacts: ArtifactBuild;
  /** Buffs excluding artifact-set bonuses; set bonuses fold in per row. */
  baseBuffs: BuffState;
  setPicks: SetPick[];
  /** Declared teammate buffs, resolved per row element. Omitted = none. */
  party?: PartyState;
  enemy: EnemyData;
  level: number;
  /** Effective per-talent levels (already C3/C5-bumped), 1-15. */
  effLevels: { normal: number; skill: number; burst: number };
  amplified: AmplifiedReaction;
  additive: AdditiveReaction;
  transformative: TransformativeReaction;
  swirlElement?: ElementType;
  activeRowId?: string | null;
  /** Constellation and toggled passives, for their element- / attack-limited
   *  effects (the unlimited ones are already in baseBuffs). Omitted = none. */
  constellation?: number;
  passiveOn?: number[];
  /** Declared self-states and their inputs (data/selfStates.ts). Omitted = none. */
  stateOn?: string[];
  stateInputs?: Record<string, number>;
}

/**
 * Turn a character's per-hit talent rows into grouped damage rows at the given
 * talent levels and build. Mirrors the calculator's load state exactly: only the
 * engine call and its inputs, no view concerns.
 */
export function assembleDamageGroups(input: AssembleInput): DamageGroupVm[] {
  const {
    character,
    weapon,
    artifacts,
    baseBuffs,
    setPicks,
    enemy,
    level,
    effLevels,
    amplified,
    additive,
    transformative,
    activeRowId = null,
  } = input;
  const swirlElement = input.swirlElement ?? 'pyro';
  const party = input.party ?? DEFAULT_PARTY;

  const talentRows = talentRowsFor(character.id) ?? [];
  const map = new Map<TalentGroup, DamageRowVm[]>();
  for (const g of ORDER) map.set(g, []);
  const levelForGroup = (group: TalentGroup) => effLevels[bucketOf(group)];

  const stateOn = input.stateOn ?? [];
  const stateInputs = input.stateInputs ?? {};
  const states = stateEffects(character.id, stateOn, stateInputs, effLevels);

  for (const row of talentRows) {
    const value = row.values[levelForGroup(row.group) - 1] ?? 0;
    const hits = Math.max(1, row.hits);
    // A declared infusion turns Physical Normal / Charged / Plunging hits elemental.
    const element = infusedElement(character.id, stateOn, row.group, row.element);
    let vm: DamageRowVm;
    if (!row.isDamage) {
      vm = {
        id: row.id,
        label: row.label,
        group: row.group,
        element: row.element,
        value,
        nonCrit: 0,
        crit: 0,
        expected: 0,
        text: formatRowText(row.label, row.percent, value),
        active: false,
      };
    } else {
      const attack = rowAttackType(character.id, row);
      const hit = { element, attack, label: row.label };
      const r = computeDamage({
        character,
        weapon,
        artifacts,
        buffs: addBuffs(
          baseBuffs,
          resolveSetBuffs(setPicks, element, attack),
          resolvePartyBuffs(party, element),
          scopedSelfBuffs(character.id, input.constellation ?? 0, input.passiveOn ?? [], hit),
          scopedBuffs(states, hit),
        ),
        enemy,
        characterLevel: level,
        attackType: attack,
        skillMultiplier: value * hits + stateRowBonus(character.id, stateOn, stateInputs, effLevels, row),
        element,
        scaling: row.scaling,
        amplified,
        additive,
        transformative,
        swirlElement: transformative === 'swirl' ? swirlElement : undefined,
      });
      vm = {
        id: row.id,
        label: hits > 1 ? `${row.label} ×${hits}` : row.label,
        group: row.group,
        element,
        value: value * hits,
        nonCrit: r.nonCrit,
        crit: r.critHit,
        expected: r.expected,
        active: row.id === activeRowId,
      };
    }
    map.get(row.group)!.push(vm);
  }

  return ORDER.filter((g) => map.get(g)!.length > 0).map((g) => {
    const rows = map.get(g)!;
    const dmg = rows.filter((r) => r.text === undefined);
    // Only the Normal Attack combo has a meaningful "Total DMG": a Skill or
    // Burst can list alternative hits (e.g. Hu Tao's normal vs low-HP burst)
    // that never all land together.
    const total =
      g === 'normal' && dmg.length > 0
        ? dmg.reduce(
            (a, r) => ({ nonCrit: a.nonCrit + r.nonCrit, crit: a.crit + r.crit, expected: a.expected + r.expected }),
            { nonCrit: 0, crit: 0, expected: 0 },
          )
        : null;
    return { group: g, label: GROUP_LABEL[g], rows, total };
  });
}
