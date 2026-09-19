import { describe, expect, it } from 'vitest';
import { marksToNumbers, numbersToMarks } from './session-state';

describe('session-state marks', () => {
  it('round-trips positions through compact numbers', () => {
    const marks = new Set(['0:0', '1:1', '5:12', '2:7']);
    const numbers = marksToNumbers(marks);
    expect(numbers).toEqual([0, 14, 33, 77]);
    expect(numbersToMarks(numbers)).toEqual(marks);
  });

  it('drops positions outside the fretboard when encoding', () => {
    expect(marksToNumbers(['6:0', '0:13', '-1:2', 'x:y', '3:3'])).toEqual([42]);
  });

  it('drops anything invalid when decoding', () => {
    expect(numbersToMarks([0, 78, -1, 1.5, '3', null, 14])).toEqual(new Set(['0:0', '1:1']));
    expect(numbersToMarks('nope')).toEqual(new Set());
    expect(numbersToMarks(undefined)).toEqual(new Set());
  });
});
