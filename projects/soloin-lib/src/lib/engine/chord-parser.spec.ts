import { describe, expect, it } from 'vitest';
import { parseChordName } from './chord-parser';

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

  it('is case-insensitive on the root letter', () => {
    expect(parseChordName('am')).toEqual({ raw: 'am', root: 9, quality: 'minor' });
  });

  it('returns null for unparseable input', () => {
    expect(parseChordName('')).toBeNull();
    expect(parseChordName('H')).toBeNull();
    expect(parseChordName('Cmaj13')).toBeNull();
  });
});
