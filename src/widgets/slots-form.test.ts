import { describe, expect, it } from 'vitest';
import { SLOT_LEVELS, checkSlots, type SlotsForm } from './slots-form';
import { validateSpec } from './spec';

const form = (maxes: Record<number, string>, reset = 'long'): SlotsForm => ({
  maxes: SLOT_LEVELS.map((level) => maxes[level] ?? ''),
  reset,
});
const slot = (level: number, max: number, reset = 'long') => ({
  version: 1,
  kind: 'counter',
  name: `Level ${level} slots`,
  value: max,
  max,
  reset,
});

describe('checkSlots', () => {
  it('has rows for spell levels 1 to 9', () => {
    expect(SLOT_LEVELS).toStrictEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('builds one full counter per filled row, skipping blank rows, each one the validator accepts', () => {
    const result = checkSlots(form({ 1: '4', 2: ' 3 ', 5: '1' }), []);
    expect(result.specs).toStrictEqual([slot(1, 4), slot(2, 3), slot(5, 1)]);
    for (const spec of result.specs) expect(validateSpec(spec)).toStrictEqual({ ok: true, spec });
    expect(result.rowErrors).toStrictEqual({});
    expect(result.skipped).toStrictEqual({});
    expect(result.formErrors).toStrictEqual([]);
  });

  it('applies the Refills choice to every row', () => {
    expect(checkSlots(form({ 1: '2', 2: '2' }, 'short'), []).specs).toStrictEqual([
      slot(1, 2, 'short'),
      slot(2, 2, 'short'),
    ]);
  });

  it.each(['0', 'four', '2.5', '-1', '1000'])(
    'puts a plain message next to a row with max %j and adds nothing at all',
    (max) => {
      const result = checkSlots(form({ 1: '4', 3: max }), []);
      expect(result.rowErrors).toStrictEqual({ 3: ['Max must be a whole number from 1 to 999.'] });
      expect(result.specs).toStrictEqual([]);
    },
  );

  it('asks for at least one row', () => {
    const result = checkSlots(form({}), []);
    expect(result.formErrors).toStrictEqual(['Fill in a max for at least one spell level.']);
    expect(result.specs).toStrictEqual([]);
  });

  it('accepts only a short or long rest for Refills', () => {
    const result = checkSlots(form({ 1: '2' }, 'none'), []);
    expect(result.formErrors).toStrictEqual([
      'Choose whether the slots refill on a short or a long rest.',
    ]);
    expect(result.specs).toStrictEqual([]);
  });

  it('skips a level whose counter already exists, reporting it, and adds the others', () => {
    const result = checkSlots(form({ 1: '4', 2: '2' }), ['Level 1 slots', 'Hit points']);
    expect(result.specs).toStrictEqual([slot(2, 2)]);
    expect(result.skipped).toStrictEqual({
      1: 'You already have a counter named “Level 1 slots”, so nothing was added for level 1.',
    });
  });
});
