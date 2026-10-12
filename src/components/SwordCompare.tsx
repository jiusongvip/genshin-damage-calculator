import { useMemo, useState } from 'react';
import type { SwordRow } from '../data/swordCompare';

interface Props {
  swords: SwordRow[];
  silverLightId: string;
  verdictIds: string[];
  defaultSelected: string[];
}

const BADGE_CLS: Record<NonNullable<SwordRow['badge']>, string> = {
  Stronger: 'bg-amber-100 text-amber-800',
  'About even': 'bg-sky-100 text-sky-800',
  'Different use': 'bg-violet-100 text-violet-700',
};

const MAX_COLS = 5; // silver light + up to 4 others

export default function SwordCompare({ swords, silverLightId, verdictIds, defaultSelected }: Props) {
  const silverLight = swords.find((s) => s.id === silverLightId)!;
  const others = useMemo(() => swords.filter((s) => s.id !== silverLightId), [swords, silverLightId]);

  // Selector order: the 4 verdict swords first (in verdictIds order), then the rest alphabetically.
  const orderedOthers = useMemo(() => {
    const byId = new Map(others.map((s) => [s.id, s]));
    const first = verdictIds.map((id) => byId.get(id)).filter(Boolean) as SwordRow[];
    const rest = others
      .filter((s) => !verdictIds.includes(s.id))
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));
    return [...first, ...rest];
  }, [others, verdictIds]);

  const [selected, setSelected] = useState<string[]>(defaultSelected);
  const [query, setQuery] = useState('');

  const cols = [silverLight, ...selected.map((id) => others.find((s) => s.id === id)!)];
  const extraCount = selected.length; // non-pinned columns
  const atMax = extraCount >= MAX_COLS - 1;
  const atMin = extraCount <= 1;

  const maxATK = Math.max(...cols.map((c) => c.baseATK));

  const toggle = (id: string) => {
    setSelected((prev) => {
      if (prev.includes(id)) {
        if (prev.length <= 1) return prev; // keep at least one
        return prev.filter((x) => x !== id);
      }
      if (prev.length >= MAX_COLS - 1) return prev; // cap
      return [...prev, id];
    });
  };

  const q = query.trim().toLowerCase();
  const visible = orderedOthers.filter((s) => !q || s.name.toLowerCase().includes(q));

  return (
    <div className="mt-4">
      {/* selector — icon-first tiles: players recognise a sword by its silhouette and
          colour long before they read its name, so the art is the primary target and
          the name is demoted to a small caption underneath it. */}
      <div className="rounded-2xl border border-forest-200 bg-white/70 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-lg font-semibold text-forest-800">Add swords to compare</h3>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search 4★ swords"
            aria-label="Search 4-star swords"
            className="w-44 rounded-lg border border-forest-200 bg-white px-3 py-1.5 text-sm text-forest-900 outline-none focus:border-forest-400"
          />
        </div>

        <div className="mt-3 grid grid-cols-4 gap-1.5 sm:grid-cols-6 lg:grid-cols-8">
          {visible.map((s) => {
            const on = selected.includes(s.id);
            const disabled = !on && atMax;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => toggle(s.id)}
                disabled={disabled}
                aria-pressed={on}
                aria-label={`${on ? 'Remove' : 'Add'} ${s.name}${disabled ? ' — comparison is full' : ''}`}
                title={disabled ? 'Compare up to 5 swords' : s.name}
                className={`group relative flex flex-col items-center gap-1 rounded-2xl border px-1 pb-1.5 pt-2.5 transition-colors ${
                  on
                    ? 'border-forest-500 bg-forest-100'
                    : disabled
                      ? 'cursor-not-allowed border-forest-100 bg-white opacity-40'
                      : 'border-forest-200 bg-white hover:border-forest-300 hover:bg-forest-50'
                }`}
              >
                <img
                  src={s.icon}
                  alt=""
                  width="128"
                  height="128"
                  loading="lazy"
                  decoding="async"
                  className="h-16 w-16 object-contain transition-transform duration-150 group-hover:scale-105"
                />
                <span
                  className={`line-clamp-2 text-center text-[0.7rem] leading-tight ${
                    on ? 'font-semibold text-forest-900' : 'text-forest-600'
                  }`}
                >
                  {s.name}
                </span>
                <span
                  aria-hidden="true"
                  className={`absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full border text-[0.65rem] transition-opacity ${
                    on
                      ? 'border-forest-500 bg-forest-500 text-white'
                      : 'border-forest-200 bg-white text-transparent group-hover:border-forest-300'
                  }`}
                >
                  ✓
                </span>
              </button>
            );
          })}
        </div>

        {atMax && (
          <p className="mt-3 text-xs text-amber-700" role="status">
            You can compare up to 5 swords. Remove one to add another.
          </p>
        )}
      </div>

      {/* comparison table (vertical: one column per sword) — the column header leads
          with a large icon so a column can be identified by the weapon's own art. */}
      <div className="mt-4 overflow-x-auto rounded-2xl border border-forest-200">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 z-10 w-32 min-w-[8rem] border-r border-forest-200 bg-forest-50 px-3 py-3 align-bottom">
                <span className="sr-only">Row</span>
              </th>
              {cols.map((c, i) => (
                <th
                  key={c.id}
                  scope="col"
                  className={`min-w-[10rem] px-3 py-3 align-top font-normal ${i === 0 ? 'bg-cryo/10' : 'bg-white/60'}`}
                >
                  <div className="relative flex justify-center">
                    <img
                      src={c.icon}
                      alt=""
                      width="128"
                      height="128"
                      loading="lazy"
                      decoding="async"
                      className="h-16 w-16 object-contain"
                    />
                    {i > 0 && (
                      <button
                        type="button"
                        onClick={() => toggle(c.id)}
                        disabled={atMin}
                        title={atMin ? 'Keep at least one sword to compare' : 'Remove from comparison'}
                        className={`absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                          atMin ? 'cursor-not-allowed text-forest-200' : 'text-forest-500 hover:bg-forest-100 hover:text-forest-800'
                        }`}
                        aria-label={`Remove ${c.name}`}
                      >
                        ×
                      </button>
                    )}
                  </div>
                  <p className={`mt-1.5 text-center text-xs leading-tight ${i === 0 ? 'font-semibold text-forest-900' : 'text-[var(--muted)]'}`}>
                    {c.name}
                  </p>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-forest-200/70">
            <tr>
              <th scope="row" className="sticky left-0 z-10 border-r border-forest-200 bg-forest-50 px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.04em] text-forest-600">
                Base ATK (Lv. 90)
              </th>
              {cols.map((c, i) => {
                const isMax = c.baseATK === maxATK;
                return (
                  <td key={c.id} className={`px-3 py-3 text-center ${i === 0 ? 'bg-cryo/10' : 'bg-white/60'}`}>
                    <span
                      className={`inline-block rounded px-2 py-0.5 tabular-nums ${
                        isMax ? 'bg-forest-100 font-semibold text-forest-900' : 'text-[var(--text)]'
                      }`}
                    >
                      {c.baseATK}
                    </span>
                  </td>
                );
              })}
            </tr>

            <tr>
              <th scope="row" className="sticky left-0 z-10 border-r border-forest-200 bg-forest-50 px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.04em] text-forest-600">
                Sub-stat
              </th>
              {cols.map((c, i) => (
                <td key={c.id} className={`whitespace-nowrap px-3 py-3 text-center text-[var(--text)] ${i === 0 ? 'bg-cryo/10' : 'bg-white/60'}`}>
                  {c.subStat}
                </td>
              ))}
            </tr>

            <tr>
              <th scope="row" className="sticky left-0 z-10 border-r border-forest-200 bg-forest-50 px-3 py-3 align-top text-left text-xs font-semibold uppercase tracking-[0.04em] text-forest-600">
                Passive
              </th>
              {cols.map((c, i) => (
                <td key={c.id} className={`px-3 py-3 align-top ${i === 0 ? 'bg-cryo/10' : 'bg-white/60'}`}>
                  <p className="text-sm font-semibold text-[var(--text)]">{c.passiveName}</p>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">{c.passiveDesc}</p>
                </td>
              ))}
            </tr>

            <tr>
              <th scope="row" className="sticky left-0 z-10 border-r border-forest-200 bg-forest-50 px-3 py-3 align-top text-left text-xs font-semibold uppercase tracking-[0.04em] text-forest-600">
                vs Silver Light
              </th>
              {cols.map((c, i) => (
                <td key={c.id} className={`px-3 py-3 align-top ${i === 0 ? 'bg-cryo/10' : 'bg-white/60'}`}>
                  {i === 0 ? (
                    <span className="inline-block rounded-full bg-forest-300 px-2 py-0.5 text-[0.7rem] font-semibold text-forest-900">This weapon</span>
                  ) : c.badge && c.verdict ? (
                    <>
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[0.7rem] font-semibold ${BADGE_CLS[c.badge]}`}>{c.badge}</span>
                      <p className="mt-1 text-xs leading-snug text-[var(--muted)]">{c.verdict}</p>
                    </>
                  ) : (
                    <span className="text-[var(--muted)]">—</span>
                  )}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-xs text-[var(--muted)]">
        Verdicts summarise the 7.1 guide tests on Vesna and Odette; stats and passives are from HoYoWiki and the game data.
      </p>
    </div>
  );
}
