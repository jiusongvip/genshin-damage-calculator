import { describe, expect, it } from 'vitest';
import {
  clampDisplayValue,
  toDisplayValue,
  toStoredValue,
} from './primitives';

/**
 * The pure commit math behind `NumberField`: what a typed string becomes when
 * the field commits. The component itself defers this call to blur/Enter, so
 * the half-typed states never reach it.
 */

describe('toDisplayValue / toStoredValue', () => {
  it('scales percent fields by 100 both ways', () => {
    expect(toDisplayValue(0.123, '%')).toBe(12.3);
    expect(toStoredValue(12.3, '%')).toBeCloseTo(0.123, 10);
  });

  it('leaves other units 1:1', () => {
    expect(toDisplayValue(90, '×')).toBe(90);
    expect(toDisplayValue(90, 's')).toBe(90);
    expect(toDisplayValue(90)).toBe(90);
  });

  it('kills float noise so stored fractions display clean', () => {
    // 0.07 * 100 is 7.000000000000001 in binary floats.
    expect(toDisplayValue(0.07, '%')).toBe(7);
    expect(toStoredValue(30, '%')).toBeCloseTo(0.3, 10);
  });
});

describe('clampDisplayValue', () => {
  it('clamps to the range at commit, not while typing', () => {
    expect(clampDisplayValue('120', 1, 90)).toBe(90);
    expect(clampDisplayValue('0', 1, 90)).toBe(1);
  });

  it('returns null for unparsable text so the field reverts', () => {
    expect(clampDisplayValue('', 1, 90)).toBeNull();
    expect(clampDisplayValue('abc', 1, 90)).toBeNull();
  });

  it('truncates toward zero for integer fields before clamping', () => {
    expect(clampDisplayValue('9.7', 1, 90, true)).toBe(9);
    expect(clampDisplayValue('0.4', 1, 90, true)).toBe(1);
    // Without the flag the decimals survive — Pct fields rely on that.
    expect(clampDisplayValue('12.34', 0, 2000)).toBe(12.34);
  });

  it('accepts open-ended ranges', () => {
    expect(clampDisplayValue('-50', Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY)).toBe(-50);
  });
});
