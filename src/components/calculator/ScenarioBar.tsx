import { useState } from 'react';
import type { CharacterData, EnemyData, WeaponData } from '../../lib/damage';
import { formatNumber } from '../../lib/damage';
import { ELEMENT_LABEL } from '../../data/elements';
import { ENEMIES } from '../../data/enemies';
import type { Scenario } from '../../lib/scenarios';
import { ElementIcon } from '../ElementIcon';
import { Glyph, IconSelect, WeaponIcon } from './primitives';
import { ELEMENT_BG, NO_TALENT_NOTE } from './constants';
import { clamp } from './draft';
import type { Draft } from './draft';

/** The three talent buckets the bar edits — narrower than `TalentGroup`,
 *  which also covers charged / plunge rows. */
type TalentBucket = keyof Draft['talentLevels'];

/** Talent inputs shown in the bar, with their tooltips. */
const TALENT_INPUTS: [TalentBucket, string][] = [
  ['normal', 'Normal Attack (also Charged / Plunge)'],
  ['skill', 'Elemental Skill'],
  ['burst', 'Elemental Burst'],
];

export interface ScenarioBarProps {
  character: CharacterData;
  /** Resolved weapon for the current draft — absent only if the type has none. */
  weapon: WeaponData | undefined;
  weaponOptions: WeaponData[];
  enemy: EnemyData;

  level: number;
  constellation: number;
  talentLevels: { normal: number; skill: number; burst: number };
  customEnemy: boolean;
  enemyLevel: number;
  /** e.g. "C3 → skill talent +3" — empty when no constellation raises a talent. */
  talentBonusNote: string;
  /** e.g. "C4 not modelled — …" — empty when this level feeds the engine. */
  constellationNote: string;

  expected: number;
  nonCrit: number;
  critHit: number;
  /** False when the character has no per-hit talent table — the headline reads a
   *  notice instead of the placeholder-multiplier number. */
  hasTalentData: boolean;

  onOpenPicker: () => void;
  onLevel: (level: number) => void;
  onConstellation: (constellation: number) => void;
  onTalentLevel: (group: TalentBucket, level: number) => void;
  onWeapon: (id: string) => void;
  onEnemy: (id: string) => void;
  onEnemyLevel: (level: number) => void;

  /** Saved scenarios from localStorage. Null when storage is unavailable — the
   *  whole save row is then hidden. */
  scenarios: Scenario[] | null;
  /** id currently driving the Diff baseline, if any. */
  comparingId?: string | null;
  onSave: (name: string) => void;
  onLoad: (id: string) => void;
  onCompare: (id: string) => void;
  onClearCompare: () => void;
  onDelete: (id: string) => void;
}

/**
 * The fixed scenario bar above the tabs: who is hitting, with what, at which
 * level and constellation, against what — plus the headline Expected number.
 *
 * The reducers that need to know more than one field (constellation re-deriving
 * the signature multiplier, picking "Custom…" snapping the enemy level) live in
 * the parent and arrive here as plain callbacks.
 */
export function ScenarioBar({
  character,
  weapon,
  weaponOptions,
  enemy,
  level,
  constellation,
  talentLevels,
  customEnemy,
  enemyLevel,
  talentBonusNote,
  constellationNote,
  expected,
  nonCrit,
  critHit,
  hasTalentData,
  onOpenPicker,
  onLevel,
  onConstellation,
  onTalentLevel,
  onWeapon,
  onEnemy,
  onEnemyLevel,
  scenarios,
  comparingId,
  onSave,
  onLoad,
  onCompare,
  onClearCompare,
  onDelete,
}: ScenarioBarProps) {
  const [name, setName] = useState('');
  const save = () => {
    onSave(name);
    setName('');
  };
  return (
    <div className="panel shrink-0 p-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
        {/* Character card */}
        <button
          type="button"
          onClick={onOpenPicker}
          aria-label={`Change character (currently ${character.name})`}
          title="Change character"
          className="group relative block w-full shrink-0 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] text-left transition-colors hover:border-forest-500 lg:w-[160px]"
        >
          <span className="relative block h-[160px] w-full overflow-hidden">
            <span className={`absolute inset-0 bg-linear-to-b ${ELEMENT_BG[character.element] ?? ELEMENT_BG.physical}`} aria-hidden="true" />
            <img src={`/images/portraits/${character.id}.webp`} alt="" width="256" height="256" className="relative h-full w-full object-cover" />
            <ElementIcon el={character.element} className="absolute right-1.5 top-1.5 h-6 w-6" />
            <span className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/85 via-black/40 to-transparent px-2.5 pb-2 pt-8">
              <span className="flex items-center gap-1.5 truncate text-sm font-semibold text-white">
                <ElementIcon el={character.element} className="h-4 w-4" />
                {character.name}
              </span>
              <span className="block text-[10px] text-white/80">
                {ELEMENT_LABEL[character.element]} · {character.weaponType}
              </span>
            </span>
            <span
              className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/55 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
              aria-hidden="true"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 7h13l-3-3M20 17H7l3 3" />
              </svg>
              <span className="text-[11px] font-semibold uppercase tracking-wide">Change</span>
            </span>
          </span>
        </button>

        {/* Controls — a grid that fills the width instead of wrapping with gaps */}
        <div className="grid flex-1 grid-cols-2 content-start gap-2.5 sm:grid-cols-4">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-[var(--muted)]">Level</span>
            <input
              type="number"
              min={1}
              max={90}
              value={level}
              onChange={(e) => onLevel(Math.min(90, Math.max(1, parseInt(e.target.value, 10) || 90)))}
              className="h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 text-right text-sm text-[var(--text)]"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-[var(--muted)]">Constellation</span>
            <select
              value={constellation}
              onChange={(e) => onConstellation(parseInt(e.target.value, 10))}
              className="h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 text-sm text-[var(--text)]"
            >
              {[0, 1, 2, 3, 4, 5, 6].map((c) => (
                <option key={c} value={c}>
                  C{c}
                </option>
              ))}
            </select>
            {constellationNote && (
              <span data-testid="constellation-note" className="text-[10px] leading-tight text-[var(--muted)]">
                {constellationNote}
              </span>
            )}
          </label>

          <div className="col-span-2 flex flex-col gap-1">
            <span
              className="text-[11px] font-medium text-[var(--muted)]"
              title="Talent level caps at 10. Constellation C3 / C5 raise one talent by +3 (up to 15); a few passives add +1. Set 11-15 only when that applies."
            >
              Talents — Normal / Skill / Burst <span className="text-[10px] font-normal">(cap 10)</span>
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              {TALENT_INPUTS.map(([g, label]) => (
                <input
                  key={g}
                  type="number"
                  min={1}
                  max={15}
                  value={talentLevels[g]}
                  onChange={(e) => onTalentLevel(g, parseInt(e.target.value, 10) || 1)}
                  title={label}
                  aria-label={label}
                  className="h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-1 text-center text-sm text-[var(--text)]"
                />
              ))}
            </div>
            {talentBonusNote && <span className="text-[10px] font-semibold text-forest-600">{talentBonusNote}</span>}
          </div>

          <label className="col-span-2 flex flex-col gap-1">
            <span className="text-[11px] font-medium text-[var(--muted)]">Weapon</span>
            <IconSelect
              className="relative w-full"
              value={weapon?.id ?? ''}
              onChange={onWeapon}
              options={weaponOptions.map((w) => ({
                value: w.id,
                label: `${w.name} · ${w.rarity}★`,
                icon: <WeaponIcon id={w.id} />,
              }))}
            />
          </label>

          <div className="col-span-2 flex flex-col gap-1">
            <span className="text-[11px] font-medium text-[var(--muted)]">Enemy</span>
            <div className="flex items-center gap-2">
              <IconSelect
                className="relative flex-1"
                value={customEnemy ? 'custom' : enemy.id}
                onChange={onEnemy}
                options={[
                  ...ENEMIES.map((en) => ({
                    value: en.id,
                    label: `${en.name} · Lv${en.level}`,
                    icon: <Glyph name="enemy" className="h-5 w-5 text-[var(--muted)]" />,
                  })),
                  { value: 'custom', label: 'Custom…' },
                ]}
              />
              {customEnemy && (
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={enemyLevel}
                  onChange={(e) => onEnemyLevel(clamp(parseInt(e.target.value, 10) || 90, 1, 100))}
                  aria-label="Enemy level"
                  className="h-9 w-16 shrink-0 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 text-right text-sm text-[var(--text)]"
                />
              )}
            </div>
          </div>
        </div>

        {/* Result — the number is only trustworthy when a talent table backs it */}
        {hasTalentData ? (
          <div className="flex shrink-0 items-center justify-between gap-3 rounded-xl border border-forest-500/25 bg-forest-500/8 px-4 py-2.5 lg:w-[190px] lg:flex-col lg:items-end lg:justify-center">
            <div className="text-right">
              <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-forest-600">Expected</span>
              <span className="damage-number tnum text-3xl leading-none">{formatNumber(expected)}</span>
            </div>
            <span className="text-[11px] leading-tight text-[var(--muted)] lg:text-right">
              {formatNumber(nonCrit)}
              <span className="hidden lg:inline"> non-crit</span>
              <br />
              {formatNumber(critHit)}
              <span className="hidden lg:inline"> crit</span>
            </span>
          </div>
        ) : (
          <div className="flex shrink-0 items-center rounded-xl border border-[var(--line)] px-4 py-2.5 lg:w-[190px]">
            <span data-testid="no-talent-note" className="text-[11px] leading-tight text-[var(--muted)]">
              {NO_TALENT_NOTE}
            </span>
          </div>
        )}
      </div>

      {scenarios && (
        <div data-testid="scenario-bar" className="mt-3 border-t border-[var(--line)] pt-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') save();
              }}
              placeholder="Name this scenario…"
              aria-label="Scenario name"
              className="h-8 w-44 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 text-sm text-[var(--text)]"
            />
            <button
              type="button"
              onClick={save}
              className="h-8 shrink-0 rounded-lg border border-forest-600/40 bg-forest-600/10 px-3 text-sm font-semibold text-forest-700 transition-colors hover:bg-forest-600/18"
            >
              Save
            </button>

            {comparingId && (
              <button
                type="button"
                onClick={onClearCompare}
                className="h-8 shrink-0 rounded-lg border border-[var(--line)] px-3 text-sm text-[var(--muted)] hover:text-[var(--text)]"
              >
                Clear compare
              </button>
            )}

            {scenarios.length > 0 && (
              <ul className="flex w-full flex-col gap-1">
                {scenarios.map((s) => (
                  <li
                    key={s.id}
                    data-testid="scenario-row"
                    className="flex flex-wrap items-center gap-2 text-sm"
                  >
                    <span className="min-w-0 flex-1 truncate font-medium text-[var(--text)]">{s.name}</span>
                    <span className="text-[11px] text-[var(--muted)]">
                      {new Date(s.savedAt).toLocaleDateString()}
                    </span>
                    <button type="button" onClick={() => onLoad(s.id)} className="rounded-md px-2 py-0.5 text-forest-700 hover:bg-forest-600/10">
                      Load
                    </button>
                    <button
                      type="button"
                      onClick={() => onCompare(s.id)}
                      className={`rounded-md px-2 py-0.5 hover:bg-forest-600/10 ${
                        comparingId === s.id ? 'font-semibold text-forest-700' : 'text-[var(--text)]'
                      }`}
                    >
                      {comparingId === s.id ? 'Comparing' : 'Compare'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(s.id)}
                      aria-label={`Delete ${s.name}`}
                      className="rounded-md px-1.5 py-0.5 text-[var(--muted)] hover:text-red-600"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
