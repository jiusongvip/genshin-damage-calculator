import { useEffect, useMemo, useRef, useState } from 'react';
import type { SilverLightFit } from '../data/silverLightFits';
import { ElementIcon } from './ElementIcon';
import { ELEMENT_BG } from './calculator/constants';

interface Props {
  fits: SilverLightFit[];
}

const ELEMENT_ORDER = ['anemo', 'geo', 'electro', 'dendro', 'hydro', 'pyro', 'cryo'] as const;
// Hash links such as #fit-keqing (used by the hero chips) open that character's verdict.
const HASH_PREFIX = '#fit-';

function VerdictMark({ good, className = 'h-6 w-6 text-xs' }: { good: boolean; className?: string }) {
  return (
    <span
      className={`flex items-center justify-center rounded-full font-bold text-white shadow ${good ? 'bg-emerald-600' : 'bg-rose-500'} ${className}`}
      aria-hidden="true"
    >
      {good ? '✓' : '✕'}
    </span>
  );
}

export default function SilverLightFitPicker({ fits }: Props) {
  const ordered = useMemo(
    () =>
      [...fits].sort(
        (a, b) => ELEMENT_ORDER.indexOf(a.element) - ELEMENT_ORDER.indexOf(b.element) || a.name.localeCompare(b.name),
      ),
    [fits],
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Set<string>>(() => new Set());
  const [revealAll, setRevealAll] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const selected = fits.find((f) => f.id === selectedId) ?? null;
  const goodCount = fits.filter((f) => f.rating === 'good').length;

  const pick = (id: string, scroll: boolean) => {
    setSelectedId(id);
    setRevealed((prev) => new Set(prev).add(id));
    // On narrow screens the verdict panel sits above the grid, so bring it back into view.
    if (scroll && window.matchMedia('(max-width: 1023px)').matches) {
      panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  useEffect(() => {
    const fromHash = () => {
      if (!location.hash.startsWith(HASH_PREFIX)) return;
      const id = location.hash.slice(HASH_PREFIX.length);
      if (!fits.some((f) => f.id === id)) return;
      pick(id, false);
      // #fit-* matches no element, so the browser won't scroll by itself.
      document.getElementById('recommended')?.scrollIntoView({ behavior: 'smooth' });
    };
    fromHash();
    window.addEventListener('hashchange', fromHash);
    return () => window.removeEventListener('hashchange', fromHash);
  }, [fits]);

  return (
    <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
      {/* verdict panel — first on mobile, sticky right column on desktop */}
      <div ref={panelRef} className="scroll-mt-24 lg:sticky lg:top-24 lg:order-2" aria-live="polite">
        {selected ? (
          <div
            className={`overflow-hidden rounded-2xl border bg-white/80 ${selected.rating === 'good' ? 'border-emerald-300' : 'border-rose-200'}`}
          >
            <div className="flex items-center gap-4 p-4">
              <span className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl ring-1 ring-[var(--line)]">
                <span className={`absolute inset-0 bg-linear-to-b ${ELEMENT_BG[selected.element]}`} aria-hidden="true" />
                <img src={`/images/portraits/${selected.id}.webp`} alt={`${selected.name} portrait`} width="256" height="256" className="relative h-full w-full object-cover" />
              </span>
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 font-display text-lg font-semibold leading-tight text-[var(--text)]">
                  <ElementIcon el={selected.element} className="h-4 w-4" />
                  {selected.name}
                </p>
                <p
                  className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${
                    selected.rating === 'good' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-700'
                  }`}
                >
                  <VerdictMark good={selected.rating === 'good'} className="h-4 w-4 text-[10px]" />
                  {selected.rating === 'good' ? 'Good with Silver Light' : 'Not a good fit'}
                </p>
              </div>
            </div>
            <div className="border-t border-[var(--line)] px-4 py-3">
              {selected.team && (
                <p className="mb-2 inline-block rounded-full bg-violet-100 px-2 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide text-violet-700">
                  {selected.team} teams only
                </p>
              )}
              <p className="text-sm leading-relaxed text-[var(--muted)]">{selected.reason}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-2xl border border-dashed border-forest-300 bg-white/50 p-5">
            <img src="/images/weapons/silver-light.webp" alt="" width="128" height="128" className="h-12 w-12 shrink-0 object-contain" aria-hidden="true" />
            <p className="text-sm leading-relaxed text-[var(--muted)]">
              <span className="font-semibold text-[var(--text)]">Tap a character</span> to see whether Silver Light suits them &mdash; and why.
            </p>
          </div>
        )}

        <div className="mt-3 flex items-center justify-between gap-3 text-xs text-[var(--muted)]">
          <span>
            {revealAll ? fits.length : revealed.size} / {fits.length} revealed
          </span>
          <button
            type="button"
            onClick={() => setRevealAll((v) => !v)}
            aria-pressed={revealAll}
            className="rounded-full border border-forest-300 px-3 py-1 font-semibold text-forest-700 transition-colors hover:bg-forest-50"
          >
            {revealAll ? 'Hide verdicts' : 'Reveal all'}
          </button>
        </div>
      </div>

      {/* character grid — one block, ordered by element then name (no group headers) */}
      <div className="lg:order-1">
        <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))' }}>
          {ordered.map((c) => {
            const isSelected = c.id === selectedId;
            const shown = revealAll || revealed.has(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => pick(c.id, true)}
                title={c.name}
                aria-pressed={isSelected}
                className={`relative aspect-square overflow-hidden rounded-xl transition-all ${
                  isSelected ? 'ring-2 ring-forest-500' : 'ring-1 ring-[var(--line)] hover:-translate-y-0.5 hover:ring-forest-400'
                }`}
              >
                <span className={`absolute inset-0 bg-linear-to-b ${ELEMENT_BG[c.element]}`} aria-hidden="true" />
                <img
                  src={`/images/portraits/${c.id}.webp`}
                  alt={`${c.name} portrait`}
                  width="256"
                  height="256"
                  loading="lazy"
                  decoding="async"
                  className={`relative h-full w-full object-cover transition-opacity ${shown && c.rating === 'bad' && !isSelected ? 'opacity-60' : ''}`}
                />
                {shown ? (
                  <VerdictMark good={c.rating === 'good'} className="absolute right-1.5 top-1.5 h-6 w-6 text-xs" />
                ) : (
                  <ElementIcon el={c.element} className="absolute right-1.5 top-1.5 h-5 w-5" />
                )}
                <span className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/80 to-transparent px-2 pb-1.5 pt-6 text-left">
                  <span className="block truncate text-[11px] font-semibold text-white drop-shadow">{c.name}</span>
                </span>
              </button>
            );
          })}
        </div>

        {/* full text list — collapsed, but in the server-rendered HTML for readers who want everything at once */}
        <details className="group mt-6 rounded-xl border border-forest-200 bg-white/60">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-forest-800">
            Full list: {goodCount} good, {fits.length - goodCount} not a good fit
            <svg className="h-4 w-4 shrink-0 text-[var(--muted)] transition-transform group-open:rotate-45" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </summary>
          <ul className="divide-y divide-[var(--line)] border-t border-[var(--line)]">
            {[...fits]
              .sort((a, b) => (a.rating === b.rating ? a.name.localeCompare(b.name) : a.rating === 'good' ? -1 : 1))
              .map((c) => (
                <li key={c.id} className="flex gap-3 px-4 py-2.5 text-sm">
                  <VerdictMark good={c.rating === 'good'} className="mt-0.5 h-5 w-5 shrink-0 text-[10px]" />
                  <p className="leading-relaxed text-[var(--muted)]">
                    <span className="font-semibold text-[var(--text)]">{c.name}</span>
                    {c.team && <span className="text-violet-700"> ({c.team} only)</span>} &mdash; {c.reason}
                  </p>
                </li>
              ))}
          </ul>
        </details>
      </div>
    </div>
  );
}
