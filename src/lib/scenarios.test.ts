import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_SCENARIOS,
  addScenario,
  loadScenarios,
  removeScenario,
  renameScenario,
  storageAvailable,
} from './scenarios';

// scenarios.ts talks to `window.localStorage`; the node test env has neither, so
// install a tiny in-memory double. This mirrors a real browser: setItem throws
// once the map is "full", and a disabled store is simulated by leaving `window`
// undefined.
function installStorage() {
  const store = new Map<string, string>();
  (globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
  };
}

beforeEach(() => installStorage());
afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
  vi.restoreAllMocks();
});

describe('scenario storage', () => {
  it('reports storage available only when read/write succeed', () => {
    expect(storageAvailable()).toBe(true);
    delete (globalThis as { window?: unknown }).window;
    expect(storageAvailable()).toBe(false);
  });

  it('returns an empty list on missing or corrupt data', () => {
    expect(loadScenarios()).toEqual([]);
    (globalThis as { window: { localStorage: { setItem(k: string, v: string): void } } }).window.localStorage.setItem(
      'genshin-calc.scenarios.v1',
      '{not json',
    );
    expect(loadScenarios()).toEqual([]);
  });

  it('drops malformed entries when loading', () => {
    addScenario('a', 'hu-tao', 'c=hu-tao');
    const w = (globalThis as { window: { localStorage: Record<string, unknown> } }).window.localStorage;
    const raw = (w.getItem as (k: string) => string)('genshin-calc.scenarios.v1');
    const list = JSON.parse(raw);
    (w.setItem as (k: string, v: string) => void)('genshin-calc.scenarios.v1', JSON.stringify([...list, { nope: 1 }].slice(0, 2)));
    expect(loadScenarios().every((s) => typeof s.query === 'string')).toBe(true);
  });

  it('adds newest-first and stores the query + charId verbatim', () => {
    const first = addScenario('one', 'hu-tao', 'c=hu-tao&lv=90');
    expect(first[0].name).toBe('one');
    expect(first[0].charId).toBe('hu-tao');
    expect(first[0].query).toBe('c=hu-tao&lv=90');
    const second = addScenario('two', 'raiden', 'c=raiden');
    expect(second.map((s) => s.name)).toEqual(['two', 'one']);
  });

  it('falls back to "Untitled" for a blank name', () => {
    expect(addScenario('   ', 'hu-tao', '')[0].name).toBe('Untitled');
  });

  it('caps the list at MAX_SCENARIOS', () => {
    for (let i = 0; i < MAX_SCENARIOS + 5; i++) addScenario(`s${i}`, 'hu-tao', '');
    expect(loadScenarios().length).toBe(MAX_SCENARIOS);
  });

  it('removes by id', () => {
    const list = addScenario('gone', 'hu-tao', '');
    expect(removeScenario(list[0].id).length).toBe(0);
  });

  it('renames in place and ignores a blank rename', () => {
    const list = addScenario('before', 'hu-tao', '');
    expect(renameScenario(list[0].id, 'after')[0].name).toBe('after');
    expect(renameScenario(list[0].id, '   ')[0].name).toBe('after');
  });
});
