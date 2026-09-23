import type { Draft } from '../draft';
import { Pct, Zone } from '../primitives';
import type { ZoneChrome } from './types';

/** Zone 2 — the DMG bonus bucket, including per-attack-type bonuses. */
export interface BonusZoneProps extends ZoneChrome {
  dmgBonus: number;
  dmgReduction: number;
  naDmgBonus: number;
  caDmgBonus: number;
  skillDmgBonus: number;
  burstDmgBonus: number;
  onPatch: (patch: Partial<Draft>) => void;
}

export function BonusZone({
  value,
  changed,
  onReset,
  onEnter,
  dmgBonus,
  dmgReduction,
  naDmgBonus,
  caDmgBonus,
  skillDmgBonus,
  burstDmgBonus,
  onPatch,
}: BonusZoneProps) {
  return (
    <Zone id="bonus" index={2} title="DMG bonus" value={value} changed={changed} onReset={onReset} onEnter={onEnter}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Pct label="Elemental / Physical DMG" value={dmgBonus} onChange={(v) => onPatch({ dmgBonus: v })} min={0} max={2000} />
        <Pct label="Target DMG reduction" value={dmgReduction} onChange={(v) => onPatch({ dmgReduction: v })} min={0} max={100} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Pct label="Normal Attack DMG" value={naDmgBonus} onChange={(v) => onPatch({ naDmgBonus: v })} min={-100} max={2000} />
        <Pct label="Charged Attack DMG" value={caDmgBonus} onChange={(v) => onPatch({ caDmgBonus: v })} min={-100} max={2000} />
        <Pct label="Elemental Skill DMG" value={skillDmgBonus} onChange={(v) => onPatch({ skillDmgBonus: v })} min={-100} max={2000} />
        <Pct label="Elemental Burst DMG" value={burstDmgBonus} onChange={(v) => onPatch({ burstDmgBonus: v })} min={-100} max={2000} />
      </div>
    </Zone>
  );
}
