// ============================================================================
// Build-time data for the static /characters/<id>/ pages.
//
// Every number here is produced by the SAME engine path the calculator uses for
// its default load state (defaultsFor → resolveBuild → draftToGroups / draftHeadline), so a rendered
// page and /?c=<id> agree row for row. React-free: this runs inside getStaticPaths.
// ============================================================================

import { weaponsForType } from '../data/weapons';
import { WEAPON_PASSIVE_EFFECTS } from '../data/weaponPassives';
import { talentRowsFor } from '../data/generated/talents';
import { constellationsFor, passivesFor } from '../data/generated/constellations';
import type { ConstellationEntry, PassiveEntry } from '../data/generated/constellations';
import { CONSTELLATION_EFFECTS, PASSIVE_EFFECTS } from '../data/constellations';
import { CONSTELLATION_TALENT_BONUS } from '../data/generated/constellationTalents';
import { signatureTalent } from '../data/talents';
import { formatNumber } from './damage';
import { ELEMENT_LABEL } from '../data/elements';
import type { CharacterData, ScalingStat, WeaponData } from './damage';
import type { DamageGroupVm } from './damage-groups';
import { draftHeadline, draftToGroups, resolveBuild } from './draft-build';
import { defaultsFor } from '../components/calculator/draft';
import { SECONDARY_LABEL } from '../components/calculator/constants';

export interface WeaponPick {
  weapon: WeaponData;
  /** Signature-attack expected damage with this weapon at R1 / 0 stacks. */
  expected: number;
  /** Whether the weapon's passive feeds the engine (else the number omits it). */
  passiveModelled: boolean;
  equipped: boolean;
  /** Share of the top weapon's damage — the gap a "weapon calc" answers. */
  pctOfBest: number;
}

export interface FaqItem {
  question: string;
  answer: string;
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
  faqs: FaqItem[];
}

/** True when a /characters/<id>/ page exists: released and has per-hit rows. */
export function hasPage(id: string): boolean {
  return (talentRowsFor(id)?.length ?? 0) > 0;
}

/** Characters we can publish: released AND with per-hit talent rows to compute from. */
export function hasPublishableData(c: CharacterData): boolean {
  return !c.unreleased && hasPage(c.id);
}

/** Signature-attack expected damage for a character holding a specific weapon
 *  at R1 / 0 stacks — the calculator's own headline with only the weapon swapped. */
function headlineWithWeapon(c: CharacterData, w: WeaponData): number {
  const draft = { ...defaultsFor(c), weaponId: w.id };
  return draftHeadline(draft).expected;
}

/** Per-stat scaling sentence for the "what does X scale off" answer. */
const SCALING_SENTENCE: Record<ScalingStat, string> = {
  atk: 'scales off total ATK — character base ATK plus weapon base ATK, then (1 + ATK%) and flat ATK on top. A weapon\u2019s base ATK line therefore feeds this character directly.',
  hp: 'scales off Max HP, not ATK. HP% raises every number on this page; ATK% raises none of them.',
  def: 'scales off total DEF, not ATK. DEF% raises every number on this page; ATK% raises none of them.',
  em: 'scales off Elemental Mastery, not ATK. Elemental Mastery raises every number on this page; ATK% raises none of them.',
};

function buildFaqs(
  c: CharacterData,
  signatureLabel: string,
  topWeapon: WeaponPick | undefined,
  equippedPick: WeaponPick | undefined,
  topExpected: number,
  hasConstellations: boolean,
): FaqItem[] {
  const scaling = c.scaling ?? 'atk';
  const faqs: FaqItem[] = [
    {
      question: `What does ${c.name} scale off?`,
      answer: `${c.name}'s ${signatureLabel} ${SCALING_SENTENCE[scaling]}`,
    },
    {
      question: `What stat does ${c.name} get from ascension?`,
      answer: `${c.name}'s ascension substat is ${SECONDARY_LABEL[c.ascension.type]}. It arrives at the Level-80/90 ascension and is part of the character's own stats, so the calculator counts it before any artifact roll is added.`,
    },
  ];

  if (topWeapon) {
    const gap =
      equippedPick && equippedPick.weapon.id !== topWeapon.weapon.id
        ? ` The ${equippedPick.weapon.name} used by this page's preset panel averages ${formatNumber(equippedPick.expected)}, ${(100 - equippedPick.pctOfBest * 100).toFixed(1)}% behind it.`
        : ` This page's preset panel already uses it.`;
    faqs.push({
      question: `What is the best weapon for ${c.name}?`,
      answer: `Ranked by computed ${signatureLabel} damage at Level 90, talent 10 and refinement 1, ${topWeapon.weapon.name} is the strongest ${c.weaponType} for ${c.name} at ${formatNumber(topWeapon.expected)} average damage per hit.${gap}`,
    });
  }

  faqs.push({
    question: `What artifacts should ${c.name} use?`,
    answer: `${c.bestArtifacts} is the set this calculator presets ${c.name} with, and the damage tables include its bonuses. Set effects that depend on the element of the hit are applied per row rather than as a flat average.`,
  });
  faqs.push({
    question: `How much damage should ${c.name} do?`,
    answer: `On the default Level-90, talent-10 build shown above, ${c.name}'s largest single hit averages ${formatNumber(topExpected)} — the table lists its CRIT and non-CRIT numbers separately. That is a reference panel, not a target: load your own artifact rolls into the calculator to get your own number.`,
  });

  if (hasConstellations) {
    faqs.push({
      question: `Do these numbers include ${c.name}'s constellations?`,
      answer: `No — every table is computed at C0. Constellations that are unconditional and clearly numeric are modelled in the calculator and marked as such on this page; the rest are listed as text only and change nothing.`,
    });
  }

  return faqs;
}

export function buildCharacterPageData(c: CharacterData): CharacterPageData {
  const draft = defaultsFor(c);
  const build = resolveBuild(draft);
  const groups = draftToGroups(draft, build);

  const sig = signatureTalent(c.id);
  const signatureLabel = sig?.label ?? 'Elemental Burst';
  const ranked = weaponsForType(c.weaponType)
    .map((w) => ({
      weapon: w,
      expected: headlineWithWeapon(c, w),
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
  const topWeapon = weapons[0];
  const equippedPick = weapons.find((w) => w.equipped);
  const withPct = weapons.map((w) => ({ ...w, pctOfBest: topWeapon ? w.expected / topWeapon.expected : 1 }));

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
    `${c.name} (${element} ${c.weaponType}): per-hit damage at Lv90 with ${build.weapon.name}, ` +
    `best weapons & constellations — up to ${formatNumber(topExpected)}.`;
  const constellations = (constellationsFor(c.id) ?? []).map((e) => ({
    ...e,
    modeled: !!consModelled[e.level] || bumpLevels.includes(e.level as 3 | 5),
  }));

  return {
    character: c,
    groups,
    signatureLabel,
    weaponName: build.weapon.name,
    constellations,
    passives: (passivesFor(c.id) ?? []).map((p, i) => ({ ...p, modeled: !!passiveModelled[i] })),
    weapons: withPct,
    calcHref: `/?c=${encodeURIComponent(c.id)}`,
    title,
    description,
    faqs: buildFaqs(c, signatureLabel, withPct[0], withPct.find((w) => w.equipped), topExpected, constellations.length > 0),
  };
}
