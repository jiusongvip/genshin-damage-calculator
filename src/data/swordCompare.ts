import { WEAPONS } from './weapons';
import { WEAPON_PASSIVES } from './generated/weaponPassives';

export interface SwordRow {
  id: string;
  name: string;
  icon: string; // /images/weapons/{id}.webp
  baseATK: number;
  subStat: string; // formatted, e.g. "ATK 41.3%"
  passiveName: string;
  passiveDesc: string; // R1
  badge?: 'Stronger' | 'About even' | 'Different use';
  verdict?: string; // vs Silver Light; only the 4 swords with a verdict
}

// Manual entries for swords not yet in the generated dataset.
const MANUAL = [
  {
    id: 'silver-light',
    name: 'Silver Light',
    baseATK: 510,
    subStat: 'ATK 41.3%',
    passiveName: 'Radiance on the Water',
    passiveDesc:
      'Increases Elemental Mastery by 52 for 12s after Elemental Skill use. Max 2 stacks, and each stack\u2019s duration is independent of the others.',
  },
  {
    id: 'new-bough',
    name: 'New Bough',
    baseATK: 510,
    subStat: 'CRIT DMG 55.1%',
    passiveName: 'Wildgrowth',
    passiveDesc:
      'When the equipping character hits the opponent with an attack within 12s after using the Elemental Skill, they gain the "Verdant" effect, which increases their ATK by 4% and their Elemental Mastery by 20. This effect lasts 6s and can trigger once every second. Max 3 stacks.',
  },
];

const VERDICTS: Record<string, { badge: SwordRow['badge']; verdict: string }> = {
  'new-bough': { badge: 'Stronger', verdict: 'Best 4\u2605 for Stellar users, but gacha-only' },
  emberwell: { badge: 'Stronger', verdict: 'Slightly ahead at R5 \u2014 if the wielder triggers the reactions' },
  'finale-of-the-deep': { badge: 'About even', verdict: 'Ahead only with a healer clearing its Bond of Life' },
  'lions-roar': { badge: 'Different use', verdict: 'Aggravate pick (Keqing); nothing for Stellar teams' },
};

function fmtSub(type: string, value: number): string {
  const pct = (n: number) => {
    const s = n.toFixed(1).replace(/\.0$/, '');
    return s;
  };
  switch (type) {
    case 'atk%':
      return `ATK ${pct(value * 100)}%`;
    case 'def%':
      return `DEF ${pct(value * 100)}%`;
    case 'hp%':
      return `HP ${pct(value * 100)}%`;
    case 'critRate':
      return `CRIT Rate ${pct(value * 100)}%`;
    case 'critDMG':
      return `CRIT DMG ${pct(value * 100)}%`;
    case 'er':
      return `Energy Recharge ${pct(value * 100)}%`;
    case 'physical':
      return `Physical DMG ${pct(value * 100)}%`;
    case 'em':
      return `Elemental Mastery ${Math.round(value)}`;
    default:
      return `${type} ${value}`;
  }
}

export const SWORDS: SwordRow[] = [
  ...WEAPONS.filter((w) => w.weaponType === 'sword' && w.rarity === 4).map((w) => {
    const p = WEAPON_PASSIVES[w.id];
    return {
      id: w.id,
      name: w.name,
      icon: `/images/weapons/${w.id}.webp`,
      baseATK: w.baseATK,
      subStat: fmtSub(w.secondary.type, w.secondary.value),
      passiveName: p?.effectName ?? '\u2014',
      passiveDesc: p?.refinements?.[0]?.description ?? '\u2014',
      ...(VERDICTS[w.id] ?? {}),
    };
  }),
  ...MANUAL.map((m) => ({
    ...m,
    icon: `/images/weapons/${m.id}.webp`,
    ...(VERDICTS[m.id] ?? {}),
  })),
];

// Swords that carry a verdict, in the fixed order for the selector.
export const VERDICT_IDS = ['new-bough', 'emberwell', 'finale-of-the-deep', 'lions-roar'];

export const SILVER_LIGHT_ID = 'silver-light';
