import { useCallback, useEffect, useRef, useState } from 'react';
import { formatNumber } from '../lib/damage';
import type { DamageGroupVm, DamageRowVm } from '../lib/damage-groups';

// The row/group view models and their labels live in the React-free
// lib/damage-groups module (shared with the static character pages). Re-exported
// here so existing importers keep pulling them from DamageTable.
export type { DamageGroupVm, DamageRowVm } from '../lib/damage-groups';
export { GROUP_LABEL } from '../lib/damage-groups';

/**
 * A pinned baseline for Diff mode. It stores the *computed* numbers rather than
 * the inputs that produced them: the comparison stays exact without a second
 * engine run. Row ids are character-specific, so a baseline is only meaningful
 * for the character it was pinned on.
 */
export interface DamageBaseline {
  characterId: string;
  /** row id → expected damage at pin time */
  rows: Map<string, number>;
  /** talent group → Total DMG at pin time */
  totals: Map<string, number>;
}

/** Capture the numbers a later comparison will be measured against. */
export function snapshotBaseline(characterId: string, groups: DamageGroupVm[]): DamageBaseline {
  const rows = new Map<string, number>();
  const totals = new Map<string, number>();
  for (const g of groups) {
    for (const r of g.rows) if (r.text === undefined) rows.set(r.id, r.expected);
    if (g.total) totals.set(g.group, g.total.expected);
  }
  return { characterId, rows, totals };
}

/**
 * Overlay pinned numbers onto the live table. Only rows the baseline actually
 * had get a `diff`; anything else keeps `undefined`, which the Diff column
 * renders as "—" rather than a fake 0.0%.
 *
 * `characterId` is required, not inferred: row ids are only unique *within* a
 * character (`combat1-0-1-hit-dmg` exists on all of them), so a baseline from
 * another character would match row-for-row and report garbage. Mismatches are
 * ignored outright.
 */
export function overlayBaseline(
  groups: DamageGroupVm[],
  baseline: DamageBaseline | null,
  characterId: string,
): DamageGroupVm[] {
  if (!baseline || baseline.characterId !== characterId) return groups;
  return groups.map((g) => ({
    ...g,
    rows: g.rows.map((r) =>
      r.text === undefined && baseline.rows.has(r.id) ? { ...r, diff: baseline.rows.get(r.id) } : r,
    ),
    total: g.total ? { ...g.total, diff: baseline.totals.get(g.group) } : null,
  }));
}

/** Signed percentage change from a pinned baseline. `from` is undefined for a
 *  row the baseline never had, which reads as "—" rather than a fake 0.0%. */
export function Delta({ from, to }: { from: number | undefined; to: number }) {
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
 * Data bar drawn behind a value, scaled to the biggest number in the table, so
 * "which hit actually carries the rotation" reads without comparing digits.
 * Rows and group totals share one scale, so a Burst total visibly dwarfs a
 * single Normal hit.
 */
function ValueBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return <span className="absolute inset-y-1 right-0 rounded-sm bg-forest-500/15" style={{ width: `${pct.toFixed(2)}%` }} aria-hidden="true" />;
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

  // One shared scale for every bar in the table (rows and group totals alike).
  const maxExpected = Math.max(
    1,
    ...groups.flatMap((g) => [...g.rows.map((r) => r.expected), g.total?.expected ?? 0]),
  );

  // The table has a 560px floor, but the panel it sits in is 352px on a phone
  // and 510px at a 1280px viewport, so it always scrolls on the left half of
  // the range. With no cue the reader just sees "AVERAGE" sliced in half and
  // concludes the numbers are wrong, so each clipped edge gets a fade.
  const scrollRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const syncEdges = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const left = el.scrollLeft > 1;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setEdges((prev) => (prev.left === left && prev.right === right ? prev : { left, right }));
  }, []);

  useEffect(() => {
    syncEdges();
    const el = scrollRef.current;
    if (!el) return;
    // The panel is inside a responsive grid, so its width changes without the
    // window resizing; a ResizeObserver catches both.
    const observer = new ResizeObserver(syncEdges);
    observer.observe(el);
    return () => observer.disconnect();
  }, [syncEdges, groups]);

  return (
    <section id="damage-table" className="panel mt-5 overflow-hidden">
      <div className="flex items-baseline justify-between gap-3 border-b border-[var(--line)] px-5 py-4">
        <h3 className="text-base font-semibold text-[var(--text)]">Damage per hit</h3>
        <span className="text-xs text-[var(--muted)]">
          {edges.right ? 'Scroll sideways for CRIT and Average →' : 'Click a row to load it into the multipliers above'}
        </span>
      </div>

      <div className="relative">
        <div ref={scrollRef} onScroll={syncEdges} className="overflow-x-auto">
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
                        <td className={`relative px-3 py-2 text-right tnum font-semibold text-[var(--text)] ${hasDiff ? '' : 'pr-5'}`}>
                          <ValueBar value={r.expected} max={maxExpected} />
                          <span className="relative">{formatNumber(r.expected)}</span>
                        </td>
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
                    <td className={`relative px-3 py-2 text-right tnum font-semibold text-forest-600 ${hasDiff ? '' : 'pr-5'}`}>
                      <ValueBar value={g.total.expected} max={maxExpected} />
                      <span className="relative">{formatNumber(g.total.expected)}</span>
                    </td>
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

        {edges.left && (
          <div
            className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-[var(--surface)] to-transparent"
            aria-hidden="true"
          />
        )}
        {edges.right && (
          <div
            className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-[var(--surface)] to-transparent"
            aria-hidden="true"
          />
        )}
      </div>
    </section>
  );
}
