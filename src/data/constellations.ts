// ============================================================================
// Constellation / ascension-passive → damage-model mapping.
//
// genshin-db provides the TEXT (src/data/generated/constellations.ts); this file
// is the curated half that decides which ones change the number. Only effects
// that are self-buffs, unconditional enough to model, and clearly numeric are
// listed. Everything else is shown as text but applies nothing — better a
// missing buff than a wrong one.
//
// Add entries by reading the description in the generated file and translating
// it into BuffState fields. Keys are 1-6 (constellations) / array index
// (passives), matching CONSTELLATIONS / PASSIVES order.
// ============================================================================

import type { BuffState, ElementType } from '../lib/damage';
import type { TalentKey } from './talents';

/**
 * Which hits an effect applies to. Most self-buffs are limited to an element
 * ("+33% Pyro DMG") or an attack ("Charged Attack CRIT Rate"); folding those
 * into the global buff state priced Hu Tao's Physical normals with her Pyro
 * passive. An effect with a scope is resolved per hit, like set and party
 * bonuses (see damage-groups.ts).
 */
export interface HitScope {
  element?: ElementType;
  attack?: TalentKey;
  /** Matched against the talent row label, for effects on one named hit. */
  label?: RegExp;
}

/** The hit a scoped effect is tested against. */
export interface Hit {
  element: ElementType;
  attack: TalentKey;
  label?: string;
}

/** A self-buff, optionally limited to some hits. */
export type SelfEffect = Partial<BuffState> & { only?: HitScope };

export const CONSTELLATION_EFFECTS: Record<string, Record<number, SelfEffect>> = {
  'raiden-shogun': {
    2: { defIgnore: 0.6, only: { attack: 'burst' } }, // Steelbreaker — Musou Shinsetsu / Isshin ignore 60% DEF
  },
  kazuha: {
    2: { em: 200 }, // Yamaarashi Tailwind — +200 EM on self
  },
  xiangling: {
    1: { resShred: 0.15, only: { element: 'pyro' } }, // Guoba lowers Pyro RES 15%
    6: { dmgBonus: 0.15, only: { element: 'pyro' } }, // +15% Pyro DMG for the party
  },
  xingqiu: {
    2: { resShred: 0.15, only: { element: 'hydro' } }, // sword rain lowers Hydro RES 15%
    4: { skillDmgBonus: 0.5 }, // Guhua Sword: Fatal Rainscreen +50% during burst
  },
  gaming: {
    6: { critDMG: 0.4, critRate: 0.2, only: { label: /Charmed Cloudstrider/ } }, // To Tame All Beasts — Charmed Cloudstrider only
  },
  tighnari: {
    1: { critRate: 0.15, only: { attack: 'charged' } }, // Beginnings Determined at the Roots — Charged Attacks only
  },
  flins: {
    4: { atkPercent: 0.2, em: 10 }, // Night on Bald Mountain
  },
  jean: {
    4: { resShred: 0.4, only: { element: 'anemo' } }, // Lands of Dandelion — Anemo RES down in the field
  },
  'hu-tao': {
    6: { critRate: 1 }, // Butterfly's Embrace — 100% CRIT Rate after the trigger
  },
  yoimiya: {
    1: { atkPercent: 0.2 }, // Agate Ryuukin — after the burst
  },
  dehya: {
    1: { hpPercent: 0.2 }, // The Flame Incandescent
  },
  keqing: {
    4: { atkPercent: 0.25 }, // Attunement — after an Electro reaction
  },
  diona: {
    6: { em: 200 }, // Cat's Tail Closing Time — inside Signature Mix
  },
  venti: {
    6: { resShred: 0.2, only: { element: 'anemo' } }, // Storm of Defiance — Anemo RES down
  },
  heizou: {
    6: { critDMG: 0.32 }, // Curious Casefiles
  },
  'yun-jin': {
    4: { defPercent: 0.2 }, // Flower and a Fighter
  },
  emilie: {
    2: { resShred: 0.3, only: { element: 'dendro' } }, // Lakelight Top Note — Dendro RES down
  },
  alyosha: {
    6: { em: 100 }, // Standard Reclaimed
  },
  'yumemizuki-mizuki': {
    6: { critDMG: 0.1 }, // The Heart Lingers Long
  },
  nicole: {
    6: { defIgnore: 0.4 }, // ignore 40% DEF
  },
  nefer: {
    4: { resShred: 0.2, only: { element: 'dendro' } }, // Delusion Ensnares Reason — Dendro RES down
  },
  escoffier: {
    1: { critDMG: 0.6 }, // Pre-Dinner Dance for Your Taste Buds
  },
  illuga: {
    6: { critDMG: 0.3, critRate: 0.1, em: 80 }, // Nightmare Orioles
  },
  linnea: {
    2: { critDMG: 0.4 }, // Tidings of Joy and Sorrow
  },
  jahoda: {
    6: { critDMG: 0.4, critRate: 0.05 }, // The Littlest Luck
  },
  skirk: {
    2: { atkPercent: 0.7 }, // Into the Abyss (conditional)
  },
  nahida: {
    2: { defShred: 0.3 }, // The Root of All Fullness — DEF down 8s after Quicken/Aggravate/Spread
    4: { em: 100 }, // The Stem of Manifest Inference — 100/120/140/160 EM by seeded target count; the 1-target value is modelled
  },
  ayaka: {
    4: { defShred: 0.3 }, // Ebb and Flow — Soumetsu hits lower DEF 30% for 6s
  },
  neuvillette: {
    2: { critDMG: 0.42, only: { label: /Equitable Judgment/ } }, // Juridical Exhortation — Equitable Judgment CRIT DMG at 3 Past Draconic Glories stacks
  },
  columbina: {
    2: { hpPercent: 0.4 }, // Not in Lone Splendor — Lunar Brilliance Max HP on every Gravity Interference
  },
  prune: {
    2: { atkPercent: 0.4 }, // Useful for Cleaning Messy Baggage — Hunt the Witch ramps to its 40% cap during the burst
  },
  ifa: {
    4: { em: 100 }, // Decayed Vessel's Permutation — 15s after the Burst
  },
  mavuika: {
    1: { atkPercent: 0.4 }, // The Night-Lord's Explication — 8s after gaining Fighting Spirit
    2: { flatATK: 200 }, // The Ashen Price — Base ATK in the Nightsoul's Blessing state; the Ring DEF shred is form-gated and unmodelled
  },
};

export const PASSIVE_EFFECTS: Record<string, Record<number, SelfEffect>> = {
  'hu-tao': {
    1: { dmgBonus: 0.33, only: { element: 'pyro' } }, // Sanguine Rouge — +33% Pyro DMG at or below 50% HP
  },
  xingqiu: {
    1: { dmgBonus: 0.2, only: { element: 'hydro' } }, // Blades Amidst Raindrops — +20% Hydro DMG
  },
  neuvillette: {
    0: { baseDmgBonus: 0.6, only: { label: /Equitable Judgment/ } }, // Heir to the Ancient Sea's Authority — Equitable Judgment at 3 Past Draconic Glories stacks
    1: { dmgBonus: 0.3, only: { element: 'hydro' } }, // Discipline of the Supreme Arbitration — up to +30% Hydro DMG
  },
  yoimiya: {
    0: { dmgBonus: 0.2, only: { element: 'pyro' } }, // Tricks of the Trouble-Maker — 10 Pyro DMG stacks during Niwabi Fire-Dance
  },
  ayaka: {
    0: { naDmgBonus: 0.3, caDmgBonus: 0.3 }, // Amatsumi Kunitsumi Sanctification — 6s after Hyouka
    1: { dmgBonus: 0.18, only: { element: 'cryo' } }, // Kanten Senmyou Blessing — Cryo DMG Bonus, near-permanent uptime
  },
  arlecchino: {
    2: { dmgBonus: 0.4, only: { element: 'pyro' } }, // The Balemoon Alone May Know — Pyro DMG Bonus in combat
  },
  mavuika: {
    0: { atkPercent: 0.3 }, // Gift of Flaming Flowers — after a party Nightsoul Burst
  },
  ifa: {
    1: { em: 80 }, // Mutual Aid Agreement — after a party Nightsoul Burst
  },
  xiangling: {
    1: { atkPercent: 0.1 }, // Beware, It's Super Hot! — +10% ATK
  },
  flins: {
    1: { em: 8 }, // Whispering Flame
  },
  keqing: {
    1: { critRate: 0.15 }, // Aristocratic Dignity — after Stellar Restoration
  },
  chongyun: {
    1: { resShred: 0.1, only: { element: 'cryo' } }, // Rimechaser Blade — Cryo RES down
  },
  sucrose: {
    0: { em: 50 }, // Catalyst Conversion — on Swirl
  },
  tighnari: {
    0: { em: 50 }, // Keen Sight
  },
  illuga: {
    0: { em: 50 }, // Torchforger's Covenant
  },
  xilonen: {
    1: { defPercent: 0.2 }, // Portable Armored Sheath
  },
  lohen: {
    1: { atkPercent: 0.15 }, // Flippant Masterpiece
  },
  iansan: {
    0: { atkPercent: 0.2 }, // Enhanced Resistance Training
  },
  aloy: {
    0: { atkPercent: 0.16 }, // Combat Override — top Coil stack
  },
};

/** Sum a list of buff patches, merging per-reaction bonuses rather than adding them. */
function accumulate(patches: SelfEffect[]): Partial<BuffState> {
  const out: Record<string, unknown> = {};
  for (const eff of patches) {
    const src = eff as Record<string, unknown>;
    for (const key of Object.keys(src)) {
      if (key === 'only') continue;
      if (key === 'reactionDmg') {
        const next = { ...((out.reactionDmg as Record<string, number>) ?? {}) };
        const incoming = (src.reactionDmg as Record<string, number>) ?? {};
        for (const rk of Object.keys(incoming)) next[rk] = (next[rk] ?? 0) + (incoming[rk] ?? 0);
        out.reactionDmg = next;
        continue;
      }
      out[key] = ((out[key] as number) ?? 0) + ((src[key] as number) ?? 0);
    }
  }
  return out as Partial<BuffState>;
}

/** Every constellation effect up to `level`, whatever hits it is limited to —
 *  what the constellation grants, not what one hit receives. */
export function constellationBuffs(charId: string, level: number): Partial<BuffState> {
  return accumulate(constellationEffects(charId, level));
}

/** Every toggled ascension passive, whatever hits it is limited to. */
export function passiveBuffs(charId: string, enabled: number[]): Partial<BuffState> {
  return accumulate(passiveEffects(charId, enabled));
}

function constellationEffects(charId: string, level: number): SelfEffect[] {
  const table = CONSTELLATION_EFFECTS[charId];
  if (!table) return [];
  const out: SelfEffect[] = [];
  for (let l = 1; l <= level; l++) if (table[l]) out.push(table[l]);
  return out;
}

function passiveEffects(charId: string, enabled: number[]): SelfEffect[] {
  const table = PASSIVE_EFFECTS[charId];
  if (!table) return [];
  return enabled.map((i) => table[i]).filter(Boolean);
}

export function scopeMatches(scope: HitScope, hit: Hit): boolean {
  if (scope.element && scope.element !== hit.element) return false;
  if (scope.attack && scope.attack !== hit.attack) return false;
  if (scope.label && !(hit.label && scope.label.test(hit.label))) return false;
  return true;
}

/** Constellation + passive effects that apply to every hit — safe to fold into
 *  the build's global buff state. */
export function unscopedSelfBuffs(charId: string, level: number, enabled: number[]): Partial<BuffState> {
  return accumulate([...constellationEffects(charId, level), ...passiveEffects(charId, enabled)].filter((e) => !e.only));
}

/** The scoped constellation + passive effects one hit receives. Pair with
 *  unscopedSelfBuffs; together they are everything that hit gets. */
export function scopedSelfBuffs(charId: string, level: number, enabled: number[], hit: Hit): Partial<BuffState> {
  return accumulate(
    [...constellationEffects(charId, level), ...passiveEffects(charId, enabled)].filter(
      (e) => e.only && scopeMatches(e.only, hit),
    ),
  );
}
