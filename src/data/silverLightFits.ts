export type FitRating = 'good' | 'bad';

export interface SilverLightFit {
  id: string; // maps to public/images/portraits/{id}.webp
  name: string;
  element: 'pyro' | 'hydro' | 'electro' | 'cryo' | 'anemo' | 'geo' | 'dendro';
  rating: FitRating;
  team?: string; // only for "team-restricted" fits, e.g. 'Aggravate'
  reason: string; // one English sentence, <= 160 chars
}

export const SILVER_LIGHT_FITS: SilverLightFit[] = [
  // ---- Good ----
  {
    id: 'vesna',
    name: 'Vesna',
    element: 'anemo',
    rating: 'good',
    reason: "Anemo on-field Stellar Swirl DPS; Stellar Swirl scales with ATK and EM, so both halves of the weapon count.",
  },
  {
    id: 'odette',
    name: 'Odette',
    element: 'cryo',
    rating: 'good',
    reason: "Off-field Stellar Glimmer damage and support; her Skill clone's Stellar damage scales with ATK and EM.",
  },
  {
    id: 'aether',
    name: 'Traveler (Cryo)',
    element: 'cryo',
    rating: 'good',
    reason: 'Deals Stellar Swirl damage with the Enhanced Charged Attack and Burst, and it is a free upgrade over craftable swords.',
  },
  {
    id: 'keqing',
    name: 'Keqing',
    element: 'electro',
    rating: 'good',
    team: 'Aggravate',
    reason: "Holds both EM stacks up thanks to her short Skill cooldown, but the EM only pays off in Aggravate teams.",
  },
  {
    id: 'clorinde',
    name: 'Clorinde',
    element: 'electro',
    rating: 'good',
    team: 'Aggravate',
    reason: "ATK% and EM both apply in Aggravate teams; a strong free alternative to her signature.",
  },
  {
    id: 'alhaitham',
    name: 'Alhaitham',
    element: 'dendro',
    rating: 'good',
    reason: 'Spread DPS whose damage scales with both ATK and Elemental Mastery.',
  },
  // ---- Bad ----
  {
    id: 'kazuha',
    name: 'Kaedehara Kazuha',
    element: 'anemo',
    rating: 'bad',
    reason: "Wants as much EM as possible; swords with an EM sub-stat give him far more than Silver Light's ATK%.",
  },
  {
    id: 'kuki-shinobu',
    name: 'Kuki Shinobu',
    element: 'electro',
    rating: 'bad',
    reason: "Hyperbloom wants EM, not ATK%; EM sub-stat swords do more for her.",
  },
  {
    id: 'bennett',
    name: 'Bennett',
    element: 'pyro',
    rating: 'bad',
    reason: 'Buffs the team from his base ATK and needs Energy Recharge; ATK% and EM do little for him.',
  },
  {
    id: 'furina',
    name: 'Furina',
    element: 'hydro',
    rating: 'bad',
    reason: 'Scales with HP, so ATK% and EM are wasted.',
  },
  {
    id: 'nilou',
    name: 'Nilou',
    element: 'hydro',
    rating: 'bad',
    reason: "Bloom enabler that scales with HP; ATK% does nothing.",
  },
  {
    id: 'ayato',
    name: 'Kamisato Ayato',
    element: 'hydro',
    rating: 'bad',
    reason: 'Pure Hydro damage with no EM-scaling reaction of his own; CRIT and ATK swords do more.',
  },
  {
    id: 'xingqiu',
    name: 'Xingqiu',
    element: 'hydro',
    rating: 'bad',
    reason: 'Off-field Hydro enabler that needs Energy Recharge far more than ATK% or EM.',
  },
  {
    id: 'ayaka',
    name: 'Kamisato Ayaka',
    element: 'cryo',
    rating: 'bad',
    reason: 'Freeze carry; Freeze does not use EM, so half the weapon is wasted.',
  },
  {
    id: 'qiqi',
    name: 'Qiqi',
    element: 'cryo',
    rating: 'bad',
    reason: 'Healer; EM does nothing for her healing.',
  },
  {
    id: 'kaeya',
    name: 'Kaeya',
    element: 'cryo',
    rating: 'bad',
    reason: 'Off-field Cryo that mainly wants Energy Recharge; EM rarely matters for him.',
  },
  {
    id: 'layla',
    name: 'Layla',
    element: 'cryo',
    rating: 'bad',
    reason: 'Shields scale with HP.',
  },
  {
    id: 'lynette',
    name: 'Lynette',
    element: 'anemo',
    rating: 'bad',
    reason: 'Off-field Anemo support; she gains little from ATK% or EM.',
  },
  {
    id: 'jean',
    name: 'Jean',
    element: 'anemo',
    rating: 'bad',
    reason: 'Healer and support who needs Energy Recharge; better swords exist for her.',
  },
  {
    id: 'albedo',
    name: 'Albedo',
    element: 'geo',
    rating: 'bad',
    reason: 'Scales with DEF.',
  },
  {
    id: 'xilonen',
    name: 'Xilonen',
    element: 'geo',
    rating: 'bad',
    reason: 'DEF-scaling support.',
  },
  {
    id: 'chiori',
    name: 'Chiori',
    element: 'geo',
    rating: 'bad',
    reason: 'Scales with ATK and DEF; Geo has no EM-scaling reaction.',
  },
  {
    id: 'kirara',
    name: 'Kirara',
    element: 'dendro',
    rating: 'bad',
    reason: 'Shields scale with HP.',
  },
  {
    id: 'skirk',
    name: 'Skirk',
    element: 'cryo',
    rating: 'bad',
    reason: 'CRIT-focused Cryo DPS with no EM-scaling reaction.',
  },
  {
    id: 'dahlia',
    name: 'Dahlia',
    element: 'hydro',
    rating: 'bad',
    reason: 'Hydro support that gains little from ATK% or EM.',
  },
];
