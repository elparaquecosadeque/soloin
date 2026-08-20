import { type Note, mod12 } from './pitch-class';

export type ScaleFormula = readonly number[]; // semitone steps between consecutive degrees, sums to 12

const MAJOR_STEPS: ScaleFormula = [2, 2, 1, 2, 2, 2, 1];

function rotateSteps(steps: ScaleFormula, offset: number): ScaleFormula {
  return [...steps.slice(offset), ...steps.slice(0, offset)];
}

const MODE_NAMES = ['ionian', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'aeolian', 'locrian'] as const;

// The 7 major-scale modes are rotations of one formula, not 7 transcribed arrays.
const MODE_SCALES = Object.fromEntries(
  MODE_NAMES.map((name, i) => [name, rotateSteps(MAJOR_STEPS, i)]),
) as Record<(typeof MODE_NAMES)[number], ScaleFormula>;

export const SCALES = {
  ...MODE_SCALES,
  majorPentatonic: [2, 2, 3, 2, 3],
  minorPentatonic: [3, 2, 2, 3, 2],
  blues: [3, 2, 1, 1, 3, 2],
} as const satisfies Record<string, ScaleFormula>;

export type ScaleName = keyof typeof SCALES;

export function buildScale(root: Note, scale: ScaleName | ScaleFormula): Note[] {
  const steps = typeof scale === 'string' ? SCALES[scale] : scale;
  const notes: Note[] = [mod12(root)];
  for (const step of steps.slice(0, -1)) {
    notes.push(mod12(notes[notes.length - 1] + step));
  }
  return notes;
}

// Standard interval-degree labels, parallel to SCALES (same order, same
// length) — the conventional spelling relative to the major scale for each
// mode (e.g. Lydian's raised 4th is "#4", not the enharmonic "b5" that
// Locrian's flat 5th would use for the same pitch class).
export const SCALE_DEGREE_LABELS: Record<ScaleName, readonly string[]> = {
  ionian: ['R', '2', '3', '4', '5', '6', '7'],
  dorian: ['R', '2', 'b3', '4', '5', '6', 'b7'],
  phrygian: ['R', 'b2', 'b3', '4', '5', 'b6', 'b7'],
  lydian: ['R', '2', '3', '#4', '5', '6', '7'],
  mixolydian: ['R', '2', '3', '4', '5', '6', 'b7'],
  aeolian: ['R', '2', 'b3', '4', '5', 'b6', 'b7'],
  locrian: ['R', 'b2', 'b3', '4', 'b5', 'b6', 'b7'],
  majorPentatonic: ['R', '2', '3', '5', '6'],
  minorPentatonic: ['R', 'b3', '4', '5', 'b7'],
  blues: ['R', 'b3', '4', 'b5', '5', 'b7'],
};
