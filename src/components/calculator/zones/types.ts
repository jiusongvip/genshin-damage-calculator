/**
 * The shell props every multiplier zone passes straight through to `<Zone>`.
 * Kept in one place so the six zone files do not each re-declare it.
 */
export interface ZoneChrome {
  /** Formatted headline for the zone, e.g. "×1.466" or "12,345". */
  value: string;
  /** True when the zone is off its default — shows the "edited" mark and reset. */
  changed: boolean;
  onReset: () => void;
  /** Highlights this zone in the contribution chain on hover. */
  onEnter: (id: string) => void;
}
