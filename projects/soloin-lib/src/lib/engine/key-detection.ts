import { type Note } from './pitch-class';
import { buildScale } from './scales';
import type { ChordQuality } from './chords';
import { parseChordName, type ParsedChord } from './chord-parser';

export type Mode = 'major' | 'minor';

export interface Key {
  root: Note;
  mode: Mode;
}

export interface DiatonicChord {
  root: Note;
  quality: ChordQuality;
}

// Degree qualities cross-checked against circle-of-fifths' own buildChordRows.
const MAJOR_DEGREE_QUALITIES: ChordQuality[] = ['major', 'minor', 'minor', 'major', 'major', 'minor', 'dim'];
const MINOR_DEGREE_QUALITIES: ChordQuality[] = ['minor', 'dim', 'major', 'minor', 'minor', 'major', 'major'];

// The triad family each extended quality reduces to, for progression-matching.
const TRIAD_FAMILY: Record<ChordQuality, ChordQuality> = {
  major: 'major',
  maj7: 'major',
  dom7: 'major',
  sus2: 'major',
  sus4: 'major',
  aug: 'aug',
  minor: 'minor',
  m7: 'minor',
  dim: 'dim',
  dim7: 'dim',
  m7b5: 'dim',
};

export function diatonicChords(key: Key): DiatonicChord[] {
  const scale = buildScale(key.root, key.mode === 'major' ? 'ionian' : 'aeolian');
  const degreeQualities = key.mode === 'major' ? MAJOR_DEGREE_QUALITIES : MINOR_DEGREE_QUALITIES;
  return scale.map((root, i) => ({ root, quality: degreeQualities[i] }));
}

function familyKey(root: Note, quality: ChordQuality): string {
  return `${root}:${TRIAD_FAMILY[quality]}`;
}

// Whether a chord's root+quality (reduced to its triad family, same as key
// detection) matches one of the key's own diatonic chords — e.g. A7 is not
// diatonic to C major (C major's own vi is Am, not A7), even though A7 can
// still be the detected key for a progression that leans on it.
export function isDiatonic(chord: { root: Note; quality: ChordQuality }, key: Key): boolean {
  const target = familyKey(chord.root, chord.quality);
  return diatonicChords(key).some((c) => familyKey(c.root, c.quality) === target);
}

// Scans all 24 keys and scores the input against each key's generated diatonic
// chords, same idea as circle-of-fifths' internal (unexported) key-detection,
// independently implemented here against computed chords instead of a static table.
export function detectKey(chordNames: string[]): Key | null {
  const parsed = chordNames.map(parseChordName).filter((c): c is ParsedChord => c !== null);
  if (parsed.length === 0) return null;

  let best: Key | null = null;
  let bestScore = 0;

  for (let root = 0; root < 12; root++) {
    for (const mode of ['major', 'minor'] as const) {
      const families = new Set(diatonicChords({ root, mode }).map((c) => familyKey(c.root, c.quality)));
      const score = parsed.filter((c) => families.has(familyKey(c.root, c.quality))).length;
      if (score > bestScore) {
        bestScore = score;
        best = { root, mode };
      }
    }
  }

  return best;
}
