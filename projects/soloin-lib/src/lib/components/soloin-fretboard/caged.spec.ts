import { describe, expect, it } from 'vitest';
import { CAGED_SHAPES, type CagedShape, cagedBoxRange } from './caged';

describe('cagedBoxRange', () => {
  it('places the 5 boxes for C major starting at the classic C-A-G-E-D positions', () => {
    expect(cagedBoxRange('C', 0)).toEqual({ start: 0, end: 4 });
    expect(cagedBoxRange('A', 0)).toEqual({ start: 3, end: 7 });
    expect(cagedBoxRange('G', 0)).toEqual({ start: 5, end: 9 });
    expect(cagedBoxRange('E', 0)).toEqual({ start: 8, end: 12 });
    expect(cagedBoxRange('D', 0)).toEqual({ start: 10, end: 14 });
  });

  it('matches a real reference diagram: F major, E-shape box starts at fret 1', () => {
    expect(cagedBoxRange('E', 5)).toEqual({ start: 1, end: 5 });
  });

  it('wraps a shape whose open-position instance falls before the nut', () => {
    // G-shape's root sits 3 frets into its own fingering, so for some roots
    // the naive position is negative and must wrap to the next octave.
    expect(cagedBoxRange('G', 5)).toEqual({ start: 10, end: 14 });
  });

  it('always produces the 5 boxes in C-A-G-E-D cyclic order, for every root', () => {
    for (let root = 0; root < 12; root++) {
      const sorted = [...CAGED_SHAPES].sort((a, b) => cagedBoxRange(a, root).start - cagedBoxRange(b, root).start);
      const startIndex = sorted.indexOf('C' as CagedShape);
      const rotated = [...sorted.slice(startIndex), ...sorted.slice(0, startIndex)];
      expect(rotated).toEqual(['C', 'A', 'G', 'E', 'D']);
    }
  });
});
