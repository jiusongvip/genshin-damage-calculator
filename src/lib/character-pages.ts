// ============================================================================
// Build-time data for the static /characters/<id>/ pages.
//
// Every number here is produced by the SAME engine path the calculator uses for
// its default load state (defaultsFor → assembleDamageGroups), so a rendered
// page and /?c=<id> agree row for row. React-free: this runs inside getStaticPaths.
// ============================================================================

import { ENEMIES } from '../data/enemies';
import { getWeapon, weaponsForType } from '../data/weapons';
import { DEFAULT_BUFFS, resolvePreset, resolveSetPicks, setPicksFromPieces } from '../data/presets';
import { resolveSetBuffs } from '../data/artifactSets';
import { weaponBuffAt } from '../data/weaponPassives';
import { WEAPON_PASSIVE_EFFECTS } from '../data/weaponPassives';
import { talentRowsFor } from '../data/generated/talents';
import { constellationsFor, passivesFor } from '../data/generated/constellations';
import type { ConstellationEntry, PassiveEntry } from '../data/generated/constellations';
import { CONSTELLATION_EFFECTS, PASSIVE_EFFECTS } from '../data/constellations';
import { CONSTELLATION_TALENT_BONUS } from '../data/generated/constellationTalents';
import { signatureTalent } from '../data/talents';
import type { TalentKey } from '../data/talents';
import { addBuffs, computeDamage, formatNumber } from './damage';
import { ELEMENT_LABEL } from '../data/elements';
import type { CharacterData, WeaponData } from './damage';
import { assembleDamageGroups } from './damage-groups';
import type { DamageGroupVm } from './damage-groups';
import { defaultsFor, effectiveTalentLevels } from '../components/calculator/draft';

export interface WeaponPick {
  weapon: WeaponData;
  /** Signature-attack expected damage with this weapon at R1 / 0 stacks. */
  expected: number;
  /** Whether the weapon's passive feeds the engine (else the number omits it). */
  passiveModelled: boolean;
  equipped: boolean;
}

export interface ConstellationVm extends ConstellationEntry {
  modeled: boolean;
}

export interface PassiveVm extends PassiveEntry {
  modeled: boolean;
}

export interface CharacterPageData {
  character: CharacterData;
  groups: DamageGroupVm[];
  signatureLabel: string;
  weaponName: string;
  constellations: ConstellationVm[];
  passives: PassiveVm[];
  weapons: WeaponPick[];
  calcHref: string;
  title: string;
  description: string;
}

/** True when a /characters/<id>/ page exists: released and has per-hit rows. */
export function hasPage(id: string): boolean {
  return (talentRowsFor(id)?.length ?? 0) > 0;
}

/** Characters we can publish: released AND with per-hit talent rows to compute from. */
export function hasPublishableData(c: CharacterData): boolean {
  return !c.unreleased && hasPage(c.id);
}

/** The buff inputs the calculator uses when a page loads with only ?c=<id>. */
function defaultContext(c: CharacterData) {
  const draft = defaultsFor(c);
  const weapon = getWeapon(draft.weaponId)!;
  const artifacts = resolvePreset(c);
  const setPicks = setPicksFromPieces(artifacts.sets ?? {});
  const baseBuffs = addBuffs(DEFAULT_BUFFS, weaponBuffAt(draft.weaponId, draft.weaponRefine, draft.weaponStacks));
  const effLevels = effectiveTalentLevels(c.id, draft.talentLevels, draft.constellation);
  const enemy = ENEMIES.find((e) => e.id === draft.enemyId) ?? ENEMIES[0];
  return { draft, weapon, artifacts, setPicks, baseBuffs, effLevels, enemy };
}

/** Signature-attack expected damage for a character holding a specific weapon. */
function headlineWithWeapon(c: CharacterData, w: WeaponData, attackType: TalentKey, skillMult: number): number {
  const ctx = defaultContext(c);
  const buffs = addBuffs(
    DEFAULT_BUFFS,
    weaponBuffAt(w.id, 1, 0),
    resolveSetBuffs(resolveSetPicks(c), c.element, attackType),
  );
  const r = computeDamage({
    character: c,
    weapon: w,
    artifacts: ctx.artifacts,
    buffs,
    enemy: ctx.enemy,
    characterLevel: 90,
    attackType,
    skillMultiplier: skillMult,
    amplified: 'none',
    transformative: 'none',
  });
  return r.expected;
}

export function buildCharacterPageData(c: CharacterData): CharacterPageData {
  const ctx = defaultContext(c);
  const groups = assembleDamageGroups({
    character: c,
    weapon: ctx.weapon,
    artifacts: ctx.artifacts,
    baseBuffs: ctx.baseBuffs,
    setPicks: ctx.setPicks,
    enemy: ctx.enemy,
    level: ctx.draft.level,
    effLevels: ctx.effLevels,
    amplified: ctx.draft.amplified,
    additive: ctx.draft.additive,
    transformative: ctx.draft.transformative,
    swirlElement: ctx.draft.swirlElement,
    activeRowId: ctx.draft.activeRowId,
  });

  const sig = signatureTalent(c.id);
  const attackType = sig?.key ?? 'burst';
  const skillMult = ctx.draft.skillMult;
  const ranked = weaponsForType(c.weaponType)
    .map((w) => ({
      weapon: w,
      expected: headlineWithWeapon(c, w, attackType, skillMult),
      passiveModelled: !!WEAPON_PASSIVE_EFFECTS[w.id],
      equipped: w.id === c.bestWeapon,
    }))
    .sort((a, b) => b.expected - a.expected);
  // Show the strongest options, but always keep the preset weapon the page
  // actually loads with visible — the reader needs its reference point.
  const weapons = ranked.slice(0, 6);
  if (!weapons.some((w) => w.equipped)) {
    const equipped = ranked.find((w) => w.equipped);
    if (equipped) weapons.push(equipped);
  }

  const consModelled = CONSTELLATION_EFFECTS[c.id] ?? {};
  const passiveModelled = PASSIVE_EFFECTS[c.id] ?? {};
  const consTalent = CONSTELLATION_TALENT_BONUS[c.id] ?? {};
  const bumpLevels = ([3, 5] as const).filter((l) => !!consTalent[l]);

  const topExpected = groups
    .flatMap((g) => g.rows)
    .filter((r) => r.text === undefined)
    .reduce((m, r) => Math.max(m, r.expected), 0);
  const element = ELEMENT_LABEL[c.element] ?? c.element;
  const title = `${c.name} Damage Calculator & Build — Genshin`;
  const description =
    `${c.name} (${element} ${c.weaponType}): per-hit damage at Lv90 with ${ctx.weapon.name}, ` +
    `best weapons & constellations — up to ${formatNumber(topExpected)}.`;

  return {
    character: c,
    groups,
    signatureLabel: sig?.label ?? 'Elemental Burst',
    weaponName: ctx.weapon.name,
    constellations: (constellationsFor(c.id) ?? []).map((e) => ({
      ...e,
      modeled: !!consModelled[e.level] || bumpLevels.includes(e.level as 3 | 5),
    })),
    passives: (passivesFor(c.id) ?? []).map((p, i) => ({ ...p, modeled: !!passiveModelled[i] })),
    weapons,
    calcHref: `/?c=${encodeURIComponent(c.id)}`,
    title,
    description,
  };
}
