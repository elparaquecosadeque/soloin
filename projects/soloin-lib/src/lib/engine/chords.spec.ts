import { describe, expect, it } from 'vitest';
import { buildChordTones, CHORD_FORMULAS } from './chords';

describe('buildChordTones', () => {
  it('builds Dm7 tones', () => {
    expect(buildChordTones(2, 'm7')).toEqual([2, 5, 9, 0]);
  });

  it('builds triads for every quality', () => {
    expect(buildChordTones(0, 'major')).toEqual([0, 4, 7]);
    expect(buildChordTones(0, 'minor')).toEqual([0, 3, 7]);
    expect(buildChordTones(0, 'dim')).toEqual([0, 3, 6]);
    expect(buildChordTones(0, 'aug')).toEqual([0, 4, 8]);
  });

  it('builds seventh chords', () => {
    expect(buildChordTones(0, 'maj7')).toEqual([0, 4, 7, 11]);
    expect(buildChordTones(0, 'dom7')).toEqual([0, 4, 7, 10]);
    expect(buildChordTones(0, 'm7b5')).toEqual([0, 3, 6, 10]);
    expect(buildChordTones(0, 'dim7')).toEqual([0, 3, 6, 9]);
  });

  it('wraps tones past pitch class 11', () => {
    expect(buildChordTones(9, 'maj7')).toEqual([9, 1, 4, 8]);
  });
});

describe('CHORD_FORMULAS', () => {
  it('covers the declared v1 chord qualities', () => {
    expect(Object.keys(CHORD_FORMULAS).sort()).toEqual(
      ['aug', 'dim', 'dim7', 'dom7', 'm7', 'm7b5', 'maj7', 'major', 'minor', 'sus2', 'sus4'].sort(),
    );
  });
});
