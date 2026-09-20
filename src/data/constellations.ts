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

import type { BuffState } from '../lib/damage';

export const CONSTELLATION_EFFECTS: Record<string, Record<number, Partial<BuffState>>> = {
  'raiden-shogun': {
    2: { defIgnore: 0.6 }, // Steelbreaker — attacks ignore 60% DEF
  },
  kazuha: {
    2: { em: 200 }, // Yamaarashi Tailwind — +200 EM on self
  },
  xiangling: {
    1: { resShred: 0.15 }, // Guoba lowers Pyro RES 15%
    6: { dmgBonus: 0.15 }, // +15% Pyro DMG for the party
  },
  xingqiu: {
    2: { resShred: 0.15 }, // sword rain lowers Hydro RES 15%
    4: { skillDmgBonus: 0.5 }, // Guhua Sword: Fatal Rainscreen +50% during burst
  },
  gaming: {
    6: { critDMG: 0.4, critRate: 0.2 }, // To Tame All Beasts — after the plunge
  },
  tighnari: {
    1: { critRate: 0.15 }, // Beginnings Determined at the Roots — Charged Attacks only
  },
  flins: {
    4: { atkPercent: 0.2, em: 10 }, // Night on Bald Mountain
  },
  jean: {
    4: { resShred: 0.4 }, // Lands of Dandelion — Anemo RES down in the field
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
    6: { resShred: 0.2 }, // Storm of Defiance — Anemo RES down
  },
  heizou: {
    6: { critDMG: 0.32 }, // Curious Casefiles
  },
  'yun-jin': {
    4: { defPercent: 0.2 }, // Flower and a Fighter
  },
  emilie: {
    2: { resShred: 0.3 }, // Lakelight Top Note — Dendro RES down
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
    4: { resShred: 0.2 }, // Delusion Ensnares Reason — Dendro RES down
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
};

export const PASSIVE_EFFECTS: Record<string, Record<number, Partial<BuffState>>> = {
  'hu-tao': {
    1: { dmgBonus: 0.33 }, // Sanguine Rouge — +33% Pyro DMG at or below 50% HP
  },
  xingqiu: {
    1: { dmgBonus: 0.2 }, // Blades Amidst Raindrops — +20% Hydro DMG
  },
  neuvillette: {
    1: { dmgBonus: 0.3 }, // Discipline of the Supreme Arbitration — up to +30% Hydro DMG
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
    1: { resShred: 0.1 }, // Rimechaser Blade — Cryo RES down
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
function accumulate(patches: Partial<BuffState>[]): Partial<BuffState> {
  const out: Record<string, unknown> = {};
  for (const eff of patches) {
    const src = eff as Record<string, unknown>;
    for (const key of Object.keys(src)) {
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

/** Sum of every constellation effect up to and including `level`. */
export function constellationBuffs(charId: string, level: number): Partial<BuffState> {
  const table = CONSTELLATION_EFFECTS[charId];
  if (!table) return {};
  const patches: Partial<BuffState>[] = [];
  for (let l = 1; l <= level; l++) if (table[l]) patches.push(table[l]);
  return accumulate(patches);
}

/** Sum of the toggled ascension passives. */
export function passiveBuffs(charId: string, enabled: number[]): Partial<BuffState> {
  const table = PASSIVE_EFFECTS[charId];
  if (!table) return {};
  return accumulate(enabled.map((i) => table[i]).filter(Boolean) as Partial<BuffState>[]);
}
