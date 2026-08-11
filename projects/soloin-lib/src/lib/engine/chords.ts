import { type Note, mod12 } from './pitch-class';

export type ChordFormula = readonly number[]; // semitone offsets from the root

export const CHORD_FORMULAS = {
  major: [0, 4, 7],
  minor: [0, 3, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
  dom7: [0, 4, 7, 10],
  m7b5: [0, 3, 6, 10],
  dim7: [0, 3, 6, 9],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
} as const satisfies Record<string, ChordFormula>;

export type ChordQuality = keyof typeof CHORD_FORMULAS;

export function buildChordTones(root: Note, quality: ChordQuality | ChordFormula): Note[] {
  const offsets = typeof quality === 'string' ? CHORD_FORMULAS[quality] : quality;
  return offsets.map((offset) => mod12(root + offset));
}
