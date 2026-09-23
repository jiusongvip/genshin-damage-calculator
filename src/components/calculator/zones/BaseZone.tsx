import { ATTACKS, SCALING_LABEL } from '../constants';
import type { Draft } from '../draft';
import { Glyph, IconSelect, Num, NumberField, Pct, Zone } from '../primitives';
import type { ZoneChrome } from './types';
import type { TalentKey } from '../../../data/talents';

/** Zone 1 — the character's own stat times the skill multiplier. */
export interface BaseZoneProps extends ZoneChrome {
  /** Which stat the skill scales off, so the label matches the engine. */
  scaling: string;
  /** The whiteboard stat the input is floored at and defaults to. */
  whiteboardStat: number;
  statOverride: number | null;
  attackType: TalentKey;
  skillMult: number;
  baseDmgBonus: number;
  flatBaseDmg: number;
  onPatch: (patch: Partial<Draft>) => void;
  /** Changing the attack type re-derives the signature multiplier. */
  onAttackType: (t: TalentKey) => void;
  /** Editing the multiplier detaches it from the picked table row. */
  onSkillMult: (v: number) => void;
}

export function BaseZone({
  value,
  changed,
  onReset,
  onEnter,
  scaling,
  whiteboardStat,
  statOverride,
  attackType,
  skillMult,
  baseDmgBonus,
  flatBaseDmg,
  onPatch,
  onAttackType,
  onSkillMult,
}: BaseZoneProps) {
  const floor = Math.round(whiteboardStat);

  return (
    <Zone id="base" index={1} title="Base damage" value={value} changed={changed} onReset={onReset} onEnter={onEnter}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <NumberField
          label={`${SCALING_LABEL[scaling]} (whiteboard, editable)`}
          value={Math.round(statOverride ?? whiteboardStat)}
          onChange={(v) => onPatch({ statOverride: v })}
          min={floor}
          max={1_000_000}
        />
        <label className="block">
          <span className="text-xs font-medium text-[var(--muted)]">Skill type</span>
          <IconSelect
            value={attackType}
            onChange={onAttackType}
            options={ATTACKS.map((a) => ({ ...a, icon: <Glyph name={a.value} className="h-5 w-5" /> }))}
          />
        </label>
        <Pct label="Skill multiplier" value={skillMult} onChange={onSkillMult} step={1} min={0} max={10000} />
        <div className="grid grid-cols-1 gap-3">
          <Pct label="Base DMG bonus" value={baseDmgBonus} onChange={(v) => onPatch({ baseDmgBonus: v })} min={-100} max={1000} />
          <Num label="Flat base DMG" value={flatBaseDmg} onChange={(v) => onPatch({ flatBaseDmg: v })} step={10} min={0} max={1_000_000} />
        </div>
      </div>
    </Zone>
  );
}
