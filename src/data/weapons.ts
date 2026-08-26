// ============================================================================
// Weapon data — level-90 base ATK and secondary stat for popular weapons.
// Snapshot: Genshin Impact version 7.0. Base ATK / secondary stat values are
// the level-90 figures; verify edge cases against the live game before launch.
// 3-star weapons are omitted from the calculator (rarity is 4 | 5 only).
// ============================================================================

import type { WeaponData } from '../lib/damage';

export const WEAPONS: WeaponData[] = [
  // ---- Polearms ----
  { id: 'staff-of-homa', name: 'Staff of Homa', weaponType: 'polearm', rarity: 5, baseATK: 608, secondary: { type: 'critDMG', value: 0.662 } },
  { id: 'engulfing-lightning', name: 'Engulfing Lightning', weaponType: 'polearm', rarity: 5, baseATK: 608, secondary: { type: 'er', value: 0.551 } },
  { id: 'primordial-jade-winged-spear', name: 'Primordial Jade Winged-Spear', weaponType: 'polearm', rarity: 5, baseATK: 674, secondary: { type: 'critRate', value: 0.221 } },
  { id: 'staff-of-scarlet-sands', name: 'Staff of the Scarlet Sands', weaponType: 'polearm', rarity: 5, baseATK: 542, secondary: { type: 'critRate', value: 0.441 } },
  { id: 'crimson-moon-semblance', name: 'Crimson Moon Semblance', weaponType: 'polearm', rarity: 5, baseATK: 674, secondary: { type: 'critDMG', value: 0.441 } },
  { id: 'calamity-queller', name: 'Calamity Queller', weaponType: 'polearm', rarity: 5, baseATK: 741, secondary: { type: 'atk%', value: 0.165 } },
  { id: 'vortex-vanquisher', name: 'Vortex Vanquisher', weaponType: 'polearm', rarity: 5, baseATK: 608, secondary: { type: 'atk%', value: 0.496 } },
  { id: 'skyward-spine', name: 'Skyward Spine', weaponType: 'polearm', rarity: 5, baseATK: 674, secondary: { type: 'er', value: 0.368 } },
  { id: 'lumidouce-elegy', name: 'Lumidouce Elegy', weaponType: 'polearm', rarity: 5, baseATK: 608, secondary: { type: 'critDMG', value: 0.662 } },
  { id: 'the-catch', name: 'The Catch', weaponType: 'polearm', rarity: 4, baseATK: 510, secondary: { type: 'er', value: 0.459 } },
  { id: 'deathmatch', name: 'Deathmatch', weaponType: 'polearm', rarity: 4, baseATK: 454, secondary: { type: 'critRate', value: 0.368 } },
  { id: 'dragons-bane', name: "Dragon's Bane", weaponType: 'polearm', rarity: 4, baseATK: 454, secondary: { type: 'em', value: 221 } },
  { id: 'favonius-lance', name: 'Favonius Lance', weaponType: 'polearm', rarity: 4, baseATK: 565, secondary: { type: 'er', value: 0.306 } },
  { id: 'blackcliff-pole', name: 'Blackcliff Pole', weaponType: 'polearm', rarity: 4, baseATK: 510, secondary: { type: 'critDMG', value: 0.551 } },
  { id: 'wavebreakers-fin', name: "Wavebreaker's Fin", weaponType: 'polearm', rarity: 4, baseATK: 620, secondary: { type: 'atk%', value: 0.138 } },

  // ---- Bows ----
  { id: 'amos-bow', name: "Amos' Bow", weaponType: 'bow', rarity: 5, baseATK: 608, secondary: { type: 'atk%', value: 0.496 } },
  { id: 'aqua-simulacra', name: 'Aqua Simulacra', weaponType: 'bow', rarity: 5, baseATK: 542, secondary: { type: 'critDMG', value: 0.882 } },
  { id: 'skyward-harp', name: 'Skyward Harp', weaponType: 'bow', rarity: 5, baseATK: 674, secondary: { type: 'critRate', value: 0.221 } },
  { id: 'thundering-pulse', name: 'Thundering Pulse', weaponType: 'bow', rarity: 5, baseATK: 608, secondary: { type: 'critDMG', value: 0.662 } },
  { id: 'polar-star', name: 'Polar Star', weaponType: 'bow', rarity: 5, baseATK: 608, secondary: { type: 'critRate', value: 0.331 } },
  { id: 'the-first-great-magic', name: 'The First Great Magic', weaponType: 'bow', rarity: 5, baseATK: 608, secondary: { type: 'critDMG', value: 0.662 } },
  { id: 'elegy-for-the-end', name: 'Elegy for the End', weaponType: 'bow', rarity: 5, baseATK: 608, secondary: { type: 'er', value: 0.551 } },
  { id: 'hunters-path', name: "Hunter's Path", weaponType: 'bow', rarity: 5, baseATK: 542, secondary: { type: 'critRate', value: 0.441 } },
  { id: 'astral-vulture', name: "Astral Vulture's Crimson Plumage", weaponType: 'bow', rarity: 5, baseATK: 608, secondary: { type: 'critDMG', value: 0.662 } },
  { id: 'the-stringless', name: 'The Stringless', weaponType: 'bow', rarity: 4, baseATK: 510, secondary: { type: 'em', value: 165 } },
  { id: 'rust', name: 'Rust', weaponType: 'bow', rarity: 4, baseATK: 510, secondary: { type: 'atk%', value: 0.413 } },
  { id: 'favonius-warbow', name: 'Favonius Warbow', weaponType: 'bow', rarity: 4, baseATK: 454, secondary: { type: 'er', value: 0.613 } },
  { id: 'prototype-crescent', name: 'Prototype Crescent', weaponType: 'bow', rarity: 4, baseATK: 510, secondary: { type: 'atk%', value: 0.413 } },

  // ---- Swords ----
  { id: 'mistsplitter-reforged', name: 'Mistsplitter Reforged', weaponType: 'sword', rarity: 5, baseATK: 674, secondary: { type: 'critDMG', value: 0.441 } },
  { id: 'primordial-jade-cutter', name: 'Primordial Jade Cutter', weaponType: 'sword', rarity: 5, baseATK: 542, secondary: { type: 'critRate', value: 0.441 } },
  { id: 'splendor-of-tranquil-waters', name: 'Splendor of Tranquil Waters', weaponType: 'sword', rarity: 5, baseATK: 542, secondary: { type: 'critDMG', value: 0.882 } },
  { id: 'light-of-foliar-incision', name: 'Light of Foliar Incision', weaponType: 'sword', rarity: 5, baseATK: 542, secondary: { type: 'critDMG', value: 0.882 } },
  { id: 'aquila-favonia', name: 'Aquila Favonia', weaponType: 'sword', rarity: 5, baseATK: 674, secondary: { type: 'physical', value: 0.413 } },
  { id: 'freedom-sworn', name: 'Freedom-Sworn', weaponType: 'sword', rarity: 5, baseATK: 608, secondary: { type: 'em', value: 198 } },
  { id: 'haran-geppaku-futsu', name: 'Haran Geppaku Futsu', weaponType: 'sword', rarity: 5, baseATK: 608, secondary: { type: 'critRate', value: 0.331 } },
  { id: 'key-of-khaj-nisut', name: 'Key of Khaj-Nisut', weaponType: 'sword', rarity: 5, baseATK: 542, secondary: { type: 'hp%', value: 0.662 } },
  { id: 'uraku-misugiri', name: 'Uraku Misugiri', weaponType: 'sword', rarity: 5, baseATK: 542, secondary: { type: 'critDMG', value: 0.882 } },
  { id: 'absolution', name: 'Absolution', weaponType: 'sword', rarity: 5, baseATK: 674, secondary: { type: 'critDMG', value: 0.441 } },
  { id: 'favonius-sword', name: 'Favonius Sword', weaponType: 'sword', rarity: 4, baseATK: 454, secondary: { type: 'er', value: 0.613 } },
  { id: 'sacrificial-sword', name: 'Sacrificial Sword', weaponType: 'sword', rarity: 4, baseATK: 454, secondary: { type: 'er', value: 0.613 } },
  { id: 'the-black-sword', name: 'The Black Sword', weaponType: 'sword', rarity: 4, baseATK: 510, secondary: { type: 'critRate', value: 0.276 } },
  { id: 'lions-roar', name: "Lion's Roar", weaponType: 'sword', rarity: 4, baseATK: 510, secondary: { type: 'atk%', value: 0.413 } },

  // ---- Catalysts ----
  { id: 'tome-of-eternal-flow', name: 'Tome of the Eternal Flow', weaponType: 'catalyst', rarity: 5, baseATK: 542, secondary: { type: 'critDMG', value: 0.882 } },
  { id: 'lost-prayer', name: 'Lost Prayer to the Sacred Winds', weaponType: 'catalyst', rarity: 5, baseATK: 608, secondary: { type: 'critRate', value: 0.331 } },
  { id: 'kaguras-verity', name: "Kagura's Verity", weaponType: 'catalyst', rarity: 5, baseATK: 608, secondary: { type: 'critDMG', value: 0.662 } },
  { id: 'a-thousand-floating-dreams', name: 'A Thousand Floating Dreams', weaponType: 'catalyst', rarity: 5, baseATK: 542, secondary: { type: 'em', value: 265 } },
  { id: 'jadefall-splendor', name: "Jadefall's Splendor", weaponType: 'catalyst', rarity: 5, baseATK: 608, secondary: { type: 'hp%', value: 0.496 } },
  { id: 'cashflow-supervision', name: 'Cashflow Supervision', weaponType: 'catalyst', rarity: 5, baseATK: 674, secondary: { type: 'critDMG', value: 0.441 } },
  { id: 'surfs-up', name: "Surf's Up", weaponType: 'catalyst', rarity: 5, baseATK: 542, secondary: { type: 'critDMG', value: 0.882 } },
  { id: 'starcallers-watch', name: "Starcaller's Watch", weaponType: 'catalyst', rarity: 5, baseATK: 542, secondary: { type: 'critDMG', value: 0.882 } },
  { id: 'the-widsith', name: 'The Widsith', weaponType: 'catalyst', rarity: 4, baseATK: 510, secondary: { type: 'critDMG', value: 0.551 } },
  { id: 'sacrificial-fragments', name: 'Sacrificial Fragments', weaponType: 'catalyst', rarity: 4, baseATK: 454, secondary: { type: 'em', value: 221 } },
  { id: 'favonius-codex', name: 'Favonius Codex', weaponType: 'catalyst', rarity: 4, baseATK: 510, secondary: { type: 'er', value: 0.459 } },

  // ---- Claymores ----
  { id: 'wolfs-gravestone', name: "Wolf's Gravestone", weaponType: 'claymore', rarity: 5, baseATK: 608, secondary: { type: 'atk%', value: 0.496 } },
  { id: 'redhorn-stonethresher', name: 'Redhorn Stonethresher', weaponType: 'claymore', rarity: 5, baseATK: 542, secondary: { type: 'critDMG', value: 0.882 } },
  { id: 'beacon-of-the-reed-sea', name: 'Beacon of the Reed Sea', weaponType: 'claymore', rarity: 5, baseATK: 608, secondary: { type: 'critRate', value: 0.331 } },
  { id: 'verdict', name: 'Verdict', weaponType: 'claymore', rarity: 5, baseATK: 674, secondary: { type: 'critRate', value: 0.221 } },
  { id: 'a-thousand-blazing-suns', name: 'A Thousand Blazing Suns', weaponType: 'claymore', rarity: 5, baseATK: 741, secondary: { type: 'critDMG', value: 0.441 } },
  { id: 'the-unforged', name: 'The Unforged', weaponType: 'claymore', rarity: 5, baseATK: 608, secondary: { type: 'atk%', value: 0.496 } },
  { id: 'skyward-pride', name: 'Skyward Pride', weaponType: 'claymore', rarity: 5, baseATK: 674, secondary: { type: 'er', value: 0.368 } },
  { id: 'serpent-spine', name: 'Serpent Spine', weaponType: 'claymore', rarity: 4, baseATK: 510, secondary: { type: 'critRate', value: 0.276 } },
  { id: 'whiteblind', name: 'Whiteblind', weaponType: 'claymore', rarity: 4, baseATK: 510, secondary: { type: 'def%', value: 0.517 } },
  { id: 'lithic-blade', name: 'Lithic Blade', weaponType: 'claymore', rarity: 4, baseATK: 510, secondary: { type: 'atk%', value: 0.413 } },
];

export function getWeapon(id: string): WeaponData | undefined {
  return WEAPONS.find((w) => w.id === id);
}

export function weaponsForType(weaponType: string): WeaponData[] {
  return WEAPONS.filter((w) => w.weaponType === weaponType);
}
