import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ElementIcon } from '../ElementIcon';
import { GLYPH } from './constants';
import { clamp } from './draft';
import type { ElementType } from '../../lib/damage';

/**
 * The controls the six multiplier zones are built from: numeric inputs, the
 * icon dropdown, and the numbered `Zone` shell that anchors each step of the
 * damage chain. Nothing here knows about damage maths — they take a value and
 * an onChange.
 */

/** Percent input: shows 12.3 for 0.123 and writes back the fraction. */
export function Pct({
  value,
  onChange,
  label,
  icon,
  step = 1,
  min = 0,
  max = 2000,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
  icon?: ReactNode;
  step?: number;
  min?: number;
  max?: number;
}) {
  return (
    <label className="block">
      <span className="flex items-center gap-1 text-xs font-medium text-[var(--muted)]">
        {icon}
        {label}
      </span>
      <div className="mt-1 flex items-center gap-1">
        <input
          type="number"
          inputMode="decimal"
          step={step}
          min={min}
          max={max}
          value={Number((value * 100).toFixed(2))}
          onChange={(e) => {
            const raw = parseFloat(e.target.value);
            onChange(clamp(Number.isFinite(raw) ? raw : 0, min, max) / 100);
          }}
          className="w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-right text-[var(--text)]"
        />
        <span className="text-xs text-[var(--muted)]">%</span>
      </div>
    </label>
  );
}

export function Num({
  value,
  onChange,
  label,
  icon,
  step = 1,
  min = 0,
  max = 1_000_000,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
  icon?: ReactNode;
  step?: number;
  min?: number;
  max?: number;
}) {
  return (
    <label className="block">
      <span className="flex items-center gap-1 text-xs font-medium text-[var(--muted)]">
        {icon}
        {label}
      </span>
      <input
        type="number"
        inputMode="decimal"
        step={step}
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const raw = parseFloat(e.target.value);
          onChange(clamp(Number.isFinite(raw) ? raw : 0, min, max));
        }}
        className="mt-1 w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-right text-[var(--text)]"
      />
    </label>
  );
}

export function Glyph({ name, className = 'h-4 w-4' }: { name: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={GLYPH[name] ?? ''} />
    </svg>
  );
}

export function ElementPair({ els }: { els: ElementType[] }) {
  return (
    <>
      {els.map((e) => (
        <ElementIcon key={e} el={e} className="h-5 w-5" />
      ))}
    </>
  );
}

/**
 * Weapon icon by id. Weapons whose art has not landed in `public/images` yet
 * (new genshin-db entries between icon runs) fall back to a neutral glyph so
 * the dropdown never shows a broken image.
 */
export function WeaponIcon({ id, className = 'h-6 w-6' }: { id: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <Glyph name="atk" className={`${className} text-[var(--muted)]`} />;
  return (
    <img
      src={`/images/weapons/${id}.webp`}
      alt=""
      width="48"
      height="48"
      className={`${className} object-contain`}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}

export interface IconOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

/**
 * Dropdown where every option (and the closed control) shows its icon, so the
 * user can pick by icon + colour instead of reading text. Keyboard-operable:
 * Tab reaches the trigger and the options, Enter/Space picks, Escape closes.
 */
export function IconSelect<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: IconOption<T>[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const current = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className={`relative ${className ?? 'mt-1'}`} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-[10px] border border-[var(--line)] bg-[var(--surface)] px-2 py-2 text-left text-sm text-[var(--text)]"
      >
        {current?.icon && <span className="flex shrink-0 items-center gap-0.5">{current.icon}</span>}
        <span className="min-w-0 flex-1 truncate">{current?.label ?? '—'}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="shrink-0 text-[var(--muted)]" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open && (
        // z-[60] must clear the sticky site header (z-50), otherwise the open
        // list scrolls underneath it and the last options become unclickable.
        <ul role="listbox" className="absolute z-[60] mt-1 max-h-72 w-full overflow-y-auto rounded-[10px] border border-[var(--line)] bg-[var(--surface)] p-1 shadow-xl">
          {options.map((o) => (
            <li key={o.value}>
              <button
                type="button"
                role="option"
                aria-selected={o.value === value}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors ${
                  o.value === value ? 'bg-forest-600/12 text-forest-700' : 'text-[var(--text)] hover:bg-[var(--soft)]'
                }`}
              >
                {o.icon && <span className="flex shrink-0 items-center gap-0.5">{o.icon}</span>}
                <span className="min-w-0 flex-1 truncate">{o.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * One glyph per multiplier zone, so the six-zone chain is scannable by shape
 * instead of by reading six labels. Keyed by the zone id used for anchors.
 */
const ZONE_ICONS: Record<string, ReactNode> = {
  base: <path d="M12 20V10M18 20V4M6 20v-4" />,
  bonus: (
    <>
      <path d="M19 5L5 19" />
      <circle cx="6.5" cy="6.5" r="2.5" />
      <circle cx="17.5" cy="17.5" r="2.5" />
    </>
  ),
  crit: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4" />
    </>
  ),
  reaction: (
    <>
      <circle cx="9.5" cy="12" r="5" />
      <circle cx="14.5" cy="12" r="5" />
    </>
  ),
  def: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  res: (
    <>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M4 4l16 16" />
    </>
  ),
};

export function Zone({
  id,
  index,
  title,
  value,
  changed,
  onReset,
  onEnter,
  children,
}: {
  id: string;
  index: number;
  title: string;
  value: string;
  changed?: boolean;
  onReset?: () => void;
  onEnter: (id: string) => void;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      ref={(el) => {
        if (el) zoneRefs.set(id, el);
      }}
      onMouseEnter={() => onEnter(id)}
      className="panel scroll-mt-24 p-2"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="flex items-center gap-2 text-base font-semibold text-[var(--text)]">
          {ZONE_ICONS[id] && (
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-forest-500/12 text-forest-600">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                {ZONE_ICONS[id]}
              </svg>
            </span>
          )}
          <span className="tnum text-sm text-forest-500/70">{String(index).padStart(2, '0')}</span>
          {title}
          {changed && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-forest-600">
              <span className="h-1.5 w-1.5 rounded-full bg-forest-500" />edited
            </span>
          )}
        </h3>
        <div className="flex items-baseline gap-2">
          <span className="tnum text-lg font-semibold text-forest-600">{value}</span>
          {changed && onReset && (
            <button type="button" onClick={onReset} className="text-[11px] text-[var(--muted)] underline underline-offset-2 hover:text-forest-600">
              reset
            </button>
          )}
        </div>
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export const zoneRefs = new Map<string, HTMLElement>();
