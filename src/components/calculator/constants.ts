import type {
  AdditiveReaction,
  AmplifiedReaction,
  ElementType,
  SecondaryStatType,
  TransformativeReaction,
} from '../../lib/damage';
import type { TalentKey } from '../../data/talents';
import type { TalentGroup } from '../../data/generated/talents';

/**
 * Option lists and label maps for the calculator UI. Data only — no JSX, no
 * React — so this can be imported from anywhere without pulling in a renderer.
 */

export const ELEMENTS: ElementType[] = ['pyro', 'hydro', 'electro', 'cryo', 'anemo', 'geo', 'dendro'];
/** Enemy resistance rows — the seven elements plus Physical. */
export const ENEMY_ELEMENTS: ElementType[] = [...ELEMENTS, 'physical'];
export const SWIRLABLE: ElementType[] = ['pyro', 'hydro', 'electro', 'cryo'];

// Element-tinted tile backgrounds (the transparent portrait sits on top).
export const ELEMENT_BG: Record<string, string> = {
  pyro: 'from-pyro/55 to-pyro/15',
  hydro: 'from-hydro/55 to-hydro/15',
  electro: 'from-electro/55 to-electro/15',
  cryo: 'from-cryo/55 to-cryo/15',
  anemo: 'from-anemo/55 to-anemo/15',
  geo: 'from-geo/55 to-geo/15',
  dendro: 'from-dendro/55 to-dendro/15',
  physical: 'from-gray-400/45 to-gray-400/15',
};

/** Data-viz dots only — never a text colour. */
export const ELEMENT_DOT: Record<string, string> = {
  pyro: 'bg-pyro',
  hydro: 'bg-hydro',
  electro: 'bg-electro',
  cryo: 'bg-cryo',
  anemo: 'bg-anemo',
  geo: 'bg-geo',
  dendro: 'bg-dendro',
  physical: 'bg-gray-400',
};

export const SCALING_LABEL: Record<string, string> = { atk: 'ATK', hp: 'Max HP', def: 'DEF', em: 'Elemental Mastery' };

export const AMPLIFIED: { value: AmplifiedReaction; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'vaporize', label: 'Vaporize' },
  { value: 'melt', label: 'Melt' },
];

export const ADDITIVE: { value: AdditiveReaction; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'aggravate', label: 'Aggravate (Electro on Quicken)' },
  { value: 'spread', label: 'Spread (Dendro on Quicken)' },
];

export const TRANSFORMATIVE: { value: TransformativeReaction; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'overload', label: 'Overload' },
  { value: 'electroCharged', label: 'Electro-Charged' },
  { value: 'superconduct', label: 'Superconduct' },
  { value: 'swirl', label: 'Swirl' },
  { value: 'shatter', label: 'Shatter' },
  { value: 'bloom', label: 'Bloom' },
  { value: 'hyperbloom', label: 'Hyperbloom' },
  { value: 'burgeon', label: 'Burgeon' },
  { value: 'burning', label: 'Burning' },
];

export const ATTACKS: { value: TalentKey; label: string }[] = [
  { value: 'normal', label: 'Normal combo' },
  { value: 'charged', label: 'Charged' },
  { value: 'skill', label: 'Skill' },
  { value: 'burst', label: 'Burst' },
];

/** Reactions a character of each element can trigger (for the Reactions panel). */
export const REACHABLE_REACTIONS: Record<
  ElementType,
  { amplified: AmplifiedReaction[]; transformative: TransformativeReaction[] }
> = {
  pyro: { amplified: ['vaporize', 'melt'], transformative: ['overload', 'burning', 'burgeon', 'shatter'] },
  hydro: { amplified: ['vaporize'], transformative: ['electroCharged', 'bloom', 'hyperbloom', 'burgeon', 'shatter'] },
  cryo: { amplified: ['melt'], transformative: ['superconduct', 'shatter'] },
  electro: { amplified: [], transformative: ['overload', 'superconduct', 'electroCharged', 'hyperbloom'] },
  anemo: { amplified: [], transformative: ['swirl'] },
  geo: { amplified: [], transformative: [] },
  dendro: { amplified: [], transformative: ['burning', 'bloom', 'hyperbloom', 'burgeon'] },
  physical: { amplified: [], transformative: ['shatter'] },
};

/** Map a talent-table group onto the engine's attack-type key (plunge ≈ normal). */
export const GROUP_TO_TALENT: Record<TalentGroup, TalentKey> = {
  normal: 'normal',
  charged: 'charged',
  plunge: 'normal',
  skill: 'skill',
  burst: 'burst',
};

/** Which element(s) each reaction actually deals, for the leading icon. */
export const REACTION_ELEMENT: Record<string, ElementType[]> = {
  vaporize: ['hydro', 'pyro'],
  melt: ['pyro', 'cryo'],
  overload: ['pyro', 'electro'],
  electroCharged: ['hydro', 'electro'],
  superconduct: ['cryo', 'electro'],
  swirl: ['anemo'],
  shatter: ['physical'],
  bloom: ['dendro', 'hydro'],
  hyperbloom: ['dendro', 'electro'],
  burgeon: ['pyro', 'dendro'],
  burning: ['pyro', 'dendro'],
  aggravate: ['electro'],
  spread: ['dendro'],
};

/** Single-path icons, drawn by `Glyph`. */
export const GLYPH: Record<string, string> = {
  normal: 'M5 19L19 5M13 5h6v6',
  charged: 'M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z',
  skill: 'M12 3l7 7-7 7-7-7z',
  burst: 'M13 2L4 14h6l-1 8 9-12h-6z',
  expected: 'M4 19h16M5 15l5-5 4 4 6-6',
  crit: 'M12 2l2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4z',
  nonCrit: 'M5 12h14',
  enemy: 'M12 3v3M12 18v3M3 12h3M18 12h3M12 8a4 4 0 100 8 4 4 0 000-8z',
  atk: 'M12 3v18M7 8l5-5 5 5',
  hp: 'M12 21s-7-4.4-7-10a4 4 0 017-2.5A4 4 0 0119 11c0 5.6-7 10-7 10z',
  def: 'M12 3l8 3v6c0 5-3.5 7.6-8 9-4.5-1.4-8-4-8-9V6z',
  em: 'M12 3l2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4z',
  er: 'M13 2L4 14h6l-1 8 9-12h-6z',
  critRate: 'M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z',
  critDMG: 'M12 2l2.2 6.1L20.5 10l-6.3 1.9L12 18l-2.2-6.1L3.5 10l6.3-1.9z',
  dmg: 'M4 20L20 4M14 4h6v6',
  physical: 'M6 18L18 6M15 6h3v3',
  none: '',
};

export const SECONDARY_LABEL: Record<SecondaryStatType, string> = {
  'atk%': 'ATK%',
  'hp%': 'HP%',
  'def%': 'DEF%',
  flatATK: 'Flat ATK',
  flatHP: 'Flat HP',
  flatDEF: 'Flat DEF',
  critRate: 'CRIT Rate',
  critDMG: 'CRIT DMG',
  em: 'Elemental Mastery',
  er: 'Energy Recharge',
  physical: 'Physical DMG',
  'dmg%': 'DMG Bonus',
  'heal%': 'Healing Bonus',
};

/** Which `GLYPH` path stands in for an artifact sub-stat. */
export const STAT_GLYPH: Record<string, string> = {
  'atk%': 'atk',
  'hp%': 'hp',
  'def%': 'def',
  em: 'em',
  er: 'er',
  critRate: 'critRate',
  critDMG: 'critDMG',
  'dmg%': 'dmg',
  physical: 'physical',
};

export type MainSlot = 'sandsMain' | 'gobletMain' | 'circletMain';

export const MAIN_OPTIONS: { slot: MainSlot; label: string; options: SecondaryStatType[] }[] = [
  { slot: 'sandsMain', label: 'Sands', options: ['atk%', 'hp%', 'def%', 'em', 'er'] },
  { slot: 'gobletMain', label: 'Goblet', options: ['dmg%'] },
  { slot: 'circletMain', label: 'Circlet', options: ['critRate', 'critDMG', 'atk%', 'hp%', 'def%', 'em'] },
];

/** The five artifact slots. */
export type PieceKey = 'flower' | 'plume' | 'sands' | 'goblet' | 'circlet';

/** Flower / plume have a fixed main stat, the rest are selectable. */
export const PIECE_ROWS: {
  piece: PieceKey;
  label: string;
  mainSlot?: MainSlot;
  fixed?: string;
}[] = [
  { piece: 'flower', label: 'Flower', fixed: 'HP +4,780' },
  { piece: 'plume', label: 'Plume', fixed: 'ATK +311' },
  { piece: 'sands', label: 'Sands', mainSlot: 'sandsMain' },
  { piece: 'goblet', label: 'Goblet', mainSlot: 'gobletMain' },
  { piece: 'circlet', label: 'Circlet', mainSlot: 'circletMain' },
];

/** Sub-stat options that can roll on a 5★ artifact (labels only, no dmg%). */
export const SUB_OPTIONS: { type: SecondaryStatType; label: string; percent: boolean }[] = [  { type: 'critRate', label: 'CRIT Rate', percent: true },
  { type: 'critDMG', label: 'CRIT DMG', percent: true },
  { type: 'atk%', label: 'ATK%', percent: true },
  { type: 'hp%', label: 'HP%', percent: true },
  { type: 'def%', label: 'DEF%', percent: true },
  { type: 'em', label: 'Elemental Mastery', percent: false },
  { type: 'er', label: 'Energy Recharge', percent: true },
  { type: 'flatATK', label: 'Flat ATK', percent: false },
  { type: 'flatHP', label: 'Flat HP', percent: false },
  { type: 'flatDEF', label: 'Flat DEF', percent: false },
];

/**
 * Shown wherever a number would otherwise sit for a character with no per-hit
 * talent table (the Miliastra test characters). The headline would otherwise
 * fall back to the placeholder multiplier in characters.ts and print a
 * confident number that traces to no talent. Muted register, not a warning.
 */
export const NO_TALENT_NOTE = 'No talent data for this character — pick another to see damage.';
