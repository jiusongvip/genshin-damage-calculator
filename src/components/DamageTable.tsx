import { formatNumber } from '../lib/damage';
import type { ElementType } from '../lib/damage';
import type { TalentGroup } from '../data/generated/talents';

export interface DamageRowVm {
  id: string;
  label: string;
  group: TalentGroup;
  element: ElementType;
  /** Multiplier used for this hit at the current talent level. */
  value: number;
  nonCrit: number;
  crit: number;
  expected: number;
  /** Baseline expected damage for the same row (Diff mode), when available. */
  diff?: number;
  /** Display-only rows (CD, Duration, Energy) carry a text value. */
  text?: string;
  active: boolean;
}

export interface DamageGroupVm {
  group: TalentGroup;
  label: string;
  rows: DamageRowVm[];
  total: { nonCrit: number; crit: number; expected: number; diff?: number } | null;
}

const GROUP_LABEL: Record<TalentGroup, string> = {
  normal: 'Normal Attack',
  charged: 'Charged Attack',
  plunge: 'Plunging Attack',
  skill: 'Elemental Skill',
  burst: 'Elemental Burst',
};

export { GROUP_LABEL };

function Delta({ from, to }: { from: number | undefined; to: number }) {
  if (from === undefined || from <= 0) return <span className="text-[var(--muted)]">—</span>;
  const pct = ((to - from) / from) * 100;
  if (Math.abs(pct) < 0.05) return <span className="text-[var(--muted)]">0.0%</span>;
  return (
    <span className={`tnum font-medium ${pct > 0 ? 'text-dendro' : 'text-pyro'}`}>
      {pct > 0 ? '+' : ''}
      {pct.toFixed(1)}%
    </span>
  );
}

/**
 * Per-hit damage table, modelled on the reference calculators: every damage
 * instance a talent produces, with its Non-CRIT / CRIT / Average columns.
 * Rows are clickable — picking one loads that hit into the six multiplier
 * zones above, so the formula chain explains the row instead of a summary.
 * When a baseline is set, an extra column shows the change against it.
 */
export default function DamageTable({
  groups,
  onPick,
}: {
  groups: DamageGroupVm[];
  onPick: (row: DamageRowVm) => void;
}) {
  const hasDiff = groups.some((g) => g.total?.diff !== undefined || g.rows.some((r) => r.diff !== undefined));

  return (
    <section id="damage-table" className="panel mt-5 overflow-hidden">
      <div className="flex items-baseline justify-between gap-3 border-b border-[var(--line)] px-5 py-4">
        <h3 className="text-base font-semibold text-[var(--text)]">Damage per hit</h3>
        <span className="text-xs text-[var(--muted)]">Click a row to load it into the multipliers above</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--line)] text-xs uppercase tracking-wide text-[var(--muted)]">
              <th className="px-5 py-2.5 font-medium">Attack</th>
              <th className="px-3 py-2.5 text-right font-medium">Non-CRIT</th>
              <th className="px-3 py-2.5 text-right font-medium">CRIT</th>
              <th className={`px-3 py-2.5 text-right font-medium ${hasDiff ? '' : 'pr-5'}`}>Average</th>
              {hasDiff && <th className="px-5 py-2.5 text-right font-medium">Diff</th>}
            </tr>
          </thead>
          {groups.map((g) => (
            <tbody key={g.group} className="border-b border-[var(--line)] last:border-b-0">
              <tr className="bg-[var(--surface-2)]/50">
                <td colSpan={hasDiff ? 5 : 4} className="px-5 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-forest-600">
                  {g.label}
                </td>
              </tr>
              {g.rows.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => onPick(r)}
                  className={`cursor-pointer border-t border-[var(--line)]/60 transition-colors hover:bg-[var(--soft)] ${
                    r.active ? 'bg-forest-500/10' : ''
                  }`}
                >
                  <td className="px-5 py-2 text-[var(--text)]">
                    <span className="flex items-center gap-2">
                      {r.active && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-forest-500" aria-hidden="true" />}
                      {r.label}
                    </span>
                  </td>
                  {r.text ? (
                    <td colSpan={hasDiff ? 4 : 3} className="px-5 py-2 text-right tnum text-[var(--muted)]">
                      {r.text}
                    </td>
                  ) : (
                    <>
                      <td className="px-3 py-2 text-right tnum text-[var(--text)]">{formatNumber(r.nonCrit)}</td>
                      <td className="px-3 py-2 text-right tnum text-forest-600">{formatNumber(r.crit)}</td>
                      <td className={`px-3 py-2 text-right tnum font-semibold text-[var(--text)] ${hasDiff ? '' : 'pr-5'}`}>{formatNumber(r.expected)}</td>
                      {hasDiff && (
                        <td className="px-5 py-2 text-right">
                          <Delta from={r.diff} to={r.expected} />
                        </td>
                      )}
                    </>
                  )}
                </tr>
              ))}
              {g.total && (
                <tr className="border-t border-[var(--line)]">
                  <td className="px-5 py-2 font-medium text-[var(--muted)]">Total DMG</td>
                  <td className="px-3 py-2 text-right tnum text-[var(--muted)]">{formatNumber(g.total.nonCrit)}</td>
                  <td className="px-3 py-2 text-right tnum text-[var(--muted)]">{formatNumber(g.total.crit)}</td>
                  <td className={`px-3 py-2 text-right tnum font-semibold text-forest-600 ${hasDiff ? '' : 'pr-5'}`}>{formatNumber(g.total.expected)}</td>
                  {hasDiff && (
                    <td className="px-5 py-2 text-right">
                      <Delta from={g.total.diff} to={g.total.expected} />
                    </td>
                  )}
                </tr>
              )}
            </tbody>
          ))}
        </table>
      </div>
    </section>
  );
}
