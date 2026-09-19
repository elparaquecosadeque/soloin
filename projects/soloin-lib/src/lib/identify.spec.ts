import { describe, expect, it } from 'vitest';
import { IDENTIFY_MIN_NOTES, identifyScales } from './identify';

const SCALES = [
  'ionian',
  'dorian',
  'phrygian',
  'lydian',
  'mixolydian',
  'aeolian',
  'locrian',
  'majorPentatonic',
  'minorPentatonic',
  'blues',
] as const;

const C = 0;
const D = 2;
const E = 4;
const G = 7;
const A = 9;

const hasMatch = (groups: ReturnType<typeof identifyScales>, root: number, scale: string): boolean =>
  groups.some((g) => g.matches.some((m) => m.root === root && m.scale === scale));

describe('identifyScales', () => {
  it('returns nothing below the minimum of distinct notes', () => {
    expect(identifyScales([C, E], SCALES)).toEqual([]);
    expect(IDENTIFY_MIN_NOTES).toBe(3);
  });

  it('counts distinct notes, so repeated octaves of one note do not add up', () => {
    expect(identifyScales([C, C, E, E, C], SCALES)).toEqual([]);
  });

  it('groups C, E, G into the C major / A minor family and the C major pentatonic', () => {
    const groups = identifyScales([C, E, G], SCALES);

    const diatonic = groups.find((g) => hasMatch([g], C, 'ionian'));
    expect(diatonic?.notes.length).toBe(7);
    expect(hasMatch([diatonic!], D, 'dorian')).toBe(true);
    expect(hasMatch([diatonic!], A, 'aeolian')).toBe(true);

    const pentatonic = groups.find((g) => hasMatch([g], C, 'majorPentatonic'));
    expect(pentatonic?.notes.length).toBe(5);
    expect(hasMatch([pentatonic!], A, 'minorPentatonic')).toBe(true);
  });

  it('is strict: a note outside a scale excludes it', () => {
    // F# is not in C major, so nothing rooted in the C-major family may match.
    const groups = identifyScales([C, E, G, 6], SCALES);
    expect(hasMatch(groups, C, 'ionian')).toBe(false);
    expect(hasMatch(groups, D, 'dorian')).toBe(false);
  });

  it('puts the fewest-note groups first', () => {
    const sizes = identifyScales([C, E, G], SCALES).map((g) => g.notes.length);
    expect(sizes).toEqual([...sizes].sort((a, b) => a - b));
  });

  it('gives every pair that shares a note set to the same group', () => {
    const groups = identifyScales([C, E, G], SCALES);
    const ids = groups.map((g) => g.notes.join(','));
    expect(new Set(ids).size).toBe(ids.length);
  });
});
