import { describe, expect, it } from 'vitest';
import { buildScale, SCALE_DEGREE_LABELS, SCALES } from './scales';

describe('buildScale', () => {
  it('builds C ionian (major)', () => {
    expect(buildScale(0, 'ionian')).toEqual([0, 2, 4, 5, 7, 9, 11]);
  });

  it('builds D dorian', () => {
    expect(buildScale(2, 'dorian')).toEqual([2, 4, 5, 7, 9, 11, 0]);
  });

  it('builds A aeolian (natural minor)', () => {
    expect(buildScale(9, 'aeolian')).toEqual([9, 11, 0, 2, 4, 5, 7]);
  });

  it('builds B locrian', () => {
    expect(buildScale(11, 'locrian')).toEqual([11, 0, 2, 4, 5, 7, 9]);
  });

  it('builds major and minor pentatonic', () => {
    expect(buildScale(0, 'majorPentatonic')).toEqual([0, 2, 4, 7, 9]);
    expect(buildScale(9, 'minorPentatonic')).toEqual([9, 0, 2, 4, 7]);
  });

  it('builds the blues scale', () => {
    expect(buildScale(9, 'blues')).toEqual([9, 0, 2, 3, 4, 7]);
  });

  it('accepts a raw formula in place of a scale name', () => {
    expect(buildScale(0, [2, 2, 1, 2, 2, 2, 1])).toEqual(buildScale(0, 'ionian'));
  });
});

describe('SCALES', () => {
  it('has every formula sum to 12 semitones', () => {
    for (const steps of Object.values(SCALES)) {
      expect(steps.reduce((a, b) => a + b, 0)).toBe(12);
    }
  });
});

describe('SCALE_DEGREE_LABELS', () => {
  it('has one label per note for every scale, always starting on R', () => {
    for (const [name, steps] of Object.entries(SCALES)) {
      const labels = SCALE_DEGREE_LABELS[name as keyof typeof SCALES];
      expect(labels.length).toBe(steps.length);
      expect(labels[0]).toBe('R');
    }
  });
});
