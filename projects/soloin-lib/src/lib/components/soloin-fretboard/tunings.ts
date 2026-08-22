import type { Note } from '@gblp/music-theory';

export type TuningName = 'standard' | 'dropD' | 'dadgad' | 'openG' | 'openD';

export interface Tuning {
  name: TuningName;
  // Open-string pitch classes, high string first — same order as STRINGS in
  // soloin-fretboard.ts (index 0 = high E ... index 5 = low/lowest string).
  strings: readonly [Note, Note, Note, Note, Note, Note];
}

// Comments show high-to-low order, matching the array itself (and the
// conventional low-to-high name each tuning is usually written with, e.g.
// standard "E A D G B E" is this same tuning read back to front).
export const TUNINGS: readonly Tuning[] = [
  { name: 'standard', strings: [4, 11, 7, 2, 9, 4] }, // E B G D A E
  { name: 'dropD', strings: [4, 11, 7, 2, 9, 2] }, // E B G D A D
  { name: 'dadgad', strings: [2, 9, 7, 2, 9, 2] }, // D A G D A D
  { name: 'openG', strings: [2, 11, 7, 2, 7, 2] }, // D B G D G D
  { name: 'openD', strings: [2, 9, 6, 2, 9, 2] }, // D A F# D A D
];

export function findTuning(name: TuningName): Tuning {
  return TUNINGS.find((t) => t.name === name) ?? TUNINGS[0];
}
