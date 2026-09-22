import { describe, expect, it } from 'vitest';
import { isHomePath, sectionHref } from './section-links';

describe('sectionHref — homepage section anchors from shared chrome', () => {
  it('keeps the bare hash on the homepage so the click does not reload', () => {
    expect(sectionHref('#guides', '/')).toBe('#guides');
  });

  it('makes the hash root-absolute on every subpage', () => {
    // The regression: a bare "#guides" on /guides/builds/ resolves to
    // /guides/builds/#guides, which matches nothing, so the nav link was dead.
    expect(sectionHref('#guides', '/guides/builds/')).toBe('/#guides');
    expect(sectionHref('#calculator', '/guides/builds/')).toBe('/#calculator');
    expect(sectionHref('#presets', '/about/')).toBe('/#presets');
    expect(sectionHref('#faq', '/team-building/')).toBe('/#faq');
    expect(sectionHref('#guide', '/404.html')).toBe('/#guide');
  });

  it('never produces a double slash', () => {
    for (const p of ['/', '/about/', '/guides/builds/', '/404.html']) {
      expect(sectionHref('#faq', p)).not.toContain('//');
    }
  });
});

describe('isHomePath', () => {
  it('accepts the homepage in each form the build can hand us', () => {
    for (const p of ['/', '', '/index.html']) expect(isHomePath(p)).toBe(true);
  });

  it('rejects subpages, including ones that merely start with the root', () => {
    for (const p of ['/about/', '/guides/', '/guides/builds/', '/404.html', '/team-building/']) {
      expect(isHomePath(p)).toBe(false);
    }
  });

  it('ignores query and hash suffixes', () => {
    expect(isHomePath('/?sand=hp%25#calculator')).toBe(true);
    expect(isHomePath('/about/?x=1')).toBe(false);
  });
});
