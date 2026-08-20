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
  '4': 'sus4',
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

function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

// Suggestion candidates are limited to the longer alias keys (length >= 3):
// short ones ('m', 'M', '+', '7'...) are one edit away from almost any typo,
// so fuzzy-matching against them produces confident-looking but musically
// wrong guesses (e.g. a "6" chord isn't "probably" a typo of "m"). A
// suggestion is only offered when exactly one candidate wins, within 2 edits
// — a tie, or nothing close enough, means "don't guess" rather than "guess anyway".
const SUGGESTION_CANDIDATES = Object.keys(SUFFIX_ALIASES).filter((k) => k.length >= 3);
const MAX_SUGGESTION_DISTANCE = 2;

export function suggestChordName(raw: string): string | null {
  const trimmed = raw.trim();
  const match = CHORD_PATTERN.exec(trimmed);
  if (!match) return null;

  const [, letter, accidental, suffix] = match;
  const root = parseNoteName(letter.toUpperCase() + accidental);
  if (root === null) return null;
  if (SUFFIX_ALIASES[suffix] !== undefined || SUFFIX_ALIASES[suffix.toLowerCase()] !== undefined) return null;

  const suffixLower = suffix.toLowerCase();
  let bestDist = Infinity;
  let winners: string[] = [];
  for (const candidate of SUGGESTION_CANDIDATES) {
    const dist = levenshtein(suffixLower, candidate);
    if (dist < bestDist) {
      bestDist = dist;
      winners = [candidate];
    } else if (dist === bestDist) {
      winners.push(candidate);
    }
  }
  if (winners.length === 0 || bestDist > MAX_SUGGESTION_DISTANCE) return null;

  // Multiple spellings can tie on edit distance while meaning the same thing
  // ("sus" and "sus4" both resolve to sus4) — that's not real ambiguity, so
  // only refuse to guess when the tied candidates resolve to different
  // qualities. Among same-quality ties, prefer the longest spelling: it's the
  // more explicit, more recognizable form to show back to the user.
  const distinctQualities = new Set(winners.map((w) => SUFFIX_ALIASES[w]));
  if (distinctQualities.size !== 1) return null;
  const best = winners.reduce((a, b) => (b.length > a.length ? b : a));

  return `${letter.toUpperCase()}${accidental}${best}`;
}
