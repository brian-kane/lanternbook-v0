import { describe, expect, it } from 'vitest';
import hpText from './fixtures/hp-counter.json?raw';
import { counterSpecFrom, fieldErrors, type CounterForm } from './counter-form';
import { validateSpec } from './spec';

const form = (over: Partial<CounterForm> = {}): CounterForm => ({
  name: 'Level 1 slots',
  max: '4',
  reset: 'long',
  hp: false,
  start: '',
  ...over,
});

describe('counterSpecFrom', () => {
  it('builds a counter spec the validator accepts, starting full when no value is given', () => {
    const spec = counterSpecFrom(form());
    expect(spec).toStrictEqual({
      version: 1,
      kind: 'counter',
      name: 'Level 1 slots',
      value: 4,
      max: 4,
      reset: 'long',
    });
    expect(validateSpec(spec)).toStrictEqual({ ok: true, spec });
  });

  it('builds the same spec as the pasted hit points example when HP is ticked', () => {
    const spec = counterSpecFrom(
      form({ name: ' Hit points ', max: '27', reset: 'long', hp: true, start: '27' }),
    );
    expect(spec).toStrictEqual(JSON.parse(hpText));
    expect(validateSpec(spec).ok).toBe(true);
  });

  it('uses the starting value when one is given', () => {
    expect(counterSpecFrom(form({ start: '2' }))).toMatchObject({ value: 2, max: 4 });
  });

  it.each([
    ['a blank name', form({ name: '  ' }), { name: ['Name must not be empty.'] }],
    ['a max of 0', form({ max: '0' }), { max: ['Max must be a whole number from 1 to 999.'] }],
    ['a text max', form({ max: 'four' }), { max: ['Max must be a whole number from 1 to 999.'] }],
    [
      'a fractional max',
      form({ max: '2.5' }),
      { max: ['Max must be a whole number from 1 to 999.'] },
    ],
    ['a blank max', form({ max: '' }), { max: ['Max must be a whole number from 1 to 999.'] }],
    [
      'a starting value above max',
      form({ start: '5' }),
      { value: ['Starting value must be a whole number from 0 to max (4).'] },
    ],
    [
      'a negative starting value',
      form({ start: '-1' }),
      { value: ['Starting value must be a whole number from 0 to max (4).'] },
    ],
    ['no reset rule', form({ reset: '' }), { reset: ['Reset must be "short", "long" or "none".'] }],
  ])('puts the message for %s next to its field', (_, input, expected) => {
    const result = validateSpec(counterSpecFrom(input));
    if (result.ok) throw new Error('expected rejection');
    expect(fieldErrors(result.errors)).toStrictEqual({
      name: [],
      max: [],
      reset: [],
      value: [],
      other: [],
      ...expected,
    });
  });
});
