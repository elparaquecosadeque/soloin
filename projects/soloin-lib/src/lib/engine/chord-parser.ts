import { type Note, parseNoteName } from './pitch-class';
import type { ChordQuality } from './chords';

export interface ParsedChord {
  raw: string;
  root: Note;
  quality: ChordQuality;
}

// Mirrors chord-finder's regex-split + alias-table pattern, independent
// implementation, pitch-class output instead of a chords-db key lookup.
const SUFFIX_ALIASES: Record<string, ChordQuality> = {
  '': 'major',
  M: 'major',
  maj: 'major',
  major: 'major',
  m: 'minor',
  min: 'minor',
  '-': 'minor',
  minor: 'minor',
  dim: 'dim',
  diminished: 'dim',
  aug: 'aug',
  '+': 'aug',
  augmented: 'aug',
  maj7: 'maj7',
  m7: 'm7',
  min7: 'm7',
  '7': 'dom7',
  dom7: 'dom7',
  m7b5: 'm7b5',
  dim7: 'dim7',
  sus2: 'sus2',
  sus4: 'sus4',
  sus: 'sus4',
};

const CHORD_PATTERN = /^([A-Ga-g])([#b]?)(.*)$/;

export function parseChordName(raw: string): ParsedChord | null {
  const trimmed = raw.trim();
  const match = CHORD_PATTERN.exec(trimmed);
  if (!match) return null;

  const [, letter, accidental, suffix] = match;
  const root = parseNoteName(letter.toUpperCase() + accidental);
  if (root === null) return null;

  const quality = SUFFIX_ALIASES[suffix] ?? SUFFIX_ALIASES[suffix.toLowerCase()];
  if (quality === undefined) return null;

  return { raw: trimmed, root, quality };
}
