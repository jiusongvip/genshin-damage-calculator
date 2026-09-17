// ============================================================================
// Artifact set effects — numeric, curated from genshin-db v5.2.13 (GI v7.0).
//
// Only the damage-relevant part of each set is encoded. Conditional effects
// (stacks, off-field, HP changes, healing) are baked in at a stated assumption
// — read `note` for what was assumed. Sets with no damage effect are omitted.
//
// Values are fractions (0.15 = 15%). Element-specific bonuses apply only when
// the attack element matches; attack-type bonuses only for that attack type.
// ============================================================================

import type { BuffState, ElementType } from '../lib/damage';
import type { TalentKey } from './talents';

export interface SetEffect {
  /** static stat buffs (always apply while the set is worn) */
  buffs?: Partial<BuffState>;
  /** DMG bonus that applies only when the attack element matches */
  elemDmg?: { element: ElementType; value: number };
  /** DMG bonus that applies only to the listed attack types */
  typeDmg?: Partial<Record<TalentKey, number>>;
}

export interface ArtifactSet {
  id: string;
  name: string;
  two: SetEffect;
  four: SetEffect;
  /** what was assumed for conditional effects */
  note?: string;
}

export const ARTIFACT_SETS: ArtifactSet[] = [
  {
    id: 'crimson-witch-of-flames',
    name: 'Crimson Witch of Flames',
    two: { elemDmg: { element: 'pyro', value: 0.15 } },
    four: { elemDmg: { element: 'pyro', value: 0.225 }, buffs: { ampReactionBonus: 0.15, transformReactionBonus: 0.4 } },
    note: '4pc assumes max 3 stacks (2pc +50% ×3); Vaporize/Melt +15%, Overload/Burning/Burgeon +40%.',
  },
  {
    id: 'emblem-of-severed-fate',
    name: 'Emblem of Severed Fate',
    two: {},
    four: { typeDmg: { burst: 0.5 } },
    note: '4pc = Burst DMG +25% of Energy Recharge (assumes 200% ER → +50%; cap +75%).',
  },
  {
    id: 'golden-troupe',
    name: 'Golden Troupe',
    two: { typeDmg: { skill: 0.2 } },
    four: { typeDmg: { skill: 0.5 } },
    note: '4pc assumes the full +50% (25% + 25% off-field).',
  },
  {
    id: 'marechaussee-hunter',
    name: 'Marechaussee Hunter',
    two: { typeDmg: { normal: 0.15, charged: 0.15 } },
    four: { buffs: { critRate: 0.36 } },
    note: '4pc assumes max 3 stacks (+36% CRIT Rate).',
  },
  {
    id: 'blizzard-strayer',
    name: 'Blizzard Strayer',
    two: { elemDmg: { element: 'cryo', value: 0.15 } },
    four: { buffs: { critRate: 0.4 } },
    note: '4pc assumes +40% CRIT Rate (Cryo-affected + Frozen).',
  },
  {
    id: 'thundering-fury',
    name: 'Thundering Fury',
    two: { elemDmg: { element: 'electro', value: 0.15 } },
    four: { buffs: { transformReactionBonus: 0.4 } },
    note: '4pc: Overload/Electro-Charged/Superconduct/Hyperbloom +40%, Aggravate +20% (uses +40%).',
  },
  {
    id: 'viridescent-venerer',
    name: 'Viridescent Venerer',
    two: { elemDmg: { element: 'anemo', value: 0.15 } },
    four: { buffs: { resShred: 0.4 } },
    note: '4pc: Swirl reduces the swirled element RES by 40%.',
  },
  {
    id: 'deepwood-memories',
    name: 'Deepwood Memories',
    two: { elemDmg: { element: 'dendro', value: 0.15 } },
    four: { buffs: { resShred: 0.3 } },
    note: '4pc: Dendro RES −30% after Skill/Burst hit.',
  },
  {
    id: 'gilded-dreams',
    name: 'Gilded Dreams',
    two: { buffs: { em: 80 } },
    four: { buffs: { em: 150 } },
    note: '4pc assumes 3 different-element teammates (EM +50 ×3).',
  },
  {
    id: 'noblesse-oblige',
    name: 'Noblesse Oblige',
    two: { typeDmg: { burst: 0.2 } },
    four: { buffs: { atkPercent: 0.2 } },
    note: '4pc: party ATK +20% after Burst.',
  },
  {
    id: 'tenacity-of-the-millelith',
    name: 'Tenacity of the Millelith',
    two: { buffs: { hpPercent: 0.2 } },
    four: { buffs: { atkPercent: 0.2 } },
    note: '4pc: party ATK +20% after Skill hit.',
  },
  {
    id: 'heart-of-depth',
    name: 'Heart of Depth',
    two: { elemDmg: { element: 'hydro', value: 0.15 } },
    four: { typeDmg: { normal: 0.3, charged: 0.3 } },
    note: '4pc: Normal/Charged +30% after Skill.',
  },
  {
    id: 'gladiators-finale',
    name: "Gladiator's Finale",
    two: { buffs: { atkPercent: 0.18 } },
    four: { typeDmg: { normal: 0.35 } },
    note: '4pc: Normal Attack +35% (sword/claymore/polearm only).',
  },
  {
    id: 'shimenawas-reminiscence',
    name: "Shimenawa's Reminiscence",
    two: { buffs: { atkPercent: 0.18 } },
    four: { typeDmg: { normal: 0.5, charged: 0.5 } },
    note: '4pc: Normal/Charged/Plunge +50% (costs 15 Energy).',
  },
  {
    id: 'vermillion-hereafter',
    name: 'Vermillion Hereafter',
    two: { buffs: { atkPercent: 0.18 } },
    four: { buffs: { atkPercent: 0.48 } },
    note: '4pc assumes max stacks (ATK +8% + 10% ×4).',
  },
  {
    id: 'husk-of-opulent-dreams',
    name: 'Husk of Opulent Dreams',
    two: { buffs: { defPercent: 0.3 } },
    four: { buffs: { defPercent: 0.24 }, elemDmg: { element: 'geo', value: 0.24 } },
    note: '4pc assumes 4 Curiosity stacks (DEF +24%, Geo DMG +24%).',
  },
  {
    id: 'obsidian-codex',
    name: 'Obsidian Codex',
    two: { buffs: { dmgBonus: 0.15 } },
    four: { buffs: { critRate: 0.4 } },
    note: '2pc: +15% DMG in Nightsoul’s Blessing; 4pc: +40% CRIT Rate for 6s.',
  },
  {
    id: 'fragment-of-harmonic-whimsy',
    name: 'Fragment of Harmonic Whimsy',
    two: { buffs: { atkPercent: 0.18 } },
    four: { buffs: { dmgBonus: 0.54 } },
    note: '4pc assumes max 3 stacks (+18% ×3 DMG).',
  },
  {
    id: 'unfinished-reverie',
    name: 'Unfinished Reverie',
    two: { buffs: { atkPercent: 0.18 } },
    four: { buffs: { dmgBonus: 0.5 } },
    note: '4pc assumes the full +50% (out of combat / Burning nearby).',
  },
  {
    id: 'nighttime-whispers',
    name: 'Nighttime Whispers in the Echoing Woods',
    two: { buffs: { atkPercent: 0.18 } },
    four: { elemDmg: { element: 'geo', value: 0.5 } },
    note: '4pc assumes +20% ×(1+150%) = +50% Geo DMG (shielded).',
  },
  {
    id: 'archaic-petra',
    name: 'Archaic Petra',
    two: { elemDmg: { element: 'geo', value: 0.15 } },
    four: { buffs: { dmgBonus: 0.35 } },
    note: '4pc: +35% DMG for the crystallized element.',
  },
  {
    id: 'pale-flame',
    name: 'Pale Flame',
    two: { elemDmg: { element: 'physical', value: 0.25 } },
    four: { buffs: { atkPercent: 0.18 }, elemDmg: { element: 'physical', value: 0.25 } },
    note: '4pc assumes 2 stacks: ATK +18%, and the 2pc Physical DMG doubled (+25%).',
  },
  {
    id: 'scroll-of-the-hero-of-cinder-city',
    name: 'Scroll of the Hero of Cinder City',
    two: {},
    four: { buffs: { dmgBonus: 0.4 } },
    note: '4pc assumes 12% + 28% (Nightsoul’s Blessing) = +40% elemental DMG.',
  },
  {
    id: 'wanderers-troupe',
    name: "Wanderer's Troupe",
    two: { buffs: { em: 80 } },
    four: { typeDmg: { charged: 0.35 } },
    note: '4pc: Charged Attack +35% (catalyst / bow only).',
  },
];

export const SET_BY_ID: Record<string, ArtifactSet> = Object.fromEntries(
  ARTIFACT_SETS.map((s) => [s.id, s]),
);

export interface SetPick {
  id: string;
  pieces: 2 | 4;
}

function applyEffect(out: Partial<BuffState>, eff: SetEffect, element: ElementType, attackType: TalentKey): void {
  if (eff.buffs) {
    for (const key of Object.keys(eff.buffs) as (keyof BuffState)[]) {
      out[key] = (out[key] ?? 0) + (eff.buffs[key] ?? 0);
    }
  }
  if (eff.elemDmg && eff.elemDmg.element === element) {
    out.dmgBonus = (out.dmgBonus ?? 0) + eff.elemDmg.value;
  }
  if (eff.typeDmg) {
    const v = eff.typeDmg[attackType] ?? 0;
    if (v) out.dmgBonus = (out.dmgBonus ?? 0) + v;
  }
}

/** Sum the damage-relevant buffs from the chosen sets for this element + attack type. */
export function resolveSetBuffs(picks: SetPick[], element: ElementType, attackType: TalentKey): Partial<BuffState> {
  const out: Partial<BuffState> = {};
  for (const p of picks) {
    const s = SET_BY_ID[p.id];
    if (!s) continue;
    applyEffect(out, s.two, element, attackType);
    if (p.pieces === 4) applyEffect(out, s.four, element, attackType);
  }
  return out;
}
