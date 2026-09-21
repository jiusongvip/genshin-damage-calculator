import { ELEMENT_LABEL } from '../../../data/elements';
import type { ElementType } from '../../../lib/damage';
import { ENEMY_ELEMENTS } from '../constants';
import type { Draft } from '../draft';
import { Pct, Zone } from '../primitives';
import type { ZoneChrome } from './types';

/** Zone 6 — the enemy RES multiplier, per element. */
export interface ResZoneProps extends ZoneChrome {
  resShred: number;
  /** Per-element overrides on top of the enemy preset — drives the "edited" mark. */
  enemyResMap: Partial<Record<ElementType, number>>;
  /** The enemy's effective resistances, overrides already merged in. */
  resistances: Record<string, number>;
  onPatch: (patch: Partial<Draft>) => void;
}

export function ResZone({ value, changed, onReset, onEnter, resShred, enemyResMap, resistances, onPatch }: ResZoneProps) {
  return (
    <Zone id="res" index={6} title="Enemy RES" value={value} changed={changed} onReset={onReset} onEnter={onEnter}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {ENEMY_ELEMENTS.map((el) => (
          <Pct
            key={el}
            label={`${ELEMENT_LABEL[el]} RES`}
            value={resistances[el] ?? resistances.default}
            onChange={(v) => onPatch({ enemyResMap: { ...enemyResMap, [el]: v } })}
            min={-100}
            max={100}
          />
        ))}
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Pct label="RES reduction" value={resShred} onChange={(v) => onPatch({ resShred: v })} min={0} max={200} />
      </div>
    </Zone>
  );
}
