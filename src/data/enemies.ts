// ============================================================================
// Enemy data — common enemy levels and elemental resistances.
// ============================================================================

import type { EnemyData } from '../lib/damage';

export const ENEMIES: EnemyData[] = [
  {
    id: 'hilichurl',
    name: 'Hilichurl',
    level: 90,
    resistances: { default: 0.1 },
  },
  {
    id: 'abyss-mage',
    name: 'Abyss Mage',
    level: 90,
    resistances: { default: 0.1 },
  },
  {
    id: 'ruin-guard',
    name: 'Ruin Guard',
    level: 90,
    resistances: { default: 0.1, physical: 0.7 },
  },
  {
    id: 'perpetual-mechanical-array',
    name: 'Perpetual Mechanical Array',
    level: 90,
    resistances: { default: 0.1, physical: 0.7 },
  },
  {
    id: 'maguu-kenki',
    name: 'Maguu Kenki',
    level: 90,
    resistances: { default: 0.1 },
  },
  {
    id: 'world-boss',
    name: 'World Boss (generic)',
    level: 90,
    resistances: { default: 0.1 },
  },
];

export function getEnemy(id: string): EnemyData | undefined {
  return ENEMIES.find((e) => e.id === id);
}
