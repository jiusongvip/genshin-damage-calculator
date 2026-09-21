import type { CritMode, Draft } from '../draft';
import { Glyph, IconSelect, Pct, Zone } from '../primitives';
import type { ZoneChrome } from './types';

/** Zone 3 — the CRIT multiplier, in expected / always / never mode. */
export interface CritZoneProps extends ZoneChrome {
  critRate: number;
  critDMG: number;
  critMode: CritMode;
  /** Effective CRIT Rate including the character's own 5% — over 1 is wasted. */
  critRateRaw: number;
  onPatch: (patch: Partial<Draft>) => void;
}

export function CritZone({
  value,
  changed,
  onReset,
  onEnter,
  critRate,
  critDMG,
  critMode,
  critRateRaw,
  onPatch,
}: CritZoneProps) {
  return (
    <Zone id="crit" index={3} title="CRIT" value={value} changed={changed} onReset={onReset} onEnter={onEnter}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Pct label="CRIT Rate bonus" value={critRate} onChange={(v) => onPatch({ critRate: v })} min={0} max={100} />
        <Pct label="CRIT DMG bonus" value={critDMG} onChange={(v) => onPatch({ critDMG: v })} min={0} max={1000} />
        <label className="block">
          <span className="text-xs font-medium text-[var(--muted)]">Settlement</span>
          <IconSelect
            value={critMode}
            onChange={(v) => onPatch({ critMode: v as CritMode })}
            options={[
              { value: 'expected', label: 'Expected (average)', icon: <Glyph name="expected" className="h-5 w-5" /> },
              { value: 'crit', label: 'Always CRIT', icon: <Glyph name="crit" className="h-5 w-5" /> },
              { value: 'nonCrit', label: 'Never CRIT', icon: <Glyph name="nonCrit" className="h-5 w-5" /> },
            ]}
          />
        </label>
      </div>
      {critRateRaw > 1 && (
        <p className="mt-2 text-xs text-pyro">
          CRIT Rate is overcapped — {((critRateRaw - 1) * 100).toFixed(1)}% of it is wasted past the 100% cap.
        </p>
      )}
    </Zone>
  );
}
