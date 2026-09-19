import type { ScaleName } from '@gblp/music-theory';
import type { TuningName } from './components/soloin-fretboard/tunings';

// What a host app (the-chords) persists for Soloin. Every field is optional and
// omitted when it equals the default, so an untouched Soloin serializes to nothing.
export interface SoloinSessionState {
  marks?: number[]; // user-marked fret positions, string * POSITIONS_PER_STRING + fret
  tuning?: TuningName;
  key?: number; // index into SoloinComponent.allKeys (root * 2 + (minor ? 1 : 0))
  scale?: ScaleName;
}

export const STRING_COUNT = 6;
export const POSITIONS_PER_STRING = 13; // open string + frets 1..12

// "string:fret" keys (fretPositionKey) <-> compact numbers.
export function marksToNumbers(marks: Iterable<string>): number[] {
  const numbers = new Set<number>();
  for (const key of marks) {
    const [s, f] = key.split(':').map(Number);
    if (Number.isInteger(s) && Number.isInteger(f) && s >= 0 && s < STRING_COUNT && f >= 0 && f < POSITIONS_PER_STRING) {
      numbers.add(s * POSITIONS_PER_STRING + f);
    }
  }
  return [...numbers].sort((a, b) => a - b);
}

// Anything that isn't an integer inside the fretboard is dropped rather than trusted.
export function numbersToMarks(numbers: unknown): Set<string> {
  const marks = new Set<string>();
  if (!Array.isArray(numbers)) return marks;
  for (const n of numbers) {
    if (Number.isInteger(n) && n >= 0 && n < STRING_COUNT * POSITIONS_PER_STRING) {
      marks.add(`${Math.floor(n / POSITIONS_PER_STRING)}:${n % POSITIONS_PER_STRING}`);
    }
  }
  return marks;
}
