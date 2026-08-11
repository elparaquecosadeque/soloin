export type Note = number; // pitch class 0-11, 0 = C

const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'] as const;

// Mirrors chord-finder's dbRootMap enharmonic coverage (naturals/sharps/flats/double-names),
// mapped to pitch classes instead of a chords-db key string.
const NOTE_NAME_TO_PC: Record<string, Note> = {
  C: 0,
  'B#': 0,
  'C#': 1,
  Db: 1,
  D: 2,
  'D#': 3,
  Eb: 3,
  E: 4,
  Fb: 4,
  F: 5,
  'E#': 5,
  'F#': 6,
  Gb: 6,
  G: 7,
  'G#': 8,
  Ab: 8,
  A: 9,
  'A#': 10,
  Bb: 10,
  B: 11,
  Cb: 11,
};

export function mod12(n: number): Note {
  return ((n % 12) + 12) % 12;
}

export function parseNoteName(raw: string): Note | null {
  const cleaned = raw.trim().replace('♯', '#').replace('♭', 'b');
  if (cleaned.length === 0) return null;
  const letter = cleaned[0].toUpperCase();
  const accidental = cleaned.slice(1).toLowerCase();
  const key = accidental === 'b' ? `${letter}b` : accidental === '#' ? `${letter}#` : letter;
  return key in NOTE_NAME_TO_PC ? NOTE_NAME_TO_PC[key] : null;
}

// ponytail: one fixed sharp/flat spelling table per pitch class, not true
// diatonic per-degree spelling (e.g. always "D#", never "Eb" mid-scale even
// where theory would call for it). Matches bass-notes' existing simplification.
// Upgrade path: a key-signature-aware speller if per-degree accuracy is ever needed.
export function noteName(pc: Note, preferFlats = false): string {
  const index = mod12(pc);
  return preferFlats ? FLAT_NAMES[index] : SHARP_NAMES[index];
}
