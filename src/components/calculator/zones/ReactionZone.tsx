import { ELEMENT_LABEL } from '../../../data/elements';
import type { AdditiveReaction, AmplifiedReaction, ElementType, TransformativeReaction } from '../../../lib/damage';
import { ElementIcon } from '../../ElementIcon';
import { ADDITIVE, AMPLIFIED, REACTION_ELEMENT, SWIRLABLE, TRANSFORMATIVE } from '../constants';
import type { Draft } from '../draft';
import { ElementPair, IconSelect, Num, Pct, Zone } from '../primitives';
import type { ZoneChrome } from './types';

/** Zone 4 — amplifying / additive / transformative reactions and the EM bonus. */
export interface ReactionZoneProps extends ZoneChrome {
  amplified: AmplifiedReaction;
  additive: AdditiveReaction;
  transformative: TransformativeReaction;
  swirlElement: ElementType;
  em: number;
  /** The character's own EM, shown as the floor in the label. */
  ownEM: number;
  reactionBonus: number;
  ampReactionBonus: number;
  transformReactionBonus: number;
  onPatch: (patch: Partial<Draft>) => void;
}

export function ReactionZone({
  value,
  changed,
  onReset,
  onEnter,
  amplified,
  additive,
  transformative,
  swirlElement,
  em,
  ownEM,
  reactionBonus,
  ampReactionBonus,
  transformReactionBonus,
  onPatch,
}: ReactionZoneProps) {
  return (
    <Zone id="reaction" index={4} title="Reaction" value={value} changed={changed} onReset={onReset} onEnter={onEnter}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium text-[var(--muted)]">Amplifying — Vaporize / Melt (×1.5–2, multiplies the hit)</span>
          <IconSelect
            value={amplified}
            onChange={(v) => onPatch({ amplified: v })}
            options={AMPLIFIED.map((o) => ({
              ...o,
              icon: REACTION_ELEMENT[o.value] ? <ElementPair els={REACTION_ELEMENT[o.value]} /> : undefined,
            }))}
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-[var(--muted)]">Additive — Aggravate / Spread (flat bonus to the hit)</span>
          <IconSelect
            value={additive}
            onChange={(v) => onPatch({ additive: v })}
            options={ADDITIVE.map((o) => ({
              ...o,
              icon: REACTION_ELEMENT[o.value] ? <ElementPair els={REACTION_ELEMENT[o.value]} /> : undefined,
            }))}
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-[var(--muted)]">Transformative — Overload, Burning, Burgeon… (separate hit, no CRIT)</span>
          <IconSelect
            value={transformative}
            onChange={(v) => onPatch({ transformative: v })}
            options={TRANSFORMATIVE.map((o) => ({
              ...o,
              icon: REACTION_ELEMENT[o.value] ? <ElementPair els={REACTION_ELEMENT[o.value]} /> : undefined,
            }))}
          />
        </label>
        {transformative === 'swirl' && (
          <label className="block">
            <span className="text-xs font-medium text-[var(--muted)]">Swirl absorbed element</span>
            <IconSelect
              value={swirlElement}
              onChange={(v) => onPatch({ swirlElement: v })}
              options={SWIRLABLE.map((el) => ({ value: el, label: ELEMENT_LABEL[el], icon: <ElementIcon el={el} className="h-5 w-5" /> }))}
            />
          </label>
        )}
        <Num
          label={`Elemental Mastery bonus (base ${Math.round(ownEM)})`}
          value={em}
          onChange={(v) => onPatch({ em: v })}
          step={10}
          min={0}
          max={3000}
        />
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Pct label="Reaction bonus" value={reactionBonus} onChange={(v) => onPatch({ reactionBonus: v })} min={0} max={1000} />
        <Pct label="Amplifying bonus" value={ampReactionBonus} onChange={(v) => onPatch({ ampReactionBonus: v })} min={0} max={1000} />
        <Pct label="Transformative bonus" value={transformReactionBonus} onChange={(v) => onPatch({ transformReactionBonus: v })} min={0} max={1000} />
      </div>
    </Zone>
  );
}
