import { describe, expect, it } from 'vitest';
import { mod12, noteName, parseNoteName } from './pitch-class';

describe('parseNoteName', () => {
  it('parses naturals, sharps, flats, and double-named enharmonics', () => {
    expect(parseNoteName('C')).toBe(0);
    expect(parseNoteName('C#')).toBe(1);
    expect(parseNoteName('Db')).toBe(1);
    expect(parseNoteName('E#')).toBe(5);
    expect(parseNoteName('Fb')).toBe(4);
    expect(parseNoteName('B#')).toBe(0);
    expect(parseNoteName('Cb')).toBe(11);
  });

  it('is case-insensitive', () => {
    expect(parseNoteName('a')).toBe(9);
    expect(parseNoteName('db')).toBe(1);
  });

  it('returns null for unrecognized input', () => {
    expect(parseNoteName('H')).toBeNull();
    expect(parseNoteName('')).toBeNull();
  });
});

describe('noteName', () => {
  it('renders sharp and flat spellings', () => {
    expect(noteName(1)).toBe('C#');
    expect(noteName(1, true)).toBe('Db');
  });
});

describe('mod12', () => {
  it('wraps into the 0-11 range', () => {
    expect(mod12(-1)).toBe(11);
    expect(mod12(12)).toBe(0);
    expect(mod12(13)).toBe(1);
  });
});
