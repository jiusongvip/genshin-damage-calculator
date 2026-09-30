// ============================================================================
// Weapon guide pages — the collection surfaced in the footer "Weapons" column.
// Add one entry here whenever a new dedicated weapon page is created under
// src/pages/. Keeping it in one list means the footer (and any future weapons
// index) stays in sync without touching component markup.
// ============================================================================

export interface WeaponPage {
  name: string;
  href: string;
  /** Square icon under /images/weapons (falls back to a glyph if absent). */
  icon: string;
  rarity: number;
  type: 'sword' | 'claymore' | 'polearm' | 'bow' | 'catalyst';
}

export const WEAPON_PAGES: WeaponPage[] = [
  { name: 'Silver Light', href: '/silver-light/', icon: '/images/weapons/silver-light.webp', rarity: 4, type: 'sword' },
];
