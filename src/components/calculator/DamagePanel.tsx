import type { AmplifiedReaction, DamageResult, TransformativeReaction } from '../../lib/damage';
import { formatNumber } from '../../lib/damage';
import DamageTable, { Delta } from '../DamageTable';
import type { DamageBaseline, DamageGroupVm, DamageRowVm } from '../DamageTable';
import type { Draft } from './draft';
import { NO_TALENT_NOTE } from './constants';

/** Reactions this character can reach, with their current values. */
export interface ReactionPreviews {
  amplified: { key: AmplifiedReaction; label: string; multiplier: number }[];
  transformative: { key: TransformativeReaction; label: string; value: number }[];
}

export interface DamagePanelProps {
  /** Per-hit table, baseline already overlaid as the Diff column. */
  groups: DamageGroupVm[];
  onPickRow: (vm: DamageRowVm) => void;

  /** False for characters with no per-hit talent table — the whole panel
   *  becomes a notice rather than a table of placeholder-driven numbers. */
  hasTalentData: boolean;

  result: DamageResult;
  expected: number;
  capped: boolean;

  /** The zone factors, in chain order — drives the formula strip. */
  baseDamage: number;
  dmgMult: number;
  critMult: number;

  /** Baseline (Diff) state. */
  baseline: DamageBaseline | null;
  baselineForActiveRow: number | undefined;
  onToggleBaseline: () => void;

  /** One-click reaction application. */
  reactionPreviews: ReactionPreviews;
  amplified: AmplifiedReaction;
  transformative: TransformativeReaction;
  onPatch: (patch: Partial<Draft>) => void;

  /** Highlighting a chain step, and jumping to the zone it belongs to. */
  highlight: string | null;
  onJumpToZone: (id: string) => void;
}

export function DamagePanel({
  groups,
  onPickRow,
  hasTalentData,
  result,
  expected,
  capped,
  baseDamage,
  dmgMult,
  critMult,
  baseline,
  baselineForActiveRow,
  onToggleBaseline,
  reactionPreviews,
  amplified,
  transformative,
  onPatch,
  highlight,
  onJumpToZone,
}: DamagePanelProps) {
  if (!hasTalentData) {
    return (
      <div className="panel p-4">
        <p data-testid="no-talent-note" className="text-[13px] leading-relaxed text-[var(--muted)]">
          {NO_TALENT_NOTE} There is no per-hit talent table for this character, so every damage row would be
          guesswork. Choose another character to see its hits.
        </p>
      </div>
    );
  }
  const chain: { id: string; label: string; value: number; display: string }[] = [
    { id: 'base', label: 'Base', value: 0, display: formatNumber(baseDamage) },
    { id: 'bonus', label: 'Bonus', value: dmgMult, display: `×${dmgMult.toFixed(3)}` },
    { id: 'crit', label: 'Crit', value: critMult, display: `×${critMult.toFixed(3)}` },
    { id: 'reaction', label: 'Reaction', value: result.reactionMultiplier, display: `×${result.reactionMultiplier.toFixed(3)}` },
    { id: 'def', label: 'DEF', value: result.defMultiplier, display: `×${result.defMultiplier.toFixed(3)}` },
    { id: 'res', label: 'RES', value: result.resMultiplier, display: `×${result.resMultiplier.toFixed(3)}` },
  ];

  // What each factor is worth on its own: how much damage would be lost if it
  // were 1.0. The base factor is excluded — it is the thing being multiplied.
  const contribution = chain
    .filter((c) => c.id !== 'base' && c.value > 0)
    .map((c) => ({ ...c, gain: expected - expected / c.value }));

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
      <div className="space-y-4">
        <DamageTable groups={groups} onPick={onPickRow} />
      </div>

      <div className="space-y-4">
        <div className="panel p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs uppercase tracking-wide text-[var(--muted)]">Expected</span>
            <span className="tnum text-xl font-semibold text-[var(--text)]">{formatNumber(expected)}</span>
          </div>
          <p className="mt-0.5 text-[11px] text-[var(--muted)]">
            non-crit {formatNumber(result.nonCrit)} · crit {formatNumber(result.critHit)}
          </p>
          {capped && <p className="mt-1 text-[11px] text-pyro">Capped at 20,000,000 (single-hit limit).</p>}
          <div className="mt-2 flex items-center justify-between gap-2 border-t border-[var(--line)] pt-2">
            <span className="text-[11px] text-[var(--muted)]">
              {baseline === null ? (
                'Change one thing, pin it, and read the delta.'
              ) : baselineForActiveRow !== undefined ? (
                <>
                  vs pinned <span className="tnum text-[var(--text)]">{formatNumber(baselineForActiveRow)}</span> ·{' '}
                  <Delta from={baselineForActiveRow} to={expected} />
                </>
              ) : (
                'Baseline pinned — see the Diff column.'
              )}
            </span>
            <button
              type="button"
              onClick={onToggleBaseline}
              className="shrink-0 rounded-lg border border-[var(--line)] px-2 py-1 text-[11px] font-semibold text-[var(--muted)] transition-colors hover:border-forest-500 hover:text-forest-600"
            >
              {baseline ? 'Clear baseline' : 'Pin baseline'}
            </button>
          </div>
        </div>

        {(reactionPreviews.amplified.length > 0 || reactionPreviews.transformative.length > 0) && (
          <details className="panel p-4">
            <summary className="cursor-pointer text-sm font-semibold text-[var(--text)]">
              Reactions <span className="ml-2 text-[11px] font-normal text-[var(--muted)]">click to apply</span>
            </summary>
            <div className="mt-2 space-y-1">
              {reactionPreviews.amplified.map((a) => (
                <button
                  key={a.key}
                  type="button"
                  onClick={() => onPatch({ amplified: a.key })}
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
                    amplified === a.key ? 'bg-forest-600/12 text-forest-700' : 'text-[var(--muted)] hover:bg-[var(--soft)]'
                  }`}
                >
                  <span>{a.label}</span>
                  <span className="tnum text-[var(--text)]">×{a.multiplier.toFixed(2)}</span>
                </button>
              ))}
              {reactionPreviews.transformative.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => onPatch({ transformative: t.key })}
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
                    transformative === t.key ? 'bg-forest-600/12 text-forest-700' : 'text-[var(--muted)] hover:bg-[var(--soft)]'
                  }`}
                >
                  <span>{t.label}</span>
                  <span className="tnum text-forest-600">{formatNumber(t.value)}</span>
                </button>
              ))}
            </div>
          </details>
        )}

        <details className="panel p-4">
          <summary className="cursor-pointer text-sm font-semibold text-[var(--text)]">Formula &amp; contribution</summary>
          <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
            {chain.map((c, i) => (
              <span key={c.id} className="inline-flex items-center gap-1.5">
                {i > 0 && <span className="text-[var(--muted)]">×</span>}
                <button
                  type="button"
                  onClick={() => onJumpToZone(c.id)}
                  className={`tnum rounded px-1.5 py-0.5 transition-colors ${
                    highlight === c.id ? 'bg-forest-500/15 text-forest-700' : 'text-[var(--text)] hover:bg-[var(--soft)]'
                  }`}
                >
                  {c.display}
                </button>
              </span>
            ))}
            <span className="text-[var(--muted)]">=</span>
            <span className="tnum font-semibold text-forest-600">{formatNumber(expected)}</span>
          </div>
          <div className="mt-3 max-h-[200px] space-y-2.5 overflow-y-auto pr-1">
            {contribution.map((c) => (
              <div key={c.id}>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--muted)]">
                    {c.label} {c.display}
                  </span>
                  <span className="tnum font-medium text-forest-600">
                    +{formatNumber(c.gain)} ({expected > 0 ? Math.round((c.gain / expected) * 100) : 0}%)
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]">
                  <div
                    className="h-full rounded-full bg-forest-600"
                    style={{ width: `${Math.min((c.gain / expected) * 100, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          {result.transformative > 0 && (
            <p className="mt-3 border-t border-[var(--line)] pt-2 text-[11px] text-[var(--muted)]">
              Transformative reaction adds{' '}
              <span className="tnum font-semibold text-forest-600">+{formatNumber(result.transformative)}</span>{' '}
              {result.transformativeName} as a separate hit.
            </p>
          )}
        </details>
      </div>
    </div>
  );
}
