import { useCallback, useEffect, useRef, useState } from 'react';
import { formatNumber } from '../lib/damage';
import type { DamageGroupVm, DamageRowVm } from '../lib/damage-groups';
import { ELEMENT_DOT } from '../data/elements';

/** Data-viz bar tints — the same hues as the row dots, washed way back. */
const ELEMENT_TINT: Record<string, string> = {
  pyro: 'bg-pyro/18',
  hydro: 'bg-hydro/18',
  electro: 'bg-electro/18',
  cryo: 'bg-cryo/18',
  anemo: 'bg-anemo/18',
  geo: 'bg-geo/18',
  dendro: 'bg-dendro/18',
  physical: 'bg-physical/18',
};

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
 * single Normal hit. Rows take their element's hue; group totals stay forest.
 */
function ValueBar({ value, max, tint }: { value: number; max: number; tint?: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <span
      className={`absolute inset-y-1 right-0 rounded-sm ${tint ?? 'bg-forest-500/15'}`}
      style={{ width: `${pct.toFixed(2)}%` }}
      aria-hidden="true"
    />
  );
}

/** Columns shown only when the panel is wide enough for all four (see below). */
const WIDE_ONLY = 'hidden @min-[560px]:table-cell';
/** Their stand-in inside the first column when it is not. */
const NARROW_ONLY = 'block @min-[560px]:hidden';

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

  // The panel is 352px on a phone and 510px at a 1280px viewport, narrower
  // than four columns need, and the column that got cut off was Average — the
  // one the reader came for. Below 560px of panel (a container query, not the
  // viewport: the panel is half the page on desktop) Non-CRIT and CRIT fold
  // into a muted line under the attack name. If a Diff column still pushes it
  // wider, each clipped edge gets a fade and the header says so.
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
    <section id="damage-table" className="panel @container mt-5 overflow-hidden">
      <div className="flex items-baseline justify-between gap-3 border-b border-[var(--line)] px-5 py-4">
        <h3 className="text-base font-semibold text-[var(--text)]">Damage per hit</h3>
        <span className="text-xs text-[var(--muted)]">
          {edges.right ? 'Scroll sideways for CRIT and Average →' : 'Click a row to load it into the multipliers above'}
        </span>
      </div>

      <div className="relative">
        <div ref={scrollRef} onScroll={syncEdges} className="overflow-x-auto">
          <table className="w-full text-left text-sm @min-[560px]:min-w-[560px]">
            <thead>
              <tr className="border-b border-[var(--line)] text-xs uppercase tracking-wide text-[var(--muted)]">
                <th className="px-5 py-2.5 font-medium">Attack</th>
                <th className={`${WIDE_ONLY} px-3 py-2.5 text-right font-medium`}>Non-CRIT</th>
                <th className={`${WIDE_ONLY} px-3 py-2.5 text-right font-medium`}>CRIT</th>
                <th className={`px-3 py-2.5 text-right font-medium ${hasDiff ? '' : 'pr-5'}`}>Average</th>
                {hasDiff && <th className="px-5 py-2.5 text-right font-medium">Diff</th>}
              </tr>
            </thead>
            {groups.map((g) => {
              // Display-only rows (CD, Duration, Energy) are metadata, not hits —
              // they ride in the header as chips instead of eating table rows.
              const meta = g.rows.filter((r) => r.text !== undefined);
              const hits = g.rows.filter((r) => r.text === undefined);
              return (
              <tbody key={g.group} className="border-b border-[var(--line)] last:border-b-0">
                <tr className="bg-[var(--surface-2)]/50">
                  <td colSpan={hasDiff ? 5 : 4} className="px-5 py-2">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-forest-600">{g.label}</span>
                      {meta.map((r) => (
                        <span
                          key={r.id}
                          className="tnum rounded-full bg-[var(--surface)] px-2 py-px text-[10px] font-medium text-[var(--muted)] ring-1 ring-[var(--line)]"
                        >
                          {r.text}
                        </span>
                      ))}
                    </span>
                  </td>
                </tr>
                {hits.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => onPick(r)}
                    className={`cursor-pointer border-t border-[var(--line)]/60 transition-colors hover:bg-[var(--soft)] ${
                      r.active ? 'bg-forest-500/10' : ''
                    }`}
                  >
                    <td
                      className={`px-5 py-2 text-[var(--text)] ${r.active ? 'shadow-[inset_2px_0_0_var(--color-forest-500)]' : ''}`}
                    >
                      <span className="flex items-center gap-2">
                        <span
                          data-testid={`row-element-${r.id}`}
                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${ELEMENT_DOT[r.element] ?? ELEMENT_DOT.physical}`}
                          aria-hidden="true"
                        />
                        {r.label}
                      </span>
                      <span className={`${NARROW_ONLY} tnum mt-0.5 pl-3.5 text-[11px] text-[var(--muted)]`}>
                        non-crit {formatNumber(r.nonCrit)} · crit {formatNumber(r.crit)}
                      </span>
                    </td>
                    <>
                      <td className={`${WIDE_ONLY} px-3 py-2 text-right tnum text-[var(--text)]`}>{formatNumber(r.nonCrit)}</td>
                      <td className={`${WIDE_ONLY} px-3 py-2 text-right tnum text-forest-600`}>{formatNumber(r.crit)}</td>
                      <td className={`relative px-3 py-2 text-right tnum font-semibold text-[var(--text)] ${hasDiff ? '' : 'pr-5'}`}>
                        <ValueBar value={r.expected} max={maxExpected} tint={ELEMENT_TINT[r.element]} />
                        <span className="relative">{formatNumber(r.expected)}</span>
                      </td>
                      {hasDiff && (
                        <td className="px-5 py-2 text-right">
                          <Delta from={r.diff} to={r.expected} />
                        </td>
                      )}
                    </>
                  </tr>
                ))}
                {g.total && (
                  <tr className="border-t border-[var(--line)]">
                    <td className="px-5 py-2 font-medium text-[var(--muted)]">
                      Total DMG
                      <span className={`${NARROW_ONLY} tnum mt-0.5 text-[11px] font-normal`}>
                        non-crit {formatNumber(g.total.nonCrit)} · crit {formatNumber(g.total.crit)}
                      </span>
                    </td>
                    <td className={`${WIDE_ONLY} px-3 py-2 text-right tnum text-[var(--muted)]`}>{formatNumber(g.total.nonCrit)}</td>
                    <td className={`${WIDE_ONLY} px-3 py-2 text-right tnum text-[var(--muted)]`}>{formatNumber(g.total.crit)}</td>
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
              );
            })}
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
