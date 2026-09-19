import { buildScale, type Note, type ScaleName } from '@gblp/music-theory';

export const IDENTIFY_MIN_NOTES = 3;

export interface IdentifyMatch {
  root: Note;
  scale: ScaleName;
}

// Every root/scale pair that shares the exact same set of pitch classes — e.g.
// C Ionian, D Dorian and A Aeolian are one group, since notes alone can't tell
// them apart.
export interface IdentifyGroup {
  notes: Note[]; // the group's pitch classes, ascending
  matches: IdentifyMatch[];
}

// Strict fit: a scale is a candidate only when it contains EVERY selected note.
// Fewer than IDENTIFY_MIN_NOTES distinct notes is too little to say anything, so
// it returns nothing. Groups come back most-specific first (fewest notes), ties
// in the order they were found (root ascending, then `scales` order).
export function identifyScales(selectedNotes: Iterable<Note>, scales: readonly ScaleName[]): IdentifyGroup[] {
  const selected = [...new Set(selectedNotes)];
  if (selected.length < IDENTIFY_MIN_NOTES) return [];

  const groups = new Map<string, IdentifyGroup>();
  for (let root = 0; root < 12; root++) {
    for (const scale of scales) {
      const notes = buildScale(root, scale);
      if (!selected.every((n) => notes.includes(n))) continue;
      const sorted = [...notes].sort((a, b) => a - b);
      const id = sorted.join(',');
      const group = groups.get(id) ?? { notes: sorted, matches: [] };
      group.matches.push({ root, scale });
      groups.set(id, group);
    }
  }

  return [...groups.values()].sort((a, b) => a.notes.length - b.notes.length);
}
