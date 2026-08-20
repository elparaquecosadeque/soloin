import { describe, expect, it } from 'vitest';
import { parseChordName, suggestChordName } from './chord-parser';

describe('parseChordName', () => {
  it('parses a plain minor chord', () => {
    expect(parseChordName('Am')).toEqual({ raw: 'Am', root: 9, quality: 'minor' });
  });

  it('parses sharps and flats', () => {
    expect(parseChordName('C#')).toEqual({ raw: 'C#', root: 1, quality: 'major' });
    expect(parseChordName('Bbm7')).toEqual({ raw: 'Bbm7', root: 10, quality: 'm7' });
  });

  it('parses extended qualities', () => {
    expect(parseChordName('Dmaj7')).toEqual({ raw: 'Dmaj7', root: 2, quality: 'maj7' });
    expect(parseChordName('G7')).toEqual({ raw: 'G7', root: 7, quality: 'dom7' });
    expect(parseChordName('Bm7b5')).toEqual({ raw: 'Bm7b5', root: 11, quality: 'm7b5' });
  });

  it('parses a bare "4" as sus4, e.g. tab-style "D4"', () => {
    expect(parseChordName('D4')).toEqual({ raw: 'D4', root: 2, quality: 'sus4' });
  });

  it('is case-insensitive on the root letter', () => {
    expect(parseChordName('am')).toEqual({ raw: 'am', root: 9, quality: 'minor' });
  });

  it('returns null for unparseable input', () => {
    expect(parseChordName('')).toBeNull();
    expect(parseChordName('H')).toBeNull();
    expect(parseChordName('Cmaj13')).toBeNull();
  });
});

describe('suggestChordName', () => {
  it('catches a one-letter-off typo of a known quality', () => {
    expect(suggestChordName('Dsu4')).toBe('Dsus4');
    expect(suggestChordName('Dmi')).toBe('Dmin');
  });

  it('does not guess for a genuinely unsupported quality', () => {
    // "6" chords aren't supported at all — every short alias key ('m', 'M',
    // '+'...) is one edit away, so guessing here would be confident-looking
    // but wrong (a 6 chord isn't "probably" a typo of minor).
    expect(suggestChordName('D6')).toBeNull();
  });

  it('does not guess when two candidates tie for closest', () => {
    expect(suggestChordName('Dsus9')).toBeNull();
  });

  it('returns null for an already-valid chord (nothing to suggest)', () => {
    expect(suggestChordName('Dsus4')).toBeNull();
  });

  it('returns null when the root itself is invalid', () => {
    expect(suggestChordName('H7')).toBeNull();
  });
});
