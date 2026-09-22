// ============================================================================
// Weapon passive → damage-model mapping.
//
// genshin-db gives us the passive TEXT and its per-refinement values, but it
// cannot know what each value *means* for a damage calculation. This file is the
// curated half: for each weapon we name the stat a passive grants, which value
// slot in the generated refinement data to read, and how many stacks the user
// may select. Anything not listed here still shows its text in the UI but is
// not auto-applied — better to model nothing than to model it wrong.
//
// Conditional / multi-part effects are deliberately reduced to their reliable
// core, with the missing part called out in `note`. Add a weapon by finding its
// `values` array in src/data/generated/weaponPassives.ts and pointing
// `valueIndex` at the right slot.
// ============================================================================

import type { BuffState } from '../lib/damage';
import { weaponPassiveFor } from './generated/weaponPassives';

export type PassiveStat =
  | 'dmgBonus'
  | 'atkPercent'
  | 'hpPercent'
  | 'defPercent'
  | 'critRate'
  | 'critDMG'
  | 'em'
  | 'er'
  | 'flatATK'
  | 'atkFromHP'
  | 'atkFromEM'
  | 'atkFromER'
  | 'atkFromERMax'
  | 'dmgBonusFromHP'
  | 'dmgBonusFromHPMax'
  | 'naDmgBonus'
  | 'caDmgBonus'
  | 'skillDmgBonus'
  | 'burstDmgBonus';

export interface PassiveLine {
  stat: PassiveStat;
  /** Index into the refinement's `values` array. */
  valueIndex: number;
  /** When true the value is per-stack and scales with the selected count. */
  scales?: boolean;
}

export interface WeaponPassiveEffect {
  lines: PassiveLine[];
  /** Selectable stack count 0..maxStacks; 1 means a simple on/off. */
  maxStacks: number;
  /** What was simplified or assumed. */
  note?: string;
}

export const WEAPON_PASSIVE_EFFECTS: Record<string, WeaponPassiveEffect> = {
  // ---- Polearms ----
  'staff-of-homa': { lines: [{ stat: 'hpPercent', valueIndex: 0 }, { stat: 'atkFromHP', valueIndex: 1 }], maxStacks: 1, note: 'Below 50% HP the HP→ATK rate rises further; not modelled.' },
  'engulfing-lightning': { lines: [{ stat: 'atkFromER', valueIndex: 0 }, { stat: 'atkFromERMax', valueIndex: 1 }], maxStacks: 1, note: 'ER→ATK uses current Energy Recharge; the on-burst ER is not modelled.' },
  'staff-of-scarlet-sands': { lines: [{ stat: 'atkFromEM', valueIndex: 0 }], maxStacks: 1, note: 'The 3 stacking Dream of the Scarlet Sands stacks are not modelled.' },
  'primordial-jade-winged-spear': { lines: [{ stat: 'atkPercent', valueIndex: 0, scales: true }], maxStacks: 7, note: 'Max-stack extra DMG is not modelled.' },
  'calamity-queller': { lines: [{ stat: 'dmgBonus', valueIndex: 0 }], maxStacks: 1, note: 'ATK gained over time is not modelled.' },
  'vortex-vanquisher': { lines: [{ stat: 'atkPercent', valueIndex: 1, scales: true }], maxStacks: 5, note: 'Being shielded doubles the ATK stacks; not modelled.' },
  'skyward-spine': { lines: [{ stat: 'critRate', valueIndex: 0 }], maxStacks: 1, note: 'Windblade proc additional DMG is not modelled.' },
  'lumidouce-elegy': { lines: [{ stat: 'atkPercent', valueIndex: 0 }], maxStacks: 1, note: 'Triggered party DMG buff is not modelled.' },
  'the-catch': { lines: [{ stat: 'burstDmgBonus', valueIndex: 0 }], maxStacks: 1, note: 'Elemental Burst CRIT Rate is not modelled.' },
  deathmatch: { lines: [{ stat: 'atkPercent', valueIndex: 0 }], maxStacks: 1, note: 'Assumes 2+ opponents nearby.' },
  'dragons-bane': { lines: [{ stat: 'dmgBonus', valueIndex: 0 }], maxStacks: 1, note: 'Assumes a Hydro- or Pyro-affected target.' },
  'blackcliff-pole': { lines: [{ stat: 'atkPercent', valueIndex: 0, scales: true }], maxStacks: 3, note: 'Assumes the on-kill stacks are active.' },
  'bloodsoaked-ruins': { lines: [{ stat: 'critDMG', valueIndex: 1 }], maxStacks: 1, note: 'Requires a Lunar-Charged trigger; its DMG bonus and the Energy refund are not modelled.' },
  'disaster-and-remorse': { lines: [{ stat: 'skillDmgBonus', valueIndex: 1 }, { stat: 'burstDmgBonus', valueIndex: 1 }], maxStacks: 1, note: 'Assumes Irreparable is active after a Skill; the Normal/Charged twin effect and the Hexerei amplification are not modelled.' },
  'fractured-halo': { lines: [{ stat: 'atkPercent', valueIndex: 0 }], maxStacks: 1, note: 'The party Lunar-Charged bonus from Electrifying Edict is not modelled.' },
  'symphonist-of-scents': { lines: [{ stat: 'atkPercent', valueIndex: 0 }, { stat: 'atkPercent', valueIndex: 2 }], maxStacks: 1, note: 'Assumes Sweet Echoes is active (a recent heal); the off-field ATK bonus is not modelled.' },
  'lithic-spear': { lines: [{ stat: 'atkPercent', valueIndex: 0, scales: true }, { stat: 'critRate', valueIndex: 1, scales: true }], maxStacks: 4, note: 'Assumes a full-Liyue party.' },

  // ---- Bows ----
  'amos-bow': { lines: [{ stat: 'naDmgBonus', valueIndex: 0 }], maxStacks: 1, note: 'Distance-based bonus is not modelled.' },
  'aqua-simulacra': { lines: [{ stat: 'hpPercent', valueIndex: 0 }, { stat: 'dmgBonus', valueIndex: 1 }], maxStacks: 1, note: 'Assumes opponents are nearby.' },
  'skyward-harp': { lines: [{ stat: 'critDMG', valueIndex: 0 }], maxStacks: 1, note: 'Aero Dew proc physical DMG is not modelled.' },
  'thundering-pulse': { lines: [{ stat: 'atkPercent', valueIndex: 0 }], maxStacks: 1, note: 'Normal Attack emblem tiers are not modelled.' },
  'polar-star': { lines: [{ stat: 'skillDmgBonus', valueIndex: 0 }], maxStacks: 1, note: 'Also applies to Elemental Burst; ATK stacks are not modelled.' },
  'the-first-great-magic': { lines: [{ stat: 'caDmgBonus', valueIndex: 0 }], maxStacks: 1, note: 'Party-based ATK is not modelled.' },
  'elegy-for-the-end': { lines: [{ stat: 'em', valueIndex: 0 }], maxStacks: 1, note: 'Triggered party EM/ATK buffs are not modelled.' },
  'hunters-path': { lines: [{ stat: 'dmgBonus', valueIndex: 0 }], maxStacks: 1, note: 'Charged Attack DMG from EM is not modelled.' },
  'astral-vulture': { lines: [{ stat: 'atkPercent', valueIndex: 0 }], maxStacks: 1, note: 'Assumes a Swirl has just been triggered.' },
  'the-stringless': { lines: [{ stat: 'skillDmgBonus', valueIndex: 0 }], maxStacks: 1, note: 'Also applies to Elemental Burst.' },
  rust: { lines: [{ stat: 'naDmgBonus', valueIndex: 0 }], maxStacks: 1, note: 'Charged Attack penalty is not modelled.' },
  'prototype-crescent': { lines: [{ stat: 'atkPercent', valueIndex: 0 }], maxStacks: 1, note: 'Assumes a weak-point hit.' },
  'golden-frostbound-oath': { lines: [{ stat: 'defPercent', valueIndex: 0 }, { stat: 'dmgBonus', valueIndex: 1 }], maxStacks: 1, note: 'The Geo-only DMG bonus is applied to all elements; Lunar-Crystallize and party effects are not modelled.' },
  'silvershower-heartstrings': { lines: [{ stat: 'critRate', valueIndex: 1 }], maxStacks: 1, note: 'Assumes 3 Remedy stacks; the tiered Max HP bonus (12/24/40% in one values slot) is not modelled.' },
  'the-daybreak-chronicles': { lines: [{ stat: 'naDmgBonus', valueIndex: 0 }, { stat: 'skillDmgBonus', valueIndex: 0 }, { stat: 'burstDmgBonus', valueIndex: 0 }], maxStacks: 1, note: 'Assumes Stirring Dawn Breeze is maxed per attack type; the decay and the Hexerei variant are not modelled.' },
  'blackcliff-warbow': { lines: [{ stat: 'atkPercent', valueIndex: 0, scales: true }], maxStacks: 3, note: 'Assumes the on-kill stacks are active.' },

  // ---- Swords ----
  'mistsplitter-reforged': { lines: [{ stat: 'dmgBonus', valueIndex: 0 }], maxStacks: 1, note: "Tiered Mistsplitter's Emblem bonus is not modelled." },
  'primordial-jade-cutter': { lines: [{ stat: 'hpPercent', valueIndex: 0 }, { stat: 'atkFromHP', valueIndex: 1 }], maxStacks: 1 },
  'splendor-of-tranquil-waters': { lines: [{ stat: 'skillDmgBonus', valueIndex: 0, scales: true }], maxStacks: 3, note: 'Stacks require recent HP changes; the party-triggered Max HP stacks are not modelled.' },
  'light-of-foliar-incision': { lines: [{ stat: 'critRate', valueIndex: 0 }], maxStacks: 1, note: 'Normal Attack DMG from EM is not modelled.' },
  'aquila-favonia': { lines: [{ stat: 'atkPercent', valueIndex: 0 }], maxStacks: 1, note: "Falcon of the West's on-damage heal and bonus hit are not modelled." },
  'freedom-sworn': { lines: [{ stat: 'dmgBonus', valueIndex: 0 }], maxStacks: 1, note: 'Triggered party buffs are not modelled.' },
  'haran-geppaku-futsu': { lines: [{ stat: 'dmgBonus', valueIndex: 0 }], maxStacks: 1, note: 'Wavespike Normal Attack DMG is not modelled.' },
  'key-of-khaj-nisut': { lines: [{ stat: 'hpPercent', valueIndex: 0 }], maxStacks: 1, note: 'EM sharing is not modelled.' },
  'uraku-misugiri': { lines: [{ stat: 'naDmgBonus', valueIndex: 0 }, { stat: 'skillDmgBonus', valueIndex: 1 }], maxStacks: 1, note: 'The nearby-Geo doubling and the DEF bonus are not modelled.' },
  absolution: { lines: [{ stat: 'critDMG', valueIndex: 0 }], maxStacks: 1, note: 'Bond of Life DMG bonus is not modelled.' },
  'the-black-sword': { lines: [{ stat: 'naDmgBonus', valueIndex: 0 }], maxStacks: 1, note: 'Also applies to Charged Attacks.' },
  'lions-roar': { lines: [{ stat: 'dmgBonus', valueIndex: 0 }], maxStacks: 1, note: 'Assumes a Pyro- or Electro-affected target.' },
  'athame-artis': { lines: [{ stat: 'atkPercent', valueIndex: 1 }], maxStacks: 1, note: 'Assumes the Burst has hit; Burst CRIT DMG, party ATK and the Hexerei amplification are not modelled.' },
  'azurelight': { lines: [{ stat: 'atkPercent', valueIndex: 0 }], maxStacks: 1, note: 'The extra ATK and CRIT DMG at 0 Energy are not modelled.' },
  'exaiphanes-blade': { lines: [{ stat: 'atkPercent', valueIndex: 0 }], maxStacks: 1, note: 'Requires a hit in the last 8s; the Energy refund is not modelled.' },
  'lightbearing-moonshard': { lines: [{ stat: 'defPercent', valueIndex: 0 }], maxStacks: 1, note: 'The Lunar-Crystallize DMG bonus is not modelled.' },
  'peak-patrol-song': { lines: [{ stat: 'defPercent', valueIndex: 0, scales: true }, { stat: 'dmgBonus', valueIndex: 1, scales: true }], maxStacks: 2, note: 'The party Elemental DMG scaled by DEF is not modelled.' },
  'skyward-blade': { lines: [{ stat: 'critRate', valueIndex: 0 }], maxStacks: 1, note: 'Skypiercing Might additional DMG is not modelled.' },
  'summit-shaper': { lines: [{ stat: 'atkPercent', valueIndex: 1, scales: true }], maxStacks: 5, note: 'Being shielded doubles the ATK stacks; not modelled.' },
  'whitelake-frostfeather': { lines: [{ stat: 'atkPercent', valueIndex: 0, scales: true }], maxStacks: 3, note: 'The 3-stack Stellar Glimmer CRIT DMG and Energy refund are not modelled.' },
  'blackcliff-longsword': { lines: [{ stat: 'atkPercent', valueIndex: 0, scales: true }], maxStacks: 3, note: 'Assumes the on-kill stacks are active.' },
  'prototype-rancour': { lines: [{ stat: 'atkPercent', valueIndex: 0, scales: true }, { stat: 'defPercent', valueIndex: 0, scales: true }], maxStacks: 4, note: 'Assumes the on-hit stacks are active.' },

  // ---- Catalysts ----
  'tome-of-eternal-flow': { lines: [{ stat: 'hpPercent', valueIndex: 0 }, { stat: 'caDmgBonus', valueIndex: 1, scales: true }], maxStacks: 3, note: 'Stacks require recent HP changes; the Energy refund is not modelled.' },
  'crimson-moon-semblance': { lines: [{ stat: 'dmgBonus', valueIndex: 0 }, { stat: 'dmgBonus', valueIndex: 1 }], maxStacks: 1, note: 'Assumes a Bond of Life of at least 30% Max HP (full bonus).' },
  'jadefall-splendor': { lines: [{ stat: 'dmgBonusFromHP', valueIndex: 1 }, { stat: 'dmgBonusFromHPMax', valueIndex: 2 }], maxStacks: 1, note: 'Assumes Primordial Jade Regalia is active (after Burst / shield).' },
  'lost-prayer': { lines: [{ stat: 'dmgBonus', valueIndex: 0, scales: true }], maxStacks: 4, note: 'Max stacks require 16s of combat; assumed maintained.' },
  'kaguras-verity': { lines: [{ stat: 'skillDmgBonus', valueIndex: 0, scales: true }], maxStacks: 3, note: 'Stellar-Conduct bonus is not modelled.' },
  'a-thousand-floating-dreams': { lines: [{ stat: 'em', valueIndex: 0 }], maxStacks: 1, note: 'Party-based EM / DMG buffs are not modelled.' },
  'cashflow-supervision': { lines: [{ stat: 'atkPercent', valueIndex: 0 }, { stat: 'naDmgBonus', valueIndex: 1, scales: true }], maxStacks: 3, note: 'Charged and Plunging bonuses are not modelled.' },
  'surfs-up': { lines: [{ stat: 'hpPercent', valueIndex: 0 }, { stat: 'naDmgBonus', valueIndex: 1, scales: true }], maxStacks: 4, note: 'Stacks need an Elemental Skill and drain one per Normal Attack; Vaporize regen is not modelled.' },
  'starcallers-watch': { lines: [{ stat: 'em', valueIndex: 0 }], maxStacks: 1, note: 'Party EM sharing is not modelled.' },
  'angelos-heptades': { lines: [{ stat: 'atkPercent', valueIndex: 0 }], maxStacks: 1, note: "The ATK-scaled party DMG from Pathfinder's Light and the Energy refund are not modelled." },
  'memory-of-dust': { lines: [{ stat: 'atkPercent', valueIndex: 1, scales: true }], maxStacks: 5, note: 'Being shielded doubles the ATK stacks; not modelled.' },
  'nightweavers-looking-glass': { lines: [{ stat: 'em', valueIndex: 0 }, { stat: 'em', valueIndex: 1 }], maxStacks: 1, note: 'Assumes both Prayer of the Far North and New Moon Verse are active; the party reaction DMG bonus is not modelled.' },
  'nocturnes-curtain-call': { lines: [{ stat: 'hpPercent', valueIndex: 0 }, { stat: 'hpPercent', valueIndex: 2 }], maxStacks: 1, note: "Assumes Bountiful Sea's Sacred Wine is active (after a Lunar reaction); its Lunar CRIT DMG and the Energy refund are not modelled." },
  'reliquary-of-truth': { lines: [{ stat: 'critRate', valueIndex: 0 }, { stat: 'em', valueIndex: 1 }, { stat: 'critDMG', valueIndex: 2 }], maxStacks: 1, note: 'Assumes Secret of Lies and Moon of Truth are active; their 50% amplification is not modelled.' },
  'skyward-atlas': { lines: [{ stat: 'dmgBonus', valueIndex: 0 }], maxStacks: 1, note: 'The cloud proc additional DMG is not modelled.' },
  'sunny-morning-sleep-in': { lines: [{ stat: 'em', valueIndex: 0 }, { stat: 'em', valueIndex: 1 }], maxStacks: 1, note: 'Assumes a recent Swirl and Skill hit; the post-Burst EM is not modelled.' },
  'tulaytullahs-remembrance': { lines: [{ stat: 'naDmgBonus', valueIndex: 2, scales: true }], maxStacks: 5, note: 'Assumes the hit stacks are ramped to the 48% cap within 14s of a Skill.' },
  'vivid-notions': { lines: [{ stat: 'atkPercent', valueIndex: 0 }], maxStacks: 1, note: 'The Plunging Attack CRIT DMG effects are not modelled.' },
  'blackcliff-agate': { lines: [{ stat: 'atkPercent', valueIndex: 0, scales: true }], maxStacks: 3, note: 'Assumes the on-kill stacks are active.' },
  'prototype-starglitter': { lines: [{ stat: 'naDmgBonus', valueIndex: 0, scales: true }, { stat: 'caDmgBonus', valueIndex: 0, scales: true }], maxStacks: 2, note: 'Stacks require a recent Elemental Skill.' },
  'sacrificial-jade': { lines: [{ stat: 'hpPercent', valueIndex: 0 }, { stat: 'em', valueIndex: 1 }], maxStacks: 1, note: 'Requires 5s off-field; fades 10s after returning to the field.' },

  // ---- Claymores ----
  'wolfs-gravestone': { lines: [{ stat: 'atkPercent', valueIndex: 0 }], maxStacks: 1, note: 'On-kill party ATK is not modelled.' },
  'redhorn-stonethresher': { lines: [{ stat: 'defPercent', valueIndex: 0 }], maxStacks: 1, note: 'Normal/Charged DMG from DEF is not modelled.' },
  'beacon-of-the-reed-sea': { lines: [{ stat: 'atkPercent', valueIndex: 0 }], maxStacks: 1, note: 'Assumes the post-Skill ATK window is active; the unshielded HP bonus is not modelled.' },
  verdict: { lines: [{ stat: 'atkPercent', valueIndex: 0 }], maxStacks: 1, note: 'Seal-based Elemental Skill DMG is not modelled.' },
  'a-thousand-blazing-suns': { lines: [{ stat: 'critDMG', valueIndex: 0 }, { stat: 'atkPercent', valueIndex: 1 }], maxStacks: 1, note: 'Assumes Scorching Brilliance is active; the Nightsoul amplification is not modelled.' },
  'the-unforged': { lines: [{ stat: 'atkPercent', valueIndex: 1, scales: true }], maxStacks: 5, note: 'Being shielded doubles the ATK stacks; not modelled.' },
  'skyward-pride': { lines: [{ stat: 'dmgBonus', valueIndex: 0 }], maxStacks: 1, note: 'Vacuum blade DMG after a Burst is not modelled.' },
  'serpent-spine': { lines: [{ stat: 'dmgBonus', valueIndex: 0, scales: true }], maxStacks: 5, note: 'Max stacks need 20s on-field; incoming DMG shedding is not modelled.' },
  whiteblind: { lines: [{ stat: 'atkPercent', valueIndex: 0, scales: true }, { stat: 'defPercent', valueIndex: 0, scales: true }], maxStacks: 4, note: 'Assumes the on-hit stacks are active.' },
  'lithic-blade': { lines: [{ stat: 'atkPercent', valueIndex: 0, scales: true }, { stat: 'critRate', valueIndex: 1, scales: true }], maxStacks: 4, note: 'Assumes a full-Liyue party.' },
  'a-teaspoon-of-transcendence': { lines: [{ stat: 'atkPercent', valueIndex: 0 }], maxStacks: 1, note: 'The Stellar-Conduct and Stellar Swirl DMG stacks are not modelled.' },
  'fang-of-the-mountain-king': { lines: [{ stat: 'skillDmgBonus', valueIndex: 0, scales: true }, { stat: 'burstDmgBonus', valueIndex: 0, scales: true }], maxStacks: 6, note: 'Elemental Skill and Burst share the selected Canopy’s Favor stack count.' },
  'gest-of-the-mighty-wolf': { lines: [{ stat: 'dmgBonus', valueIndex: 0, scales: true }], maxStacks: 4, note: 'The Hexerei CRIT DMG per stack and the ATK SPD are not modelled.' },
  'song-of-broken-pines': { lines: [{ stat: 'atkPercent', valueIndex: 0 }], maxStacks: 1, note: 'The triggered party ATK and ATK SPD are not modelled.' },
  'blackcliff-slasher': { lines: [{ stat: 'atkPercent', valueIndex: 0, scales: true }], maxStacks: 3, note: 'Assumes the on-kill stacks are active.' },
};

/** Parse a generated value like "20%" → 0.2, "100" → 100. */
function parseValue(v: string | undefined): number {
  if (!v) return 0;
  const m = String(v).match(/-?\d+(?:\.\d+)?/);
  if (!m) return 0;
  const n = parseFloat(m[0]);
  return /%/.test(v) ? n / 100 : n;
}

export function weaponPassiveMaxStacks(weaponId: string): number {
  return WEAPON_PASSIVE_EFFECTS[weaponId]?.maxStacks ?? 1;
}

/** The buff a weapon's passive contributes at the given refinement and stacks. */
export function weaponBuffAt(weaponId: string, refine: number, stacks: number): Partial<BuffState> {
  const effect = WEAPON_PASSIVE_EFFECTS[weaponId];
  const data = weaponPassiveFor(weaponId);
  if (!effect || !data) return {};
  const ref = data.refinements[Math.min(Math.max(refine, 1), 5) - 1];
  if (!ref) return {};

  const out: Partial<BuffState> = {};
  for (const line of effect.lines) {
    const base = parseValue(ref.values[line.valueIndex]);
    const mult = line.scales ? stacks : 1;
    if (base === 0) continue;
    out[line.stat] = (out[line.stat] ?? 0) + base * mult;
  }
  return out;
}
