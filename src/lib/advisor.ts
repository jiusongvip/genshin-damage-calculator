// ============================================================================
// Advisor — turns "how much damage" into "what should I do next".
// For each candidate change (a stat roll, a team buff, a different main stat)
// it re-simulates the expected damage and ranks the improvements by gain %.
// ============================================================================

import { computeDamage, computeFromPanel } from './damage';
import type { DamageInput, PanelInput } from './damage';

export interface Advice {
  label: string;
  detail: string;
  gainPercent: number;
}

interface Candidate {
  label: string;
  detail: string;
  next: number;
}

function rank(baseline: number, candidates: Candidate[]): Advice[] {
  return candidates
    .map((c) => ({ label: c.label, detail: c.detail, gainPercent: (c.next - baseline) / baseline }))
    .filter((a) => a.gainPercent > 0.01)
    .sort((a, b) => b.gainPercent - a.gainPercent)
    .slice(0, 4);
}

/** Suggest the highest-value upgrades for the manual (character/weapon/artifact) mode. */
export function adviseManual(input: DamageInput): Advice[] {
  const baseline = computeDamage(input).expected;

  const withArtifact = (patch: Partial<DamageInput['artifacts']>): number =>
    computeDamage({ ...input, artifacts: { ...input.artifacts, ...patch } }).expected;
  const withBuff = (patch: Partial<DamageInput['buffs']>): number =>
    computeDamage({ ...input, buffs: { ...input.buffs, ...patch } }).expected;

  const candidates: Candidate[] = [
    {
      label: 'Add +10% Crit Rate',
      detail: 'One more Crit Rate roll — raises average damage most when your crit is unbalanced.',
      next: withArtifact({ subCritRate: input.artifacts.subCritRate + 0.1 }),
    },
    {
      label: 'Add +20% Crit DMG',
      detail: 'Two Crit DMG rolls. Strongest when Crit Rate is already healthy.',
      next: withArtifact({ subCritDMG: input.artifacts.subCritDMG + 0.2 }),
    },
    {
      label: 'Add +100 Elemental Mastery',
      detail: 'Boosts Vaporize / Melt multiplier — best for reaction carries.',
      next: withArtifact({ subEM: input.artifacts.subEM + 100 }),
    },
    {
      label: 'Add +20% ATK',
      detail: 'An ATK% sub-stat roll or the Noblesse 4pc team buff.',
      next: withArtifact({ subATKPercent: input.artifacts.subATKPercent + 0.2 }),
    },
    {
      label: 'Add +46.6% DMG bonus',
      detail: 'An elemental goblet or an equivalent DMG source.',
      next: withBuff({ dmgBonus: input.buffs.dmgBonus + 0.466 }),
    },
    {
      label: 'Bring Bennett (Q)',
      detail: 'Large flat ATK + 20% ATK from C1 — the single biggest common buff.',
      next: withBuff({ flatATK: input.buffs.flatATK + 900, atkPercent: input.buffs.atkPercent + 0.2 }),
    },
    {
      label: 'Add Viridescent Venerer shred',
      detail: 'An Anemo unit shreds 40% RES — roughly +28% against most enemies.',
      next: withBuff({ resShred: input.buffs.resShred + 0.4 }),
    },
    {
      label: 'Add 15% DEF shred',
      detail: 'Rare and powerful — from Lisa, Ayaka C4, Klee C2, or Raiden C2.',
      next: withBuff({ defShred: input.buffs.defShred + 0.15 }),
    },
  ];

  return rank(baseline, candidates);
}

/** Suggest upgrades for the UID-imported (merged panel) mode. */
export function advisePanel(input: PanelInput): Advice[] {
  const baseline = computeFromPanel(input).expected;
  const withPatch = (patch: Partial<PanelInput>): number =>
    computeFromPanel({ ...input, ...patch }).expected;

  const candidates: Candidate[] = [
    {
      label: 'Add +10% Crit Rate',
      detail: 'One more Crit Rate roll — raises average damage most when crit is unbalanced.',
      next: withPatch({ critRate: Math.min(1, input.critRate + 0.1) }),
    },
    {
      label: 'Add +20% Crit DMG',
      detail: 'Two Crit DMG rolls. Strongest when Crit Rate is already healthy.',
      next: withPatch({ critDMG: input.critDMG + 0.2 }),
    },
    {
      label: 'Add +100 Elemental Mastery',
      detail: 'Boosts Vaporize / Melt multiplier — best for reaction carries.',
      next: withPatch({ em: input.em + 100 }),
    },
    {
      label: 'Add +20% ATK',
      detail: 'Equivalent to the Noblesse 4pc team buff.',
      next: withPatch({ totalATK: input.totalATK * 1.2 }),
    },
    {
      label: 'Add +46.6% DMG bonus',
      detail: 'An elemental goblet or an equivalent DMG source.',
      next: withPatch({ dmgBonus: input.dmgBonus + 0.466 }),
    },
    {
      label: 'Bring Bennett (Q)',
      detail: 'Large flat ATK — the single biggest common buff.',
      next: withPatch({ totalATK: input.totalATK + 900 }),
    },
    {
      label: 'Add Viridescent Venerer shred',
      detail: 'An Anemo unit shreds 40% RES — roughly +28% against most enemies.',
      next: withPatch({ resShred: input.resShred + 0.4 }),
    },
    {
      label: 'Add 15% DEF shred',
      detail: 'Rare and powerful — from Lisa, Ayaka C4, Klee C2, or Raiden C2.',
      next: withPatch({ defShred: input.defShred + 0.15 }),
    },
  ];

  return rank(baseline, candidates);
}
