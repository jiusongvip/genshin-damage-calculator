// ============================================================================
// Enemy data — common enemy levels and elemental resistances.
//
// Resistance provenance: every enemy in Genshin carries the documented default
// 10% RES to all elements and Physical (KQM Combat Mechanics, matching the
// per-enemy wiki tables). The only broadly-published exception is the mechanical
// (Ruin/Perpetual) family's +70% Physical RES, which is encoded here. Enemies
// with special elemental profiles (Hypostases, Regisvines, shielded elites) are
// deliberately NOT listed with invented numbers — the calculator's custom RES
// override exists for exactly that case.
// Names follow genshin-db v5.2.13 exactly so the list stays re-checkable.
// ============================================================================

import type { EnemyData } from '../lib/damage';

/** The documented default: 10% RES to everything. */
const flat = { default: 0.1 };
/** Mechanical family: 10% elemental, 70% Physical. */
const mech = { default: 0.1, physical: 0.7 };

export const ENEMIES: EnemyData[] = [
  {
    id: 'hilichurl',
    name: 'Hilichurl',
    level: 90,
    resistances: flat,
  },
  {
    id: 'abyss-mage',
    name: 'Abyss Mage',
    level: 90,
    resistances: flat,
  },
  {
    id: 'ruin-guard',
    name: 'Ruin Guard',
    level: 90,
    resistances: mech,
  },
  {
    id: 'perpetual-mechanical-array',
    name: 'Perpetual Mechanical Array',
    level: 90,
    resistances: mech,
  },
  {
    id: 'maguu-kenki',
    name: 'Maguu Kenki',
    level: 90,
    resistances: flat,
  },
  {
    id: 'world-boss',
    name: 'World Boss (generic)',
    level: 90,
    resistances: flat,
  },

  // ---- weekly bosses (uniform 10% RES — the standing trivia) ----
  { id: 'stormterror', name: 'Stormterror', level: 90, resistances: flat },
  { id: 'lupus-boreas', name: 'Lupus Boreas, Dominator of Wolves', level: 90, resistances: flat },
  { id: 'childe', name: 'Childe', level: 90, resistances: flat },
  { id: 'magatsu', name: 'Magatsu Mitake Narukami no Mikoto', level: 90, resistances: flat },
  { id: 'shouki-no-kami', name: 'Shouki no Kami, the Prodigal', level: 90, resistances: flat },
  { id: 'la-signora', name: 'La Signora', level: 90, resistances: flat },
  { id: 'azhdaha', name: 'Azhdaha', level: 90, resistances: flat },
  { id: 'all-devouring-narwhal', name: 'All-Devouring Narwhal', level: 90, resistances: flat },
  { id: 'apep', name: "Guardian of Apep's Oasis", level: 90, resistances: flat },
  { id: 'lord-of-eroded-primal-fire', name: 'Lord of Eroded Primal Fire', level: 90, resistances: flat },

  // ---- Abyss expedition regulars ----
  { id: 'abyss-lector-fathomless-flames', name: 'Abyss Lector: Fathomless Flames', level: 90, resistances: flat },
  { id: 'abyss-lector-violet-lightning', name: 'Abyss Lector: Violet Lightning', level: 90, resistances: flat },
  { id: 'abyss-herald-wicked-torrents', name: 'Abyss Herald: Wicked Torrents', level: 90, resistances: flat },
  { id: 'abyss-herald-frost-fall', name: 'Abyss Herald: Frost Fall', level: 90, resistances: flat },
  { id: 'mirror-maiden', name: 'Mirror Maiden', level: 90, resistances: flat },
  { id: 'fatui-electro-cicin-mage', name: 'Fatui Electro Cicin Mage', level: 90, resistances: flat },
  { id: 'thundercraven-rifthound', name: 'Thundercraven Rifthound', level: 90, resistances: flat },
  { id: 'shadowy-husk-standard-bearer', name: 'Shadowy Husk: Standard Bearer', level: 90, resistances: flat },
  { id: 'iniquitous-baptist', name: 'Iniquitous Baptist', level: 90, resistances: flat },
  { id: 'golden-wolflord', name: 'Golden Wolflord', level: 90, resistances: flat },

  // ---- overworld elite families ----
  { id: 'stonehide-lawachurl', name: 'Stonehide Lawachurl', level: 90, resistances: flat },
  { id: 'frostarm-lawachurl', name: 'Frostarm Lawachurl', level: 90, resistances: flat },
  { id: 'thunderhelm-lawachurl', name: 'Thunderhelm Lawachurl', level: 90, resistances: flat },
  { id: 'rock-shieldwall-mitachurl', name: 'Rock Shieldwall Mitachurl', level: 90, resistances: flat },
  { id: 'blazing-axe-mitachurl', name: 'Blazing Axe Mitachurl', level: 90, resistances: flat },
  { id: 'electro-samachurl', name: 'Electro Samachurl', level: 90, resistances: flat },
  { id: 'geo-samachurl', name: 'Geo Samachurl', level: 90, resistances: flat },
  { id: 'ruin-sentinel', name: 'Ruin Sentinel', level: 90, resistances: mech },
  { id: 'legatus-golem', name: 'Legatus Golem', level: 90, resistances: flat },
];

export function getEnemy(id: string): EnemyData | undefined {
  return ENEMIES.find((e) => e.id === id);
}
