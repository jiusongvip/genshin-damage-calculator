// ============================================================================
// Artifact main-stat constants and per-character preset builds.
// Presets give the calculator a "zero-input" starting point: pick a character
// and instantly see a reasonable end-game panel's damage.
// ============================================================================

import type { ArtifactBuild, BuffState, CharacterData } from '../lib/damage';

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

// A "graduated" sub-stat roll set (~15 CR / ~18 CD / a few ATK% and EM rolls).
const GRADUATED_SUBS = {
  subCritRate: 0.3,
  subCritDMG: 0.66,
  subATKPercent: 0.18,
  subEM: 40,
  subER: 20,
  subHPPercent: 0.1,
};

/** Per-character preset build keyed by character id. */
export const PRESETS: Record<string, ArtifactBuild> = {
  'hu-tao': {
    sandsMain: { type: 'hp%', value: MAIN_STATS.hpPercent },
    gobletMain: { type: 'dmg%', value: MAIN_STATS.dmgBonus },
    circletMain: { type: 'critDMG', value: MAIN_STATS.critDMG },
    ...GRADUATED_SUBS,
    subEM: 120,
  },
  'raiden-shogun': {
    sandsMain: { type: 'er', value: MAIN_STATS.er },
    gobletMain: { type: 'dmg%', value: MAIN_STATS.dmgBonus },
    circletMain: { type: 'critRate', value: MAIN_STATS.critRate },
    ...GRADUATED_SUBS,
  },
  ganyu: {
    sandsMain: { type: 'atk%', value: MAIN_STATS.atkPercent },
    gobletMain: { type: 'dmg%', value: MAIN_STATS.dmgBonus },
    circletMain: { type: 'critDMG', value: MAIN_STATS.critDMG },
    ...GRADUATED_SUBS,
    subEM: 100,
  },
  ayaka: {
    sandsMain: { type: 'atk%', value: MAIN_STATS.atkPercent },
    gobletMain: { type: 'dmg%', value: MAIN_STATS.dmgBonus },
    circletMain: { type: 'critDMG', value: MAIN_STATS.critDMG },
    ...GRADUATED_SUBS,
    subCritRate: 0.25,
  },
  arlecchino: {
    sandsMain: { type: 'atk%', value: MAIN_STATS.atkPercent },
    gobletMain: { type: 'dmg%', value: MAIN_STATS.dmgBonus },
    circletMain: { type: 'critDMG', value: MAIN_STATS.critDMG },
    ...GRADUATED_SUBS,
  },
  xiao: {
    sandsMain: { type: 'atk%', value: MAIN_STATS.atkPercent },
    gobletMain: { type: 'dmg%', value: MAIN_STATS.dmgBonus },
    circletMain: { type: 'critDMG', value: MAIN_STATS.critDMG },
    ...GRADUATED_SUBS,
  },
  alhaitham: {
    sandsMain: { type: 'em', value: MAIN_STATS.em },
    gobletMain: { type: 'dmg%', value: MAIN_STATS.dmgBonus },
    circletMain: { type: 'critDMG', value: MAIN_STATS.critDMG },
    ...GRADUATED_SUBS,
    subEM: 120,
  },
  neuvillette: {
    sandsMain: { type: 'hp%', value: MAIN_STATS.hpPercent },
    gobletMain: { type: 'dmg%', value: MAIN_STATS.dmgBonus },
    circletMain: { type: 'critDMG', value: MAIN_STATS.critDMG },
    ...GRADUATED_SUBS,
    subCritRate: 0.35,
    subATKPercent: 0,
  },
  zhongli: {
    sandsMain: { type: 'hp%', value: MAIN_STATS.hpPercent },
    gobletMain: { type: 'dmg%', value: MAIN_STATS.dmgBonus },
    circletMain: { type: 'critRate', value: MAIN_STATS.critRate },
    ...GRADUATED_SUBS,
  },
  furina: {
    sandsMain: { type: 'hp%', value: MAIN_STATS.hpPercent },
    gobletMain: { type: 'dmg%', value: MAIN_STATS.dmgBonus },
    circletMain: { type: 'critDMG', value: MAIN_STATS.critDMG },
    ...GRADUATED_SUBS,
    subCritRate: 0.35,
    subATKPercent: 0,
  },
};

/** Default team buff state (no external buffs). */
export const DEFAULT_BUFFS: BuffState = {
  atkPercent: 0,
  flatATK: 0,
  dmgBonus: 0,
  critRate: 0,
  critDMG: 0,
  em: 0,
  defShred: 0,
  resShred: 0,
  reactionBonus: 0,
};

/**
 * Resolve a preset build for any character. Exact per-character presets win;
 * otherwise infer a sensible end-game panel from the character's scaling hints
 * (base ATK, HP/DEF scaling notes, reaction keywords).
 */
export function resolvePreset(c: CharacterData): ArtifactBuild {
  const explicit = PRESETS[c.id];
  if (explicit) return explicit;

  const note = c.note.toLowerCase();
  let sands: ArtifactBuild['sandsMain'];
  if (c.baseATK < 220) {
    sands = { type: 'hp%', value: MAIN_STATS.hpPercent };
  } else if (note.includes('def scaling') || note.includes('def%')) {
    sands = { type: 'def%', value: MAIN_STATS.defPercent };
  } else if (note.includes('spread') || note.includes('aggravate') || note.includes('bloom') || note.includes('em sands')) {
    sands = { type: 'em', value: MAIN_STATS.em };
  } else {
    sands = { type: 'atk%', value: MAIN_STATS.atkPercent };
  }

  return {
    sandsMain: sands,
    gobletMain: { type: 'dmg%', value: MAIN_STATS.dmgBonus },
    circletMain: { type: 'critDMG', value: MAIN_STATS.critDMG },
    ...GRADUATED_SUBS,
  };
}

/** Preset team buffs (common team setups) shown as quick-select chips. */
export const BUFF_PRESETS: { id: string; label: string; buffs: Partial<BuffState> }[] = [
  { id: 'none', label: 'No buffs', buffs: {} },
  { id: 'bennett', label: 'Bennett Q', buffs: { flatATK: 900, atkPercent: 0.2 } },
  { id: 'kazuha', label: 'Kazuha VV', buffs: { resShred: 0.4, dmgBonus: 0.35 } },
  { id: 'zhongli-shield', label: 'Zhongli shield', buffs: { resShred: 0.2 } },
  { id: 'noblesse', label: 'Noblesse 4pc', buffs: { atkPercent: 0.2 } },
  { id: 'ttds', label: 'Thrilling Tales', buffs: { atkPercent: 0.48 } },
];
