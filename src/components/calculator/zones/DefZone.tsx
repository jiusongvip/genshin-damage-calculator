import type { Draft } from '../draft';
import { Pct, Zone } from '../primitives';
import type { ZoneChrome } from './types';

/** Zone 5 — the enemy DEF multiplier. */
export interface DefZoneProps extends ZoneChrome {
  defShred: number;
  defIgnore: number;
  onPatch: (patch: Partial<Draft>) => void;
}

export function DefZone({ value, changed, onReset, onEnter, defShred, defIgnore, onPatch }: DefZoneProps) {
  return (
    <Zone id="def" index={5} title="Enemy DEF" value={value} changed={changed} onReset={onReset} onEnter={onEnter}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Pct label="DEF reduction" value={defShred} onChange={(v) => onPatch({ defShred: v })} min={0} max={100} />
        <Pct label="DEF ignore" value={defIgnore} onChange={(v) => onPatch({ defIgnore: v })} min={0} max={100} />
      </div>
    </Zone>
  );
}
