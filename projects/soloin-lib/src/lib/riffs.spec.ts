import { decodeRiff, encodeRiff, normalize, sanitizeRiff, toDoc, toRiff } from './riff-edit';
import { FACTORY_RIFFS as RIFFS, riffBoxes, riffsFor } from './riffs';

describe('RIFFS data', () => {
  it('keeps every riff inside its box, in time order, with playable techniques', () => {
    for (const riff of RIFFS) {
      let end = 0;
      riff.notes.forEach((note, i) => {
        const where = `${riff.id} note ${i}`;
        expect(note.fretOffset, where).toBeGreaterThanOrEqual(0);
        expect(note.fretOffset, where).toBeLessThanOrEqual(riffBoxes(riff.shape, riff.span).at(-1)!.end);
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

  it('lays neighbouring boxes out up the neck and connects them with a riff', () => {
    expect(riffBoxes('E', 3).map((b) => [b.shape, b.start])).toEqual([
      ['E', 0],
      ['D', 2],
      ['C', 4],
    ]);
    const connect = riffsFor('minorPentatonic', 'E').find((r) => r.id.endsWith('-connect'))!;
    expect(connect.span).toBe(2);
    expect(Math.max(...connect.notes.map((n) => n.fretOffset))).toBeGreaterThan(4);
    expect(riffsFor('blues', 'E').filter((r) => r.id.endsWith('-connect')).length).toBe(1);
  });
});

describe('riff editing', () => {
  const scales = ['minorPentatonic', 'blues'] as const;
  const lick = riffsFor('blues', 'E').find((r) => r.id === 'blues-E-walk')!;

  it('round-trips a riff through the editor model and the share code', () => {
    const again = toRiff(lick, toDoc(lick, 'en'));
    expect(again.notes).toEqual(lick.notes);
    expect(decodeRiff(encodeRiff({ ...again, name: { en: 'Señal ñ', es: 'Señal ñ' } }), scales)?.notes).toEqual(lick.notes);
  });

  it('drops techniques an edit made unplayable', () => {
    const doc = toDoc(lick, 'en');
    const hammered = doc.events.findIndex((e) => e.technique === 'hammer');
    const events = doc.events.map((e, i) => (i === hammered ? { ...e, stringIndex: (e.stringIndex + 1) % 6 } : e));
    const result = normalize(events);
    expect(result.dropped).toBeGreaterThan(0);
    expect(result.events[hammered].technique).toBeUndefined();
  });

  it('rejects malformed riffs instead of trusting them', () => {
    expect(decodeRiff('not a code', scales)).toBeNull();
    expect(sanitizeRiff({ ...lick, notes: [{ ...lick.notes[0], fretOffset: 99 }] }, scales)).toBeNull();
    expect(sanitizeRiff({ ...lick, scale: 'nope' }, scales)).toBeNull();
  });
});
