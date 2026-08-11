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
