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
  'vortex-vanquisher': { lines: [{ stat: 'atkPercent', valueIndex: 1, scales: true }], maxStacks: 5 },
  'skyward-spine': { lines: [{ stat: 'critRate', valueIndex: 0 }], maxStacks: 1 },
  'lumidouce-elegy': { lines: [{ stat: 'atkPercent', valueIndex: 0 }], maxStacks: 1, note: 'Triggered party DMG buff is not modelled.' },
  'the-catch': { lines: [{ stat: 'burstDmgBonus', valueIndex: 0 }], maxStacks: 1, note: 'Elemental Burst CRIT Rate is not modelled.' },
  deathmatch: { lines: [{ stat: 'atkPercent', valueIndex: 0 }], maxStacks: 1, note: 'Assumes 2+ opponents nearby.' },
  'dragons-bane': { lines: [{ stat: 'dmgBonus', valueIndex: 0 }], maxStacks: 1, note: 'Assumes a Hydro- or Pyro-affected target.' },
  'blackcliff-pole': { lines: [{ stat: 'atkPercent', valueIndex: 0, scales: true }], maxStacks: 3, note: 'Assumes the on-kill stacks are active.' },

  // ---- Bows ----
  'amos-bow': { lines: [{ stat: 'naDmgBonus', valueIndex: 0 }], maxStacks: 1, note: 'Distance-based bonus is not modelled.' },
  'aqua-simulacra': { lines: [{ stat: 'hpPercent', valueIndex: 0 }, { stat: 'dmgBonus', valueIndex: 1 }], maxStacks: 1 },
  'skyward-harp': { lines: [{ stat: 'critDMG', valueIndex: 0 }], maxStacks: 1 },
  'thundering-pulse': { lines: [{ stat: 'atkPercent', valueIndex: 0 }], maxStacks: 1, note: 'Normal Attack emblem tiers are not modelled.' },
  'polar-star': { lines: [{ stat: 'skillDmgBonus', valueIndex: 0 }], maxStacks: 1, note: 'Also applies to Elemental Burst; ATK stacks are not modelled.' },
  'the-first-great-magic': { lines: [{ stat: 'caDmgBonus', valueIndex: 0 }], maxStacks: 1, note: 'Party-based ATK is not modelled.' },
  'elegy-for-the-end': { lines: [{ stat: 'em', valueIndex: 0 }], maxStacks: 1, note: 'Triggered party EM/ATK buffs are not modelled.' },
  'hunters-path': { lines: [{ stat: 'dmgBonus', valueIndex: 0 }], maxStacks: 1, note: 'Charged Attack DMG from EM is not modelled.' },
  'astral-vulture': { lines: [{ stat: 'atkPercent', valueIndex: 0 }], maxStacks: 1, note: 'Assumes a Swirl has just been triggered.' },
  'the-stringless': { lines: [{ stat: 'skillDmgBonus', valueIndex: 0 }], maxStacks: 1, note: 'Also applies to Elemental Burst.' },
  rust: { lines: [{ stat: 'naDmgBonus', valueIndex: 0 }], maxStacks: 1, note: 'Charged Attack penalty is not modelled.' },
  'prototype-crescent': { lines: [{ stat: 'atkPercent', valueIndex: 0 }], maxStacks: 1, note: 'Assumes a weak-point hit.' },

  // ---- Swords ----
  'mistsplitter-reforged': { lines: [{ stat: 'dmgBonus', valueIndex: 0 }], maxStacks: 1, note: "Tiered Mistsplitter's Emblem bonus is not modelled." },
  'primordial-jade-cutter': { lines: [{ stat: 'hpPercent', valueIndex: 0 }, { stat: 'atkFromHP', valueIndex: 1 }], maxStacks: 1 },
  'splendor-of-tranquil-waters': { lines: [{ stat: 'skillDmgBonus', valueIndex: 0, scales: true }], maxStacks: 3 },
  'light-of-foliar-incision': { lines: [{ stat: 'critRate', valueIndex: 0 }], maxStacks: 1, note: 'Normal Attack DMG from EM is not modelled.' },
  'aquila-favonia': { lines: [{ stat: 'atkPercent', valueIndex: 0 }], maxStacks: 1 },
  'freedom-sworn': { lines: [{ stat: 'dmgBonus', valueIndex: 0 }], maxStacks: 1, note: 'Triggered party buffs are not modelled.' },
  'haran-geppaku-futsu': { lines: [{ stat: 'dmgBonus', valueIndex: 0 }], maxStacks: 1 },
  'key-of-khaj-nisut': { lines: [{ stat: 'hpPercent', valueIndex: 0 }], maxStacks: 1, note: 'EM sharing is not modelled.' },
  'uraku-misugiri': { lines: [{ stat: 'naDmgBonus', valueIndex: 0 }, { stat: 'skillDmgBonus', valueIndex: 1 }], maxStacks: 1 },
  absolution: { lines: [{ stat: 'critDMG', valueIndex: 0 }], maxStacks: 1, note: 'Bond of Life DMG bonus is not modelled.' },
  'the-black-sword': { lines: [{ stat: 'naDmgBonus', valueIndex: 0 }], maxStacks: 1, note: 'Also applies to Charged Attacks.' },
  'lions-roar': { lines: [{ stat: 'dmgBonus', valueIndex: 0 }], maxStacks: 1, note: 'Assumes a Pyro- or Electro-affected target.' },

  // ---- Catalysts ----
  'tome-of-eternal-flow': { lines: [{ stat: 'hpPercent', valueIndex: 0 }, { stat: 'caDmgBonus', valueIndex: 1, scales: true }], maxStacks: 3 },
  'crimson-moon-semblance': { lines: [{ stat: 'dmgBonus', valueIndex: 0 }, { stat: 'dmgBonus', valueIndex: 1 }], maxStacks: 1, note: 'Assumes a Bond of Life of at least 30% Max HP (full bonus).' },
  'jadefall-splendor': { lines: [{ stat: 'dmgBonusFromHP', valueIndex: 1 }, { stat: 'dmgBonusFromHPMax', valueIndex: 2 }], maxStacks: 1, note: 'Assumes Primordial Jade Regalia is active (after Burst / shield).' },
  'lost-prayer': { lines: [{ stat: 'dmgBonus', valueIndex: 0, scales: true }], maxStacks: 4 },
  'kaguras-verity': { lines: [{ stat: 'skillDmgBonus', valueIndex: 0, scales: true }], maxStacks: 3, note: 'Stellar-Conduct bonus is not modelled.' },
  'a-thousand-floating-dreams': { lines: [{ stat: 'em', valueIndex: 0 }], maxStacks: 1, note: 'Party-based EM / DMG buffs are not modelled.' },
  'cashflow-supervision': { lines: [{ stat: 'atkPercent', valueIndex: 0 }, { stat: 'naDmgBonus', valueIndex: 1, scales: true }], maxStacks: 3, note: 'Charged and Plunging bonuses are not modelled.' },
  'surfs-up': { lines: [{ stat: 'hpPercent', valueIndex: 0 }, { stat: 'naDmgBonus', valueIndex: 1, scales: true }], maxStacks: 4 },
  'starcallers-watch': { lines: [{ stat: 'em', valueIndex: 0 }], maxStacks: 1, note: 'Party EM sharing is not modelled.' },

  // ---- Claymores ----
  'wolfs-gravestone': { lines: [{ stat: 'atkPercent', valueIndex: 0 }], maxStacks: 1, note: 'On-kill party ATK is not modelled.' },
  'redhorn-stonethresher': { lines: [{ stat: 'defPercent', valueIndex: 0 }], maxStacks: 1, note: 'Normal/Charged DMG from DEF is not modelled.' },
  'beacon-of-the-reed-sea': { lines: [{ stat: 'atkPercent', valueIndex: 0 }], maxStacks: 1 },
  verdict: { lines: [{ stat: 'atkPercent', valueIndex: 0 }], maxStacks: 1 },
  'a-thousand-blazing-suns': { lines: [{ stat: 'critDMG', valueIndex: 0 }, { stat: 'atkPercent', valueIndex: 1 }], maxStacks: 1 },
  'the-unforged': { lines: [{ stat: 'atkPercent', valueIndex: 1, scales: true }], maxStacks: 5 },
  'skyward-pride': { lines: [{ stat: 'dmgBonus', valueIndex: 0 }], maxStacks: 1 },
  'serpent-spine': { lines: [{ stat: 'dmgBonus', valueIndex: 0, scales: true }], maxStacks: 5 },
  whiteblind: { lines: [{ stat: 'atkPercent', valueIndex: 0, scales: true }, { stat: 'defPercent', valueIndex: 0, scales: true }], maxStacks: 4 },
  'lithic-blade': { lines: [{ stat: 'atkPercent', valueIndex: 0, scales: true }, { stat: 'critRate', valueIndex: 1, scales: true }], maxStacks: 4, note: 'Assumes a full-Liyue party.' },
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
