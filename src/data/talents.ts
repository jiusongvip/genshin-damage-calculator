// ============================================================================
// Talent multipliers — AUTO-GENERATED from genshin-db v5.2.13 (GI v7.0).
//
// Per attack type, talent level 10 (index 9 of each talent parameter array).
//   normal  = full Normal Attack combo (sum of every "N-Hit DMG")
//   charged = Charged Attack (sum of charged entries)
//   skill   = Elemental Skill main hit (highest single multiplier)
//   burst   = Elemental Burst main hit (highest single multiplier)
//
// 0 means the talent deals no direct damage (e.g. Itto's burst is a buff).
// Do not edit by hand — regenerate from the source dataset.
// ============================================================================

export interface CharacterTalents {
  normal: number;
  charged: number;
  skill: number;
  skillLabel: string;
  burst: number;
  burstLabel: string;
}

export const TALENTS: Record<string, CharacterTalents> = {
  'hu-tao': { normal: 6.713, charged: 2.426, skill: 1.152, skillLabel: "Blood Blossom DMG", burst: 6.174, burstLabel: "Low HP Skill DMG" },
  'arlecchino': { normal: 7.801, charged: 1.795, skill: 2.404, skillLabel: "Cleave DMG", burst: 6.667, burstLabel: "Skill DMG" },
  'mavuika': { normal: 5.257, charged: 3.832, skill: 3.162, skillLabel: "Flamestrider Plunge DMG", burst: 8.006, burstLabel: "Skill DMG" },
  'diluc': { normal: 8.107, charged: 3.825, skill: 2.318, skillLabel: "3-Hit DMG", burst: 3.672, burstLabel: "Slashing DMG" },
  'klee': { normal: 4.041, charged: 2.832, skill: 1.714, skillLabel: "Jumpy Dumpty DMG", burst: 0.768, burstLabel: "Sparks 'n' Splash DMG" },
  'yoimiya': { normal: 6.158, charged: 0, skill: 1.617, skillLabel: "Blazing Arrow DMG", burst: 2.29, burstLabel: "Skill DMG" },
  'dehya': { normal: 5.846, charged: 3.126, skill: 2.39, skillLabel: "Ranging Flame DMG", burst: 2.55, burstLabel: "Incineration Drive DMG" },
  'lyney': { normal: 3.721, charged: 0, skill: 3.01, skillLabel: "Skill DMG", burst: 7.452, burstLabel: "Explosive Firework DMG" },
  'xiangling': { normal: 4.377, charged: 2.405, skill: 2.003, skillLabel: "Flame DMG", burst: 2.016, burstLabel: "Pyronado DMG" },
  'bennett': { normal: 5.406, charged: 2.305, skill: 3.312, skillLabel: "Charge Level 2 DMG", burst: 4.19, burstLabel: "Skill DMG" },
  'amber': { normal: 4.454, charged: 0, skill: 2.218, skillLabel: "Explosion DMG", burst: 9.098, burstLabel: "Total Fiery Rain DMG" },
  'xinyan': { normal: 7.152, charged: 3.472, skill: 3.053, skillLabel: "Swing DMG", burst: 6.134, burstLabel: "Skill DMG" },
  'yanfei': { normal: 3.357, charged: 10.823, skill: 3.053, skillLabel: "Skill DMG", burst: 3.283, burstLabel: "Skill DMG" },
  'thoma': { normal: 3.601, charged: 2.229, skill: 2.635, skillLabel: "Skill DMG", burst: 1.584, burstLabel: "Skill DMG" },
  'chevreuse': { normal: 4.74, charged: 2.405, skill: 5.083, skillLabel: "Overcharged Ball DMG", burst: 6.627, burstLabel: "Explosive Grenade DMG" },
  'gaming': { normal: 7.857, charged: 3.471, skill: 4.147, skillLabel: "Plunging Attack: Charmed Cloudstrider DMG", burst: 6.667, burstLabel: "Suanni Man Chai Smash DMG" },
  'neuvillette': { normal: 3.117, charged: 2.607, skill: 0.374, skillLabel: "Spiritbreath Thorn DMG", burst: 0.401, burstLabel: "Skill DMG" },
  'furina': { normal: 4.359, charged: 1.467, skill: 0.149, skillLabel: "Mademoiselle Crabaletta DMG", burst: 0.205, burstLabel: "Skill DMG" },
  'yelan': { normal: 3.881, charged: 0, skill: 0.407, skillLabel: "Skill DMG", burst: 0.132, burstLabel: "Skill DMG" },
  'mona': { normal: 3.142, charged: 2.695, skill: 2.39, skillLabel: "Explosion DMG", burst: 7.963, burstLabel: "Illusory Bubble Explosion DMG" },
  'tartaglia': { normal: 6.594, charged: 0, skill: 2.613, skillLabel: "Charged Attack DMG", burst: 8.352, burstLabel: "Skill DMG: Melee" },
  'kokomi': { normal: 4.036, charged: 2.67, skill: 1.965, skillLabel: "Ripple DMG", burst: 0.187, burstLabel: "Skill DMG" },
  'nilou': { normal: 3.283, charged: 2.069, skill: 0.22, skillLabel: "Luminous Illusion/Water Wheel DMG", burst: 0.406, burstLabel: "Lingering Aeon DMG" },
  'ayato': { normal: 5.056, charged: 2.56, skill: 2.006, skillLabel: "Water Illusion DMG", burst: 1.196, burstLabel: "Bloomwater Blade DMG" },
  'sigewinne': { normal: 3.597, charged: 0, skill: 0.041, skillLabel: "Bolstering Bubblebalm DMG", burst: 0.212, burstLabel: "Skill DMG" },
  'mualani': { normal: 2.989, charged: 2.572, skill: 0.156, skillLabel: "Sharky's Bite Base DMG", burst: 1.052, burstLabel: "Skill DMG" },
  'xingqiu': { normal: 5.516, charged: 2.045, skill: 6.466, skillLabel: "Skill DMG", burst: 0.977, burstLabel: "Sword Rain DMG" },
  'barbara': { normal: 3.053, charged: 2.992, skill: 1.051, skillLabel: "Droplet DMG", burst: 0, burstLabel: "" },
  'candace': { normal: 5.846, charged: 2.455, skill: 0.343, skillLabel: "Charged Up DMG", burst: 0.119, burstLabel: "Skill DMG" },
  'raiden-shogun': { normal: 4.995, charged: 1.969, skill: 2.11, skillLabel: "Skill DMG", burst: 7.214, burstLabel: "Musou no Hitotachi Base DMG" },
  'keqing': { normal: 5.324, charged: 3.218, skill: 3.024, skillLabel: "Slashing DMG", burst: 3.398, burstLabel: "Last Attack DMG" },
  'yae-miko': { normal: 2.431, charged: 2.572, skill: 2.133, skillLabel: "Sesshou Sakura DMG: Level 4", burst: 6.009, burstLabel: "Tenko Thunderbolt DMG" },
  'cyno': { normal: 4.58, charged: 2.419, skill: 2.822, skillLabel: "Mortuary Rite DMG", burst: 5.683, burstLabel: "Low/High Plunge DMG" },
  'clorinde': { normal: 6.592, charged: 2.533, skill: 2.017, skillLabel: "Impale the Night DMG", burst: 2.284, burstLabel: "Skill DMG" },
  'varesa': { normal: 2.576, charged: 3.275, skill: 1.915, skillLabel: "Fiery Passion Rush DMG", burst: 10.354, burstLabel: "Fiery Passion Flying Kick DMG" },
  'fischl': { normal: 5.511, charged: 0, skill: 2.078, skillLabel: "Summoning DMG", burst: 3.744, burstLabel: "Falling Thunder DMG" },
  'beidou': { normal: 8.48, charged: 3.125, skill: 2.189, skillLabel: "Base DMG", burst: 2.189, burstLabel: "Skill DMG" },
  'lisa': { normal: 3.119, charged: 3.188, skill: 8.77, skillLabel: "Stack 3 Conductive Hold DMG", burst: 0.658, burstLabel: "Discharge DMG" },
  'razor': { normal: 7.456, charged: 3.472, skill: 5.314, skillLabel: "Hold Skill DMG", burst: 2.88, burstLabel: "Burst DMG" },
  'kujou-sara': { normal: 4.597, charged: 0, skill: 2.264, skillLabel: "Tengu Juurai: Ambush DMG", burst: 7.373, burstLabel: "Tengu Juurai: Titanbreaker DMG" },
  'dori': { normal: 5.986, charged: 3.472, skill: 2.651, skillLabel: "Troubleshooter Shot DMG", burst: 0.286, burstLabel: "Connector DMG" },
  'sethos': { normal: 3.499, charged: 0, skill: 2.081, skillLabel: "Skill DMG", burst: 0, burstLabel: "" },
  'ororon': { normal: 3.258, charged: 0, skill: 3.557, skillLabel: "Spirit Orb DMG", burst: 3.139, burstLabel: "Ritual DMG" },
  'ganyu': { normal: 5.222, charged: 0, skill: 2.376, skillLabel: "Skill DMG", burst: 1.265, burstLabel: "Ice Shard DMG" },
  'ayaka': { normal: 5.097, charged: 1.09, skill: 4.306, skillLabel: "Skill DMG", burst: 3.032, burstLabel: "Bloom DMG" },
  'eula': { normal: 10.935, charged: 3.819, skill: 4.421, skillLabel: "Hold DMG", burst: 7.256, burstLabel: "Lightfall Sword Base DMG" },
  'shenhe': { normal: 5.042, charged: 2.188, skill: 3.398, skillLabel: "Hold Skill DMG", burst: 1.814, burstLabel: "Skill DMG" },
  'wriothesley': { normal: 6.7, charged: 2.753, skill: 1.703, skillLabel: "Enhanced Repelling Fist DMG", burst: 2.29, burstLabel: "Skill DMG" },
  'citlali': { normal: 2.448, charged: 1.786, skill: 1.313, skillLabel: "Obsidian Tzitzimitl DMG", burst: 9.677, burstLabel: "Ice Storm DMG" },
  'qiqi': { normal: 4.692, charged: 2.543, skill: 1.728, skillLabel: "Skill DMG", burst: 5.352, burstLabel: "Stellar-Conduct DMG" },
  'kaeya': { normal: 6.52, charged: 2.533, skill: 3.442, skillLabel: "Skill DMG", burst: 1.397, burstLabel: "Skill DMG" },
  'chongyun': { normal: 6.22, charged: 3.125, skill: 3.097, skillLabel: "Skill DMG", burst: 2.563, burstLabel: "Skill DMG" },
  'diona': { normal: 4.191, charged: 0, skill: 0.755, skillLabel: "Icy Paw DMG", burst: 1.44, burstLabel: "Skill DMG" },
  'rosaria': { normal: 5.736, charged: 2.703, skill: 3.499, skillLabel: "Skill DMG", burst: 4.608, burstLabel: "Skill DMG" },
  'layla': { normal: 3.413, charged: 1.982, skill: 0.265, skillLabel: "Shooting Star DMG", burst: 0.084, burstLabel: "Starlight Slug DMG" },
  'charlotte': { normal: 2.841, charged: 1.809, skill: 2.506, skillLabel: "Photo DMG (Hold)", burst: 1.397, burstLabel: "Skill DMG" },
  'mika': { normal: 5.246, charged: 2.229, skill: 1.512, skillLabel: "Rimestar Flare DMG", burst: 0, burstLabel: "" },
  'freminet': { normal: 7.722, charged: 3.471, skill: 4.382, skillLabel: "Level 4 Shattering Pressure DMG", burst: 5.731, burstLabel: "Skill DMG" },
  'aloy': { normal: 3.683, charged: 0, skill: 3.197, skillLabel: "Freeze Bomb DMG", burst: 6.466, burstLabel: "Skill DMG" },
  'xiao': { normal: 7.552, charged: 2.16, skill: 4.55, skillLabel: "Skill DMG", burst: 0, burstLabel: "" },
  'venti': { normal: 6.152, charged: 0, skill: 6.84, skillLabel: "Hold DMG", burst: 0.338, burstLabel: "Additional Elemental DMG" },
  'kazuha': { normal: 4.607, charged: 2.326, skill: 4.694, skillLabel: "Hold Skill DMG", burst: 4.723, burstLabel: "Slashing DMG" },
  'wanderer': { normal: 4.527, charged: 2.377, skill: 1.714, skillLabel: "Skill DMG", burst: 2.65, burstLabel: "Skill DMG" },
  'xianyun': { normal: 3.473, charged: 2.216, skill: 10.829, skillLabel: "Driftcloud Wave DMG", burst: 1.944, burstLabel: "Skill DMG" },
  'chasca': { normal: 2.921, charged: 0, skill: 2.998, skillLabel: "Shining Shadowhunt Shell DMG", burst: 3.722, burstLabel: "Radiant Soulseeker Shell DMG" },
  'sucrose': { normal: 2.708, charged: 2.163, skill: 3.802, skillLabel: "Skill DMG", burst: 0.792, burstLabel: "Additional Elemental DMG" },
  'sayu': { normal: 6.496, charged: 3.472, skill: 3.917, skillLabel: "Fuufuu Whirlwind Kick Hold DMG", burst: 2.102, burstLabel: "Skill Activation DMG" },
  'heizou': { normal: 4.268, charged: 1.314, skill: 4.095, skillLabel: "Skill DMG", burst: 5.664, burstLabel: "Fudou Style Vacuum Slugger DMG" },
  'faruzan': { normal: 4.165, charged: 0, skill: 2.678, skillLabel: "Skill DMG", burst: 6.797, burstLabel: "Skill DMG" },
  'lynette': { normal: 3.821, charged: 2.088, skill: 4.824, skillLabel: "Enigma Thrust DMG", burst: 1.498, burstLabel: "Skill DMG" },
  'lan-yan': { normal: 3.694, charged: 0.681, skill: 1.733, skillLabel: "Feathermoon Ring DMG", burst: 4.339, burstLabel: "Skill DMG" },
  'zhongli': { normal: 4.125, charged: 2.195, skill: 1.44, skillLabel: "Hold DMG", burst: 8.997, burstLabel: "Skill DMG" },
  'albedo': { normal: 4.601, charged: 2.125, skill: 2.405, skillLabel: "Transient Blossom DMG", burst: 6.61, burstLabel: "Burst DMG" },
  'itto': { normal: 7.205, charged: 0, skill: 5.53, skillLabel: "Skill DMG", burst: 0, burstLabel: "" },
  'navia': { normal: 6.886, charged: 3.471, skill: 7.106, skillLabel: "Rosula Shardshot Base DMG", burst: 1.354, burstLabel: "Skill DMG" },
  'xilonen': { normal: 3.548, charged: 1.805, skill: 3.226, skillLabel: "Rush DMG", burst: 5.063, burstLabel: "Skill DMG" },
  'noelle': { normal: 6.962, charged: 2.791, skill: 2.16, skillLabel: "Skill DMG", burst: 1.67, burstLabel: "Skill DMG" },
  'ningguang': { normal: 0, charged: 3.133, skill: 4.147, skillLabel: "Skill DMG", burst: 0, burstLabel: "" },
  'gorou': { normal: 3.624, charged: 0, skill: 1.93, skillLabel: "Skill DMG", burst: 1.768, burstLabel: "Skill DMG" },
  'yun-jin': { normal: 4.969, charged: 2.405, skill: 6.71, skillLabel: "Charge Level 2 DMG", burst: 4.392, burstLabel: "Skill DMG" },
  'kachina': { normal: 5.05, charged: 2.227, skill: 1.58, skillLabel: "Turbo Twirly Mounted DMG", burst: 6.926, burstLabel: "Skill DMG" },
  'alhaitham': { normal: 6.311, charged: 2.184, skill: 6.273, skillLabel: "Rush Attack DMG", burst: 3.94, burstLabel: "Single-Instance DMG" },
  'tighnari': { normal: 3.591, charged: 0, skill: 2.693, skillLabel: "Skill DMG", burst: 1.224, burstLabel: "Secondary Tanglevine Shaft DMG" },
  'nahida': { normal: 3.268, charged: 2.376, skill: 5.573, skillLabel: "Tri-Karma Purification DMG", burst: 0, burstLabel: "" },
  'baizhu': { normal: 2.709, charged: 2.179, skill: 1.426, skillLabel: "Skill DMG", burst: 1.747, burstLabel: "Spiritvein DMG" },
  'kinich': { normal: 6.037, charged: 0.957, skill: 12.374, skillLabel: "Scalespiker Cannon DMG", burst: 2.412, burstLabel: "Skill DMG" },
  'emilie': { normal: 4.504, charged: 1.805, skill: 1.512, skillLabel: "Level 2 Lumidouce Case Attack DMG", burst: 3.91, burstLabel: "Level 3 Lumidouce Case Attack DMG" },
  'collei': { normal: 4.119, charged: 0, skill: 2.722, skillLabel: "Skill DMG", burst: 3.633, burstLabel: "Explosion DMG" },
  'yaoyao': { normal: 4.758, charged: 2.227, skill: 0.539, skillLabel: "White Jade Radish DMG", burst: 2.062, burstLabel: "Skill DMG" },
  'kirara': { normal: 4.568, charged: 2.212, skill: 2.592, skillLabel: "Flipclaw Strike DMG", burst: 10.264, burstLabel: "Skill DMG" },
  'kaveh': { normal: 6.578, charged: 2.951, skill: 3.672, skillLabel: "Skill DMG", burst: 2.88, burstLabel: "Skill DMG" },
  'lauma': { normal: 1.98, charged: 0, skill: 5.184, skillLabel: "Frostgrove Sanctuary Attack DMG", burst: 0, burstLabel: "" },
  'flins': { normal: 5.033, charged: 2.037, skill: 3.211, skillLabel: "Northland Spearstorm DMG", burst: 4.677, burstLabel: "Initial Skill DMG" },
  'aino': { normal: 3.596, charged: 3.471, skill: 3.398, skillLabel: "Stage 2 DMG", burst: 0.362, burstLabel: "Water Ball DMG" },
  'lohen': { normal: 5.994, charged: 1.302, skill: 5.683, skillLabel: "Low/High Plunge DMG", burst: 2.138, burstLabel: "Skill DMG" },
  'alyosha': { normal: 4.702, charged: 2.195, skill: 6.451, skillLabel: "Hold DMG", burst: 1.349, burstLabel: "Fulgurite Hunting Field DMG" },
  'jean': { normal: 5.916, charged: 3.203, skill: 5.256, skillLabel: "Skill DMG", burst: 7.646, burstLabel: "Burst DMG" },
  'chiori': { normal: 3.105, charged: 1.485, skill: 3.6, skillLabel: "Upward Sweep Attack DMG", burst: 4.614, burstLabel: "Skill DMG" },
  'kuki-shinobu': { normal: 4.522, charged: 1.1, skill: 1.363, skillLabel: "Skill DMG", burst: 0.454, burstLabel: "Total DMG" },
  'aether': { normal: 5.336, charged: 2.533, skill: 3.456, skillLabel: "Max Storm DMG", burst: 1.454, burstLabel: "Tornado DMG" },
  'lumine': { normal: 5.336, charged: 2.533, skill: 3.456, skillLabel: "Max Storm DMG", burst: 1.454, burstLabel: "Tornado DMG" },
  'odette': { normal: 4.919, charged: 1.783, skill: 8.256, skillLabel: "\"Plume\" Dance Move DMG", burst: 3.065, burstLabel: "Final Slash DMG" },
  'durin': { normal: 2.866, charged: 1.406, skill: 1.901, skillLabel: "Transmutation: Confirmation of Purity DMG", burst: 2.258, burstLabel: "Dragon of Dark Decay DMG" },
  'zibai': { normal: 3.141, charged: 1.54, skill: 3.106, skillLabel: "Lunar Phase Shift 1-Hit DMG", burst: 3.199, burstLabel: "Skill 2-Hit DMG" },
  'dahlia': { normal: 2.696, charged: 1.298, skill: 4.19, skillLabel: "Skill DMG", burst: 7.315, burstLabel: "Skill DMG" },
  'varka': { normal: 4.481, charged: 1.096, skill: 5.011, skillLabel: "Skill DMG", burst: 6.065, burstLabel: "Skill 1-Hit DMG" },
  'sandrone': { normal: 4.868, charged: 0, skill: 4, skillLabel: "Prism Shot Stellar Swirl DMG", burst: 5.954, burstLabel: "Convective Inhibition Ray DMG" },
  'yumemizuki-mizuki': { normal: 3.07, charged: 2.34, skill: 0.808, skillLabel: "Skill DMG", burst: 1.693, burstLabel: "Skill DMG" },
  'columbina': { normal: 2.554, charged: 2.089, skill: 0.301, skillLabel: "Skill DMG", burst: 0.58, burstLabel: "Skill DMG" },
  'nicole': { normal: 1.998, charged: 2.022, skill: 2.491, skillLabel: "Skill DMG", burst: 5.702, burstLabel: "Skill DMG" },
  'nefer': { normal: 2.914, charged: 2.356, skill: 9, skillLabel: "Phantasm Performance 1-Hit DMG (Shades)", burst: 8.087, burstLabel: "2-Hit DMG" },
  'skirk': { normal: 4.546, charged: 1.639, skill: 2.626, skillLabel: "1-Hit DMG", burst: 3.683, burstLabel: "Final Slash DMG" },
  'prune': { normal: 2.968, charged: 2.403, skill: 3.682, skillLabel: "Clang Clang! Witch-tribution Comes! DMG", burst: 1.745, burstLabel: "Skill DMG" },
  'ifa': { normal: 3.165, charged: 2.647, skill: 2.4, skillLabel: "Tonicshot DMG", burst: 9.153, burstLabel: "Skill DMG" },
  'escoffier': { normal: 2.612, charged: 0.797, skill: 2.16, skillLabel: "Frosty Parfait DMG", burst: 10.67, burstLabel: "Skill DMG" },
  'ineffa': { normal: 2.265, charged: 1.108, skill: 1.728, skillLabel: "Birgitta Discharge DMG", burst: 0, burstLabel: "" },
  'illuga': { normal: 3.138, charged: 1.508, skill: 4.343, skillLabel: "Hold DMG", burst: 0, burstLabel: "" },
  'iansan': { normal: 3.047, charged: 1.982, skill: 5.155, skillLabel: "Skill DMG", burst: 7.747, burstLabel: "Skill DMG" },
  'linnea': { normal: 3.791, charged: 0, skill: 7.2, skillLabel: "Lumi Million Ton Crush DMG", burst: 0, burstLabel: "" },
  'jahoda': { normal: 2.216, charged: 0, skill: 3.816, skillLabel: "Filled Treasure Flask DMG", burst: 3.73, burstLabel: "Skill DMG" },
  'manekin': { normal: 4.273, charged: 1.04, skill: 2.419, skillLabel: "Skill DMG", burst: 5.832, burstLabel: "Restricted Area Summon DMG" },
  'manekina': { normal: 4.273, charged: 1.04, skill: 2.419, skillLabel: "Skill DMG", burst: 5.832, burstLabel: "Restricted Area Summon DMG" },
};

export function talentsFor(id: string): CharacterTalents | undefined {
  return TALENTS[id];
}

// ============================================================================
// Signature talent — the attack used for a character's "reference damage".
// Priority: Elemental Burst → Elemental Skill → Charged Attack → Normal Attack,
// choosing the first one that actually deals damage. This mirrors the existing
// "signature skill" convention (the carry's burst by default).
// ============================================================================

export type TalentKey = 'normal' | 'charged' | 'skill' | 'burst';

export interface SignatureTalent {
  key: TalentKey;
  /** e.g. "Elemental Burst" */
  label: string;
  /** the in-game hit label, e.g. "Low HP Skill DMG" */
  detail: string;
  multiplier: number;
}

const SIGNATURE_ORDER: TalentKey[] = ['burst', 'skill', 'charged', 'normal'];

const SIGNATURE_LABEL: Record<TalentKey, string> = {
  normal: 'Normal Attack',
  charged: 'Charged Attack',
  skill: 'Elemental Skill',
  burst: 'Elemental Burst',
};

export function signatureTalent(id: string): SignatureTalent | undefined {
  const t = TALENTS[id];
  if (!t) return undefined;
  for (const key of SIGNATURE_ORDER) {
    if (t[key] > 0) {
      return {
        key,
        label: SIGNATURE_LABEL[key],
        detail: key === 'burst' ? t.burstLabel : key === 'skill' ? t.skillLabel : '',
        multiplier: t[key],
      };
    }
  }
  return undefined;
}
