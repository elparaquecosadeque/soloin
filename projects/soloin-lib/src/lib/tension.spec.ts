import { buildScale, type Note } from '@gblp/music-theory';
import { tensionLevels } from './tension';

describe('tensionLevels', () => {
  const levels = (scale: Parameters<typeof buildScale>[1]) => tensionLevels(buildScale(0 as Note, scale), 0 as Note);

  it('ranks the major scale: 1 rests, 3 and 5 are stable, 2 and 6 pass, 4 and 7 pull', () => {
    expect(levels('ionian')).toEqual([0, 2, 1, 3, 1, 2, 3]);
  });

  it('finds no tension in the major pentatonic and only the blue note in blues', () => {
    expect(levels('majorPentatonic')).toEqual([0, 2, 1, 1, 2]);
    expect(levels('blues')).toEqual([0, 1, 2, 3, 1, 2]);
  });
});
