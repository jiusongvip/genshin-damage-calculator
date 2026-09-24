// ============================================================================
// Artifact main-stat constants and per-character preset builds.
// Presets give the calculator a "zero-input" starting point: pick a character
// and instantly see a reasonable end-game panel's damage.
// ============================================================================

import type { ArtifactBuild, ArtifactSub, BuffState, CharacterData, SecondaryStatType } from '../lib/damage';
import { ARTIFACT_SETS } from './artifactSets';
import type { SetPick } from './artifactSets';

// +20 5-star artifact main-stat values.
export const MAIN_STATS = {
  atkPercent: 0.466,
  hpPercent: 0.466,
  defPercent: 0.583,
  em: 187,
  er: 0.518,
  critRate: 0.311,
  critDMG: 0.622,
  dmgBonus: 0.466,
  physical: 0.583,
} as const;

// A representative "graduated" end-game sub-stat spread: four sub-stats per
// piece (flower, plume, sands, goblet, circlet). Values are already totalled.
const DEFAULT_PIECE_SUBS: ArtifactSub[][] = [
  [
    { type: 'critRate', value: 0.07 },
    { type: 'critDMG', value: 0.14 },
    { type: 'atk%', value: 0.1 },
    { type: 'em', value: 40 },
  ],
  [
    { type: 'critRate', value: 0.07 },
    { type: 'critDMG', value: 0.14 },
    { type: 'atk%', value: 0.1 },
    { type: 'em', value: 40 },
  ],
  [
    { type: 'critRate', value: 0.07 },
    { type: 'critDMG', value: 0.14 },
    { type: 'hp%', value: 0.1 },
    { type: 'def%', value: 0.1 },
  ],
  [
    { type: 'critRate', value: 0.07 },
    { type: 'critDMG', value: 0.14 },
    { type: 'atk%', value: 0.1 },
    { type: 'er', value: 0.11 },
  ],
  [
    { type: 'critRate', value: 0.07 },
    { type: 'critDMG', value: 0.14 },
    { type: 'em', value: 40 },
    { type: 'er', value: 0.11 },
  ],
];

type ArtifactMain = { type: SecondaryStatType; value: number };

/** Per-character main-stat preset (mains only; sub-stats use the default spread). */
const PRESET_MAINS: Record<string, { sandsMain: ArtifactMain; gobletMain: ArtifactMain; circletMain: ArtifactMain }> = {
  'hu-tao': {
    sandsMain: { type: 'hp%', value: MAIN_STATS.hpPercent },
    gobletMain: { type: 'dmg%', value: MAIN_STATS.dmgBonus },
    circletMain: { type: 'critDMG', value: MAIN_STATS.critDMG },
  },
  'raiden-shogun': {
    sandsMain: { type: 'er', value: MAIN_STATS.er },
    gobletMain: { type: 'dmg%', value: MAIN_STATS.dmgBonus },
    circletMain: { type: 'critRate', value: MAIN_STATS.critRate },
  },
  ganyu: {
    sandsMain: { type: 'atk%', value: MAIN_STATS.atkPercent },
    gobletMain: { type: 'dmg%', value: MAIN_STATS.dmgBonus },
    circletMain: { type: 'critDMG', value: MAIN_STATS.critDMG },
  },
  ayaka: {
    sandsMain: { type: 'atk%', value: MAIN_STATS.atkPercent },
    gobletMain: { type: 'dmg%', value: MAIN_STATS.dmgBonus },
    circletMain: { type: 'critDMG', value: MAIN_STATS.critDMG },
  },
  arlecchino: {
    sandsMain: { type: 'atk%', value: MAIN_STATS.atkPercent },
    gobletMain: { type: 'dmg%', value: MAIN_STATS.dmgBonus },
    circletMain: { type: 'critDMG', value: MAIN_STATS.critDMG },
  },
  xiao: {
    sandsMain: { type: 'atk%', value: MAIN_STATS.atkPercent },
    gobletMain: { type: 'dmg%', value: MAIN_STATS.dmgBonus },
    circletMain: { type: 'critDMG', value: MAIN_STATS.critDMG },
  },
  alhaitham: {
    sandsMain: { type: 'em', value: MAIN_STATS.em },
    gobletMain: { type: 'dmg%', value: MAIN_STATS.dmgBonus },
    circletMain: { type: 'critDMG', value: MAIN_STATS.critDMG },
  },
  neuvillette: {
    sandsMain: { type: 'hp%', value: MAIN_STATS.hpPercent },
    gobletMain: { type: 'dmg%', value: MAIN_STATS.dmgBonus },
    circletMain: { type: 'critDMG', value: MAIN_STATS.critDMG },
  },
  zhongli: {
    sandsMain: { type: 'hp%', value: MAIN_STATS.hpPercent },
    gobletMain: { type: 'dmg%', value: MAIN_STATS.dmgBonus },
    circletMain: { type: 'critRate', value: MAIN_STATS.critRate },
  },
  furina: {
    sandsMain: { type: 'hp%', value: MAIN_STATS.hpPercent },
    gobletMain: { type: 'dmg%', value: MAIN_STATS.dmgBonus },
    circletMain: { type: 'critDMG', value: MAIN_STATS.critDMG },
  },
};

/**
 * No artifacts at all — every main stat and sub stat at zero.
 *
 * The site currently shows bare numbers: character plus weapon only. Artifacts
 * are a later feature, so every calculation passes this instead of a preset.
 * PRESETS / resolvePreset below stay as the starting point for that feature.
 */
export const NO_ARTIFACTS: ArtifactBuild = {
  sandsMain: { type: 'atk%', value: 0 },
  gobletMain: { type: 'dmg%', value: 0 },
  circletMain: { type: 'critRate', value: 0 },
  flowerHP: 0,
  plumeATK: 0,
  sets: { flower: '', plume: '', sands: '', goblet: '', circlet: '' },
  pieceSubs: [],
};

/** Default team buff state (no external buffs). */
export const DEFAULT_BUFFS: BuffState = {
  atkPercent: 0,
  flatATK: 0,
  hpPercent: 0,
  flatHP: 0,
  defPercent: 0,
  flatDEF: 0,
  dmgBonus: 0,
  baseDmgBonus: 0,
  flatBaseDmg: 0,
  naDmgBonus: 0,
  caDmgBonus: 0,
  skillDmgBonus: 0,
  burstDmgBonus: 0,
  critRate: 0,
  critDMG: 0,
  em: 0,
  er: 0,
  atkFromHP: 0,
  atkFromHPCapped: 0,
  atkFromHPCappedMax: 0,
  atkFromDEF: 0,
  atkFromEM: 0,
  atkFromER: 0,
  atkFromERMax: 0,
  dmgBonusFromHP: 0,
  dmgBonusFromHPMax: 0,
  defShred: 0,
  defIgnore: 0,
  resShred: 0,
  reactionBonus: 0,
  ampReactionBonus: 0,
  transformReactionBonus: 0,
  reactionDmg: {},
  dmgReduction: 0,
};

/**
 * NOT USED while the site shows bare (no-artifact) numbers — see NO_ARTIFACTS.
 *
 * Resolve a preset build for any character. Exact per-character presets win;
 * otherwise infer a sensible end-game panel from the character's scaling hints
 * (base ATK, HP/DEF scaling notes, reaction keywords).
 */
export function resolvePreset(c: CharacterData): ArtifactBuild {
  const sets = distributeSets(resolveSetPicks(c));
  const explicit = PRESET_MAINS[c.id];
  if (explicit) return { flowerHP: FLOWER_HP, plumeATK: PLUME_ATK, sets, ...explicit, pieceSubs: DEFAULT_PIECE_SUBS };

  const note = c.note.toLowerCase();
  let sands: ArtifactMain;
  if (c.scaling === 'hp') {
    sands = { type: 'hp%', value: MAIN_STATS.hpPercent };
  } else if (c.scaling === 'def') {
    sands = { type: 'def%', value: MAIN_STATS.defPercent };
  } else if (c.scaling === 'em') {
    sands = { type: 'em', value: MAIN_STATS.em };
  } else if (note.includes('spread') || note.includes('aggravate') || note.includes('bloom') || note.includes('em sands')) {
    sands = { type: 'em', value: MAIN_STATS.em };
  } else {
    sands = { type: 'atk%', value: MAIN_STATS.atkPercent };
  }

  return {
    flowerHP: FLOWER_HP,
    plumeATK: PLUME_ATK,
    sets,
    sandsMain: sands,
    gobletMain: { type: 'dmg%', value: MAIN_STATS.dmgBonus },
    circletMain: { type: 'critDMG', value: MAIN_STATS.critDMG },
    pieceSubs: DEFAULT_PIECE_SUBS,
  };
}

/**
 * Recommended artifact sets parsed from the character's `bestArtifacts` string
 * (e.g. "Emblem of Severed Fate (4)", "Pale Flame (2) + Bloodstained (2)").
 * Sets we do not model for damage (healing / HP sets, Bloodstained) are skipped.
 */
const normalise = (s: string) => s.toLowerCase().replace(/[\u2019']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

const SET_ID_BY_NAME = new Map<string, string>();
for (const set of ARTIFACT_SETS) SET_ID_BY_NAME.set(normalise(set.name), set.id);

/** Short names used in characters.ts that differ from the full set name. */
const SET_ALIAS: Record<string, string> = {
  noblesse: 'noblesse-oblige',
  tenacity: 'tenacity-of-the-millelith',
  'nighttime whispers': 'nighttime-whispers',
};

export function resolveSetPicks(c: CharacterData): SetPick[] {
  const picks: SetPick[] = [];
  for (const segment of (c.bestArtifacts ?? '').split('+')) {
    const m = segment.match(/(.+?)\s*\((\d)\)/);
    if (!m) continue;
    const id = SET_ID_BY_NAME.get(normalise(m[1])) ?? SET_ALIAS[normalise(m[1])];
    if (!id) continue;
    picks.push({ id, pieces: m[2] === '4' ? 4 : 2 });
  }
  return picks.slice(0, 2);
}

/** 5★ +20 flower / plume main-stat values. */
const FLOWER_HP = 4780;
const PLUME_ATK = 311;

const EMPTY_SETS = { flower: '', plume: '', sands: '', goblet: '', circlet: '' };

/** Spread up to two set picks across the five pieces (4pc + off, or 2pc + 2pc + off). */
export function distributeSets(picks: SetPick[]): { flower: string; plume: string; sands: string; goblet: string; circlet: string } {
  if (picks.length === 1 && picks[0].pieces === 4) {
    return { flower: picks[0].id, plume: picks[0].id, sands: picks[0].id, goblet: picks[0].id, circlet: '' };
  }
  if (picks.length === 2) {
    return { flower: picks[0].id, plume: picks[0].id, sands: picks[1].id, goblet: picks[1].id, circlet: '' };
  }
  if (picks.length === 1 && picks[0].pieces === 2) {
    return { ...EMPTY_SETS, flower: picks[0].id, plume: picks[0].id };
  }
  return { ...EMPTY_SETS };
}

/** Count how many pieces wear each set and turn that into 2pc/4pc picks. */
export function setPicksFromPieces(sets: { flower?: string; plume?: string; sands?: string; goblet?: string; circlet?: string }): SetPick[] {
  const counts: Record<string, number> = {};
  for (const id of [sets.flower, sets.plume, sets.sands, sets.goblet, sets.circlet]) {
    if (id) counts[id] = (counts[id] ?? 0) + 1;
  }
  const picks: SetPick[] = [];
  for (const [id, n] of Object.entries(counts)) picks.push({ id, pieces: n >= 4 ? 4 : 2 });
  return picks.slice(0, 2);
}

/** Preset team buffs (common team setups) shown as quick-select chips. */
export const BUFF_PRESETS: { id: string; label: string; buffs: Partial<BuffState> }[] = [
  { id: 'none', label: 'No buffs', buffs: {} },
  { id: 'bennett', label: 'Bennett Q', buffs: { flatATK: 900, atkPercent: 0.2 } },
  { id: 'kazuha', label: 'Kazuha VV', buffs: { resShred: 0.4, dmgBonus: 0.35 } },
  { id: 'zhongli-shield', label: 'Zhongli shield', buffs: { resShred: 0.2 } },
  { id: 'xilonen', label: 'Xilonen (RES shred)', buffs: { resShred: 0.36 } },
  { id: 'citlali', label: 'Citlali (Pyro / Hydro RES −20%)', buffs: { resShred: 0.2 } },
  { id: 'noblesse', label: 'Noblesse 4pc', buffs: { atkPercent: 0.2 } },
  { id: 'ttds', label: 'Thrilling Tales', buffs: { atkPercent: 0.48 } },
];

/**
 * Characters whose team buff the calculator models. Picking one applies the
 * matching entry from BUFF_PRESETS to the whole team.
 *
 * Lives here rather than in the calculator component because the home page
 * also needs it, to seed a default team that actually demonstrates the buff
 * breakdown instead of showing an empty panel.
 */
export const BUFF_BY_CHARACTER: Record<string, string> = {
  bennett: 'bennett',
  kazuha: 'kazuha',
  zhongli: 'zhongli-shield',
  xilonen: 'xilonen',
  citlali: 'citlali',
};

/** Buffers in the order a default team should reach for them. */
export const DEFAULT_BUFFERS = ['bennett', 'kazuha', 'xilonen', 'zhongli', 'citlali'];
