// ============================================================================
// Draft → resolved build.
//
// The single source of truth that turns an editable Draft into the concrete
// character / weapon / enemy and the pre-set buff state (baseBuffs) the engine
// needs. Both the interactive calculator and the localStorage "Compare against
// a saved scenario" flow call this, so a saved panel diffs against exactly what
// the live panel would show. Artifact-set and party buffs are element-scoped,
// so they are resolved per row elsewhere and are intentionally NOT folded here.
//
// React-free: nothing here touches the DOM or hooks.
// ============================================================================

import { RELEASED_CHARACTERS as CHARACTERS } from '../data/characters';
import { weaponsForType } from '../data/weapons';
import { ENEMIES } from '../data/enemies';
import { DEFAULT_BUFFS, NO_ARTIFACTS, setPicksFromPieces } from '../data/presets';
import { weaponBuffAt } from '../data/weaponPassives';
import { scopedBuffs, scopedSelfBuffs, unscopedBuffs, unscopedSelfBuffs } from '../data/constellations';
import { infusedElement, stateEffects, stateRowBonus } from '../data/selfStates';
import { talentRowsFor } from '../data/generated/talents';
import { addBuffs, computeDamage } from './damage';
import type { BuffState, CharacterData, DamageResult, ElementType, EnemyData, ScalingStat, WeaponData } from './damage';
import { resolveSetBuffs } from '../data/artifactSets';
import type { SetPick } from '../data/artifactSets';
import { resolvePartyBuffs } from '../data/partyBuffs';
import { assembleDamageGroups } from './damage-groups';
import type { DamageGroupVm } from './damage-groups';
import type { Draft } from '../components/calculator/draft';
import { effectiveTalentLevels } from '../components/calculator/draft';

export interface DraftBuild {
  character: CharacterData;
  weaponOptions: WeaponData[];
  weapon: WeaponData;
  enemy: EnemyData;
  /** Character + weapon + the user's artifacts, no zone bonuses — the zone floor. */
  whiteboard: DamageResult;
  /** Character + weapon + ascension only — the "own stats" floor. */
  ownEM: number;
  scaling: ScalingStat;
  /** Everything except element-scoped (set / party) bonuses and the weapon's own passive. */
  baseBuffs: BuffState;
  setPicks: SetPick[];
  effLevels: { normal: number; skill: number; burst: number };
}

/** Resolve a draft into the concrete build the damage engine consumes. */
export function resolveBuild(draft: Draft): DraftBuild {
  const character = CHARACTERS.find((c) => c.id === draft.charId) ?? CHARACTERS[0];
  const weaponOptions = weaponsForType(character.weaponType);
  const weapon = weaponOptions.find((w) => w.id === draft.weaponId) ?? weaponOptions[0];
  const baseEnemy = ENEMIES.find((e) => e.id === draft.enemyId) ?? ENEMIES[0];
  const enemy: EnemyData = {
    ...baseEnemy,
    level: draft.customEnemy ? draft.enemyLevel : baseEnemy.level,
    resistances: { ...baseEnemy.resistances, ...draft.enemyResMap },
  };
  const scaling = (character.scaling ?? 'atk') as ScalingStat;

  const whiteboard = computeDamage({
    character,
    weapon,
    artifacts: draft.artifacts,
    buffs: DEFAULT_BUFFS,
    enemy,
    characterLevel: draft.level,
    amplified: 'none',
    transformative: 'none',
  });

  const own = computeDamage({
    character,
    weapon,
    artifacts: NO_ARTIFACTS,
    buffs: DEFAULT_BUFFS,
    enemy,
    characterLevel: draft.level,
    amplified: 'none',
    transformative: 'none',
  });

  const effLevels = effectiveTalentLevels(character.id, draft.talentLevels, draft.constellation);
  const patches: Partial<BuffState>[] = [
    // Element- / attack-limited effects are resolved per hit (headlineBuffs,
    // damage-groups.ts), not folded here.
    unscopedSelfBuffs(character.id, draft.constellation, draft.passiveOn),
    unscopedBuffs(stateEffects(character.id, draft.stateOn, draft.stateInputs, effLevels)),
    { dmgBonus: draft.dmgBonus, dmgReduction: draft.dmgReduction },
    {
      naDmgBonus: draft.naDmgBonus,
      caDmgBonus: draft.caDmgBonus,
      skillDmgBonus: draft.skillDmgBonus,
      burstDmgBonus: draft.burstDmgBonus,
    },
    { baseDmgBonus: draft.baseDmgBonus, flatBaseDmg: draft.flatBaseDmg },
    // CRIT and EM are bonuses added on top of the character's own stats, so the
    // base can never be typed below its real value.
    { critRate: draft.critRate, critDMG: draft.critDMG, em: draft.em },
    {
      atkPercent: draft.atkPercent,
      flatATK: draft.flatATK,
      hpPercent: draft.hpPercent,
      flatHP: draft.flatHP,
      defPercent: draft.defPercent,
      flatDEF: draft.flatDEF,
      er: draft.er,
    },
    {
      reactionBonus: draft.reactionBonus,
      ampReactionBonus: draft.ampReactionBonus,
      transformReactionBonus: draft.transformReactionBonus,
    },
    { defShred: draft.defShred, defIgnore: draft.defIgnore, resShred: draft.resShred },
  ];
  if (draft.statOverride != null && scaling !== 'em') {
    const delta = draft.statOverride - whiteboard.baseStat;
    if (scaling === 'hp') patches.push({ flatHP: delta });
    else if (scaling === 'def') patches.push({ flatDEF: delta });
    else patches.push({ flatATK: delta });
  }
  const nonWeaponBuffs = addBuffs(DEFAULT_BUFFS, ...patches);
  const baseBuffs = addBuffs(nonWeaponBuffs, weaponBuffAt(draft.weaponId, draft.weaponRefine, draft.weaponStacks));
  const setPicks = setPicksFromPieces(draft.artifacts.sets ?? {});

  return { character, weaponOptions, weapon, enemy, whiteboard, ownEM: own.em, scaling, baseBuffs, setPicks, effLevels };
}

/**
 * A draft's full per-hit damage table — the same rows the Damage tab shows.
 * Reused by "Compare against a saved scenario" so a stored panel produces an
 * identical baseline to what it would render live, without mounting it.
 */
export function draftToGroups(draft: Draft, build: DraftBuild = resolveBuild(draft)): DamageGroupVm[] {
  return assembleDamageGroups({
    character: build.character,
    weapon: build.weapon,
    artifacts: draft.artifacts,
    baseBuffs: build.baseBuffs,
    setPicks: build.setPicks,
    party: draft.party,
    enemy: build.enemy,
    level: draft.level,
    effLevels: build.effLevels,
    amplified: draft.amplified,
    additive: draft.additive,
    transformative: draft.transformative,
    swirlElement: draft.swirlElement,
    activeRowId: draft.activeRowId,
    constellation: draft.constellation,
    passiveOn: draft.passiveOn,
    stateOn: draft.stateOn,
    stateInputs: draft.stateInputs,
  });
}

/** The talent row the headline stands for, if it is a single row. */
function headlineRow(draft: Draft, build: DraftBuild) {
  return draft.activeRowId ? talentRowsFor(build.character.id)?.find((r) => r.id === draft.activeRowId) : undefined;
}

/** The element the headline hit deals, after any declared infusion. */
export function headlineElement(draft: Draft, build: DraftBuild = resolveBuild(draft)): ElementType {
  const element = draft.elementOverride ?? build.character.element;
  const row = headlineRow(draft, build);
  // A whole-combo headline (no row) is a Normal Attack; a loaded row knows its group.
  const group = row?.group ?? (draft.attackType === 'charged' ? 'charged' : draft.attackType === 'normal' ? 'normal' : 'skill');
  return infusedElement(build.character.id, draft.stateOn, group, element);
}

/** The buffs the headline hit sees: the build's base buffs plus the set,
 *  party, self and state bonuses scoped to the hit it describes. */
export function headlineBuffs(draft: Draft, build: DraftBuild = resolveBuild(draft)): BuffState {
  const element = headlineElement(draft, build);
  const hit = { element, attack: draft.attackType, label: headlineRow(draft, build)?.label };
  return addBuffs(
    build.baseBuffs,
    resolveSetBuffs(build.setPicks, element, draft.attackType),
    resolvePartyBuffs(draft.party, element),
    scopedSelfBuffs(build.character.id, draft.constellation, draft.passiveOn, hit),
    scopedBuffs(stateEffects(build.character.id, draft.stateOn, draft.stateInputs, build.effLevels), hit),
  );
}

/**
 * The headline hit for a draft — the calculator's Expected number. The home
 * page cards and the character pages call this too, so a character shows one
 * number everywhere instead of one per code path.
 */
export function draftHeadline(
  draft: Draft,
  build: DraftBuild = resolveBuild(draft),
  buffs: BuffState = headlineBuffs(draft, build),
): DamageResult {
  const row = headlineRow(draft, build);
  const stateBonus = row
    ? stateRowBonus(build.character.id, draft.stateOn, draft.stateInputs, build.effLevels, row)
    : 0;
  return computeDamage({
    character: build.character,
    weapon: build.weapon,
    artifacts: draft.artifacts,
    buffs,
    enemy: build.enemy,
    characterLevel: draft.level,
    attackType: draft.attackType,
    skillMultiplier: draft.skillMult + stateBonus,
    element: headlineElement(draft, build),
    scaling: draft.scalingOverride ?? undefined,
    amplified: draft.amplified,
    additive: draft.additive,
    transformative: draft.transformative,
    swirlElement: draft.transformative === 'swirl' ? draft.swirlElement : undefined,
  });
}
