import { type Note, mod12 } from '@gblp/music-theory';

// How settled each scale note sounds against the tonic:
//   0 rest    — the tonic itself
//   1 stable  — the rest of the tonic triad (its third and fifth)
//   2 passing — moves on easily, pulls nowhere in particular
//   3 tense   — sits a semitone from a triad tone and wants to resolve into it
//               (4 and 7 in major, b6 in minor, #4 in Lydian, the blue note...)
// One rule instead of a table per scale: tendency tones are exactly the
// semitone neighbours of the tonic triad.
export type TensionLevel = 0 | 1 | 2 | 3;

export function tensionLevels(notes: readonly Note[], root: Note): TensionLevel[] {
  const intervals = notes.map((n) => mod12(n - root) as number);
  const pick = (...candidates: number[]) => candidates.find((c) => intervals.includes(c));
  const triad = [0, pick(4, 3), pick(7, 6, 8)].filter((i): i is number => i !== undefined);
  return intervals.map((i) => {
    if (i === 0) return 0;
    if (triad.includes(i)) return 1;
    return triad.some((t) => mod12(i - t) === 1 || mod12(t - i) === 1) ? 3 : 2;
  });
}
