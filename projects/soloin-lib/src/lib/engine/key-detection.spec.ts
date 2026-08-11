import { describe, expect, it } from 'vitest';
import { detectKey, diatonicChords } from './key-detection';

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
