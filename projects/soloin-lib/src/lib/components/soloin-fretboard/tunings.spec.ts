import { describe, expect, it } from 'vitest';
import { noteName } from '@gblp/music-theory';
import { findTuning, TUNINGS } from './tunings';

// Each tuning's array is high-to-low; reversing it should read back as the
// tuning's conventional low-to-high name.
describe('TUNINGS', () => {
  it('every tuning has 6 strings', () => {
    for (const t of TUNINGS) expect(t.strings.length).toBe(6);
  });

  it('spells each tuning correctly low-to-high, in conventional notation', () => {
    const lowToHigh = (name: (typeof TUNINGS)[number]['name']) =>
      [...findTuning(name).strings].reverse().map((pc) => noteName(pc)).join(' ');

    expect(lowToHigh('standard')).toBe('E A D G B E');
    expect(lowToHigh('dropD')).toBe('D A D G B E');
    expect(lowToHigh('dadgad')).toBe('D A D G A D');
    expect(lowToHigh('openG')).toBe('D G D G B D');
    expect(lowToHigh('openD')).toBe('D A D F# A D');
  });

  it('findTuning falls back to standard for an unknown name', () => {
    expect(findTuning('nonexistent' as never)).toBe(TUNINGS[0]);
  });
});
