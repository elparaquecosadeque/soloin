import { describe, expect, it } from 'vitest';
import { detectKey, diatonicChords, isDiatonic } from './key-detection';

describe('diatonicChords', () => {
  it('builds the C major diatonic triads', () => {
    expect(diatonicChords({ root: 0, mode: 'major' })).toEqual([
      { root: 0, quality: 'major' },
      { root: 2, quality: 'minor' },
      { root: 4, quality: 'minor' },
      { root: 5, quality: 'major' },
      { root: 7, quality: 'major' },
      { root: 9, quality: 'minor' },
      { root: 11, quality: 'dim' },
    ]);
  });

  it('builds the A minor diatonic triads', () => {
    expect(diatonicChords({ root: 9, mode: 'minor' })).toEqual([
      { root: 9, quality: 'minor' },
      { root: 11, quality: 'dim' },
      { root: 0, quality: 'major' },
      { root: 2, quality: 'minor' },
      { root: 4, quality: 'minor' },
      { root: 5, quality: 'major' },
      { root: 7, quality: 'major' },
    ]);
  });
});

describe('detectKey', () => {
  it('detects C major from a vi-IV-I-V-shaped progression', () => {
    expect(detectKey(['Am', 'F', 'C', 'G'])).toEqual({ root: 0, mode: 'major' });
  });

  it('returns null for empty or fully unparseable input', () => {
    expect(detectKey([])).toBeNull();
    expect(detectKey(['H', 'X'])).toBeNull();
  });
});

describe('isDiatonic', () => {
  const cMajor = { root: 0, mode: 'major' } as const;

  it('is true for chords that belong to the key', () => {
    expect(isDiatonic({ root: 9, quality: 'minor' }, cMajor)).toBe(true); // Am, the vi
    expect(isDiatonic({ root: 5, quality: 'major' }, cMajor)).toBe(true); // F, the IV
    expect(isDiatonic({ root: 9, quality: 'm7' }, cMajor)).toBe(true); // Am7 reduces to the same minor family
  });

  it('is false for a chord whose quality does not match the key, even at the same root', () => {
    // A7 (dominant/major family) is not C major's vi — that's Am (minor family).
    expect(isDiatonic({ root: 9, quality: 'dom7' }, cMajor)).toBe(false);
  });

  it('is false for a root that is not in the key at all', () => {
    expect(isDiatonic({ root: 1, quality: 'major' }, cMajor)).toBe(false); // C#, not in C major
  });
});
