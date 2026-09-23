// ============================================================================
// Saved scenarios (localStorage).
//
// A scenario is just the Task 0 URL query string plus a label, the character it
// was saved for, and a timestamp — so "load" is `draftFromQuery` and "compare"
// is `draftToGroups`, with no bespoke format to keep in sync. Everything that
// touches storage is wrapped in try/catch: when localStorage is unavailable
// (private mode, disabled cookies, quota) the caller hides the feature rather
// than throwing on every render.
// ============================================================================

export interface Scenario {
  id: string;
  name: string;
  /** epoch ms */
  savedAt: number;
  /** the character whose defaults `query` is relative to — needed because
   *  draftToQuery omits `c` when the draft matches its own defaults. */
  charId: string;
  /** the Task 0 query string, without a leading `?` */
  query: string;
}

const KEY = 'genshin-calc.scenarios.v1';
export const MAX_SCENARIOS = 20;

/** Probe once whether we can actually read/write storage. */
export function storageAvailable(): boolean {
  try {
    const probe = '__gc_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

function isScenario(x: unknown): x is Scenario {
  if (!x || typeof x !== 'object') return false;
  const s = x as Record<string, unknown>;
  return (
    typeof s.id === 'string' &&
    typeof s.name === 'string' &&
    typeof s.savedAt === 'number' &&
    typeof s.charId === 'string' &&
    typeof s.query === 'string'
  );
}

/** Read the saved list, newest first. Any corruption yields an empty list. */
export function loadScenarios(): Scenario[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isScenario).sort((a, b) => b.savedAt - a.savedAt);
  } catch {
    return [];
  }
}

function persist(list: Scenario[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX_SCENARIOS)));
  } catch {
    /* quota or disabled storage: keep the in-memory list for this session */
  }
}

function makeId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Prepend a new scenario and return the updated list (capped at MAX). */
export function addScenario(name: string, charId: string, query: string): Scenario[] {
  const entry: Scenario = {
    id: makeId(),
    name: name.trim() || 'Untitled',
    savedAt: Date.now(),
    charId,
    query,
  };
  const next = [entry, ...loadScenarios()].slice(0, MAX_SCENARIOS);
  persist(next);
  return next;
}

/** Remove one by id and return the updated list. */
export function removeScenario(id: string): Scenario[] {
  const next = loadScenarios().filter((s) => s.id !== id);
  persist(next);
  return next;
}

/** Rename a saved scenario in place; returns the updated list. */
export function renameScenario(id: string, name: string): Scenario[] {
  const trimmed = name.trim();
  if (!trimmed) return loadScenarios();
  const next = loadScenarios().map((s) => (s.id === id ? { ...s, name: trimmed } : s));
  persist(next);
  return next;
}
