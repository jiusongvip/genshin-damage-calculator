// ============================================================================
// Official media — character splash art (official game art via enka.network)
// and official videos (YouTube). Video IDs are filled in as confirmed links.
// ============================================================================

export interface FeaturedCharacter {
  /** enka.network asset name (also the file name under /images/official). */
  id: string;
  name: string;
  element: 'pyro' | 'hydro' | 'electro' | 'cryo' | 'anemo' | 'geo' | 'dendro';
  role: string;
}

export const FEATURED_CHARACTERS: FeaturedCharacter[] = [
  { id: 'mavuika', name: 'Mavuika', element: 'pyro', role: 'Pyro Archon · Burst nuke' },
  { id: 'furina', name: 'Furina', element: 'hydro', role: 'Off-field DPS · Team buffer' },
  { id: 'clorinde', name: 'Clorinde', element: 'electro', role: 'Aggravate DPS' },
  { id: 'ganyu', name: 'Ganyu', element: 'cryo', role: 'Charged-shot carry' },
  { id: 'kazuha', name: 'Kazuha', element: 'anemo', role: 'Best Anemo buffer' },
  { id: 'zhongli', name: 'Zhongli', element: 'geo', role: 'Shield · Burst nuke' },
  { id: 'nahida', name: 'Nahida', element: 'dendro', role: 'Dendro enabler' },
];

export interface OfficialVideo {
  /** YouTube video id. */
  id: string;
  title: string;
  type: string;
}

/** Official Genshin Impact videos. Populated from user-confirmed links. */
export const OFFICIAL_VIDEOS: OfficialVideo[] = [];

export const OFFICIAL_YOUTUBE = 'https://www.youtube.com/@GenshinImpact';
