// ============================================================================
// Element metadata — labels, order, and Tailwind dot/color classes used across
// the character directory pages.
// ============================================================================

import type { ElementType } from '../lib/damage';

export const ELEMENT_ORDER: ElementType[] = [
  'pyro',
  'hydro',
  'electro',
  'cryo',
  'anemo',
  'geo',
  'dendro',
];

export const ELEMENT_LABEL: Record<ElementType, string> = {
  pyro: 'Pyro',
  hydro: 'Hydro',
  electro: 'Electro',
  cryo: 'Cryo',
  anemo: 'Anemo',
  geo: 'Geo',
  dendro: 'Dendro',
  physical: 'Physical',
};

export const ELEMENT_DOT: Record<ElementType, string> = {
  pyro: 'bg-pyro',
  hydro: 'bg-hydro',
  electro: 'bg-electro',
  cryo: 'bg-cryo',
  anemo: 'bg-anemo',
  geo: 'bg-geo',
  dendro: 'bg-dendro',
  physical: 'bg-physical',
};

export const ELEMENT_TEXT: Record<ElementType, string> = {
  pyro: 'text-pyro',
  hydro: 'text-hydro',
  electro: 'text-electro',
  cryo: 'text-cryo',
  anemo: 'text-anemo',
  geo: 'text-geo',
  dendro: 'text-dendro',
  physical: 'text-gray-400',
};
