import { describe, expect, it } from 'vitest';
import { RELEASED_CHARACTERS } from '../data/characters';
import { buildCharacterPageData, hasPublishableData } from './character-pages';

const publishable = RELEASED_CHARACTERS.filter(hasPublishableData);
const pages = publishable.map((c) => ({ c, data: buildCharacterPageData(c) }));

describe('character pages', () => {
  it('excludes the no-talent pair but keeps the Traveler', () => {
    const ids = publishable.map((c) => c.id);
    expect(ids).not.toContain('manekin');
    expect(ids).not.toContain('manekina');
    expect(ids).toContain('aether');
    expect(ids).toContain('lumine');
  });

  it('publishes enough pages to reach the ~130 target', () => {
    expect(publishable.length).toBeGreaterThanOrEqual(115);
  });

  // Dynamic /characters/[id].astro has no literal description for the
  // meta-descriptions guard to read, so the same ≤160 rule is enforced here
  // against every generated description.
  it('keeps every generated description inside the render width', () => {
    for (const { c, data } of pages) {
      expect(data.description.length, `${c.id}: ${data.description}`).toBeLessThanOrEqual(160);
      expect(data.title.length).toBeGreaterThan(0);
    }
  });

  it('renders at least one real damage number per page (no empty shells)', () => {
    for (const { c, data } of pages) {
      const damageRows = data.groups.flatMap((g) => g.rows).filter((r) => r.text === undefined);
      expect(damageRows.length, `${c.id} has no damage rows`).toBeGreaterThan(0);
      expect(damageRows.some((r) => r.expected > 0), `${c.id} has no non-zero damage`).toBe(true);
    }
  });

  it('lists the character equipped with its preset weapon as a recommendation', () => {
    for (const { c, data } of pages) {
      expect(data.weapons.some((w) => w.equipped && w.weapon.id === c.bestWeapon), `${c.id} preset weapon`).toBe(true);
    }
  });
});
