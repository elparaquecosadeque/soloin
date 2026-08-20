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

// Standard interval-degree labels, parallel to CHORD_FORMULAS (same order,
// same length) — the theoretically conventional spelling per quality (e.g.
// aug's raised 5th is "#5", not the enharmonic "b6").
export const CHORD_DEGREE_LABELS: Record<ChordQuality, readonly string[]> = {
  major: ['R', '3', '5'],
  minor: ['R', 'b3', '5'],
  dim: ['R', 'b3', 'b5'],
  aug: ['R', '3', '#5'],
  maj7: ['R', '3', '5', '7'],
  m7: ['R', 'b3', '5', 'b7'],
  dom7: ['R', '3', '5', 'b7'],
  m7b5: ['R', 'b3', 'b5', 'b7'],
  dim7: ['R', 'b3', 'b5', 'bb7'],
  sus2: ['R', '2', '5'],
  sus4: ['R', '4', '5'],
};
