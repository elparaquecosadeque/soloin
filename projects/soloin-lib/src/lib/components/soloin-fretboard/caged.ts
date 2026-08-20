import { type Note, mod12 } from '../../engine';

export type CagedShape = 'C' | 'A' | 'G' | 'E' | 'D';

export const CAGED_SHAPES: CagedShape[] = ['C', 'A', 'G', 'E', 'D'];

// Pitch class of each open string, high to low — must match STRINGS in
// soloin-fretboard.ts (index 0 = high E ... index 5 = low E).
const STRING_OPEN_PC = [4, 11, 7, 2, 9, 4] as const;

// Each shape's root position in its own OPEN-position fingering: which
// string carries the root, and at which fret. E/A/D shapes root at the nut
// on their name string (open E/A/D chords). C and G don't — their standard
// open chords root 3 frets up the low string they'd barre (open C's root is
// A-string fret 3; open G's root is low-E-string fret 3) — everything else
// about the shape (which scale/chord tones fall where) follows from moving
// that same fingering pattern until the root lands on the target pitch class.
const SHAPE_ANCHOR: Record<CagedShape, { stringIndex: number; openFret: number }> = {
  E: { stringIndex: 5, openFret: 0 },
  A: { stringIndex: 4, openFret: 0 },
  D: { stringIndex: 3, openFret: 0 },
  G: { stringIndex: 5, openFret: 3 },
  C: { stringIndex: 4, openFret: 3 },
};

const BOX_WIDTH = 4; // frets spanned by a box, in addition to its starting fret

export interface FretRange {
  start: number;
  end: number;
}

// Where a given shape's box sits for a scale/chord rooted at `root`, derived
// from first principles (not memorized fret tables): find where `root` falls
// on the shape's anchor string, then back off by that shape's own
// open-position root fret to get the barre position the whole fingering
// would need. Verified against the standard C-A-G-E-D box order and against
// a real reference diagram (F major, E-shape box starts at fret 1).
export function cagedBoxRange(shape: CagedShape, root: Note): FretRange {
  const { stringIndex, openFret } = SHAPE_ANCHOR[shape];
  const rootFretOnString = mod12(root - STRING_OPEN_PC[stringIndex]);
  let start = rootFretOnString - openFret;
  if (start < 0) start += 12;
  return { start, end: start + BOX_WIDTH };
}
