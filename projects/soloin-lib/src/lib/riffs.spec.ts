import { RIFFS, riffsFor } from './riffs';

describe('RIFFS data', () => {
  it('keeps every riff inside its box, in time order, with playable techniques', () => {
    for (const riff of RIFFS) {
      let end = 0;
      riff.notes.forEach((note, i) => {
        const where = `${riff.id} note ${i}`;
        expect(note.fretOffset, where).toBeGreaterThanOrEqual(0);
        expect(note.fretOffset, where).toBeLessThanOrEqual(4);
        expect(note.beat, where).toBeGreaterThanOrEqual(end); // no overlaps
        end = note.beat + note.duration;
        if (note.technique) {
          const prev = riff.notes[i - 1];
          expect(prev?.stringIndex, where).toBe(note.stringIndex);
          if (note.technique === 'hammer') expect(note.fretOffset, where).toBeGreaterThan(prev.fretOffset);
          if (note.technique === 'pull') expect(note.fretOffset, where).toBeLessThan(prev.fretOffset);
          if (note.technique === 'slide') expect(note.fretOffset, where).not.toBe(prev.fretOffset);
        }
      });
      expect(end, riff.id).toBeLessThanOrEqual(riff.totalBeats);
    }
  });

  it('offers minor pentatonic licks (but not its box runs) under the blues scale', () => {
    const ids = riffsFor('blues', 'E').map((r) => r.id);
    expect(ids).toContain('blues-E-walk');
    expect(ids).toContain('minorPentatonic-E-climb');
    expect(ids).not.toContain('minorPentatonic-E-asc');
  });
});
