import type { BuffState, DamageResult } from '../../lib/damage';
import { formatNumber, formatPercent } from '../../lib/damage';
import type { ConstellationEntry, PassiveEntry } from '../../data/generated/constellations';

/** One row of the base / mod / total stat table. */
interface StatRow {
  label: string;
  base: number;
  mod: number;
  total: number;
  fmt: 'int' | 'pct';
}

export interface CharacterStatsProps {
  result: Pick<
    DamageResult,
    | 'baseHP'
    | 'totalHP'
    | 'baseATK'
    | 'totalATK'
    | 'baseDEF'
    | 'totalDEF'
    | 'em'
    | 'er'
    | 'critRateRaw'
    | 'critDMG'
  >;
}

/**
 * The Character tab's stat table — base / mod / total, mirroring the reference
 * panels. The rows are derived here rather than passed in: which stats get a
 * row is presentation, not calculation.
 */
export function CharacterStats({ result }: CharacterStatsProps) {
  const rows: StatRow[] = [
    { label: 'HP', base: result.baseHP, mod: result.totalHP - result.baseHP, total: result.totalHP, fmt: 'int' },
    { label: 'ATK', base: result.baseATK, mod: result.totalATK - result.baseATK, total: result.totalATK, fmt: 'int' },
    { label: 'DEF', base: result.baseDEF, mod: result.totalDEF - result.baseDEF, total: result.totalDEF, fmt: 'int' },
    { label: 'Elemental Mastery', base: 0, mod: result.em, total: result.em, fmt: 'int' },
    { label: 'Energy Recharge', base: 1, mod: result.er, total: 1 + result.er, fmt: 'pct' },
    { label: 'CRIT Rate', base: 0.05, mod: result.critRateRaw - 0.05, total: result.critRateRaw, fmt: 'pct' },
    { label: 'CRIT DMG', base: 0.5, mod: result.critDMG - 0.5, total: result.critDMG, fmt: 'pct' },
  ];

  return (
    <section className="panel p-5">
      <h3 className="text-base font-semibold text-[var(--text)]">Character stats</h3>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--line)] text-xs uppercase tracking-wide text-[var(--muted)]">
              <th className="py-2 pr-3 font-medium">Stat</th>
              <th className="px-3 py-2 text-right font-medium">Base</th>
              <th className="px-3 py-2 text-right font-medium">Mod</th>
              <th className="py-2 pl-3 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-b border-[var(--line)]/60 last:border-b-0">
                <td className="py-1.5 pr-3 text-[var(--muted)]">{r.label}</td>
                <td className="px-3 py-1.5 text-right tnum text-[var(--text)]">{r.fmt === 'pct' ? formatPercent(r.base) : formatNumber(r.base)}</td>
                <td className="px-3 py-1.5 text-right tnum text-forest-600">
                  {r.mod > 0 ? '+' : ''}
                  {r.fmt === 'pct' ? formatPercent(r.mod) : formatNumber(r.mod)}
                </td>
                <td className="py-1.5 pl-3 text-right tnum font-semibold text-[var(--text)]">{r.fmt === 'pct' ? formatPercent(r.total) : formatNumber(r.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export interface CharacterPassivesProps {
  constellations: ConstellationEntry[];
  ascensionPassives: PassiveEntry[];
  /** Constellation levels that actually feed the damage engine. */
  consModelled: Record<number, Partial<BuffState>>;
  /** Levels whose only effect is the C3 / C5 +3 talent bump — modelled too. */
  consBumpLevels: number[];
  passiveModelled: Record<number, Partial<BuffState>>;
  /** Active constellation level, 0–6. */
  activeCons: number;
  /** Indices of the ascension passives the user has switched on. */
  passiveOn: number[];
  onTogglePassive: (index: number, on: boolean) => void;
}

/**
 * The collapsible "Constellations & ascension passives" block. Levels above the
 * active constellation are dimmed; passives without a modelled effect are
 * rendered read-only so the list stays informative rather than a dead control.
 */
export function CharacterPassives({
  constellations,
  ascensionPassives,
  consModelled,
  consBumpLevels,
  passiveModelled,
  activeCons,
  passiveOn,
  onTogglePassive,
}: CharacterPassivesProps) {
  if (constellations.length === 0 && ascensionPassives.length === 0) return null;

  return (
    <details className="panel mt-3 p-4">
      <summary className="cursor-pointer text-sm font-semibold text-[var(--text)]">Constellations &amp; ascension passives</summary>
      <div className="mt-3">
        <ul className="max-h-[260px] space-y-2 overflow-y-auto pr-1">
          {constellations.map((c) => {
            const modelled = !!consModelled[c.level] || consBumpLevels.includes(c.level);
            return (
            <li key={c.level} className={c.level <= activeCons ? '' : 'opacity-45'}>
              <p className="text-xs font-medium text-[var(--text)]">
                C{c.level} · {c.name}
                {modelled ? (
                  <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-forest-600">modelled</span>
                ) : (
                  <span className="ml-2 text-[10px] text-[var(--muted)]">not modelled — text only</span>
                )}
              </p>
              <p className="text-xs leading-relaxed text-[var(--muted)]">{c.description}</p>
            </li>
            );
          })}
        </ul>
        {ascensionPassives.length > 0 && (
          <div className="mt-4 border-t border-[var(--line)] pt-3">
            <p className="text-xs font-semibold text-[var(--muted)]">Ascension passives</p>
            <ul className="mt-2 max-h-[200px] space-y-2 overflow-y-auto pr-1">
              {ascensionPassives.map((p, i) => (
                <li key={i}>
                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={passiveOn.includes(i)}
                      disabled={!passiveModelled[i]}
                      onChange={(e) => onTogglePassive(i, e.target.checked)}
                    />
                    <span>
                      <span className="text-xs font-medium text-[var(--text)]">
                        {p.name}
                        {passiveModelled[i] ? (
                          <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-forest-600">modelled</span>
                        ) : (
                          <span className="ml-2 text-[10px] text-[var(--muted)]">not modelled — text only</span>
                        )}
                      </span>
                      <span className="block text-xs leading-relaxed text-[var(--muted)]">{p.description}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </details>
  );
}
