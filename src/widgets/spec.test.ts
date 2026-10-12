import { describe, expect, it } from 'vitest';
import counterText from './fixtures/counter.json?raw';
import checklistText from './fixtures/checklist.json?raw';
import examplesText from '../../docs/EXAMPLES.md?raw';
import { LIMITS, parseSpecText, validateSpec, validateWidget } from './spec';

type Json = Record<string, unknown>;
const counter = (): Json => JSON.parse(counterText);
const checklist = (): Json => JSON.parse(checklistText);

function without(value: Json, key: string): Json {
  const copy = { ...value };
  delete copy[key];
  return copy;
}

function errorsFor(value: unknown): string[] {
  const result = validateSpec(value);
  if (result.ok) throw new Error(`expected rejection, got ${JSON.stringify(result.spec)}`);
  return result.errors;
}

describe('validateSpec', () => {
  it('accepts both example specs unchanged', () => {
    expect(validateSpec(counter())).toStrictEqual({ ok: true, spec: counter() });
    expect(validateSpec(checklist())).toStrictEqual({ ok: true, spec: checklist() });
  });

  it.each([
    ['a non-object', [], 'A widget spec must be a JSON object, like the examples.'],
    [
      'a missing version',
      without(counter(), 'version'),
      'version is missing; this app reads version 1.',
    ],
    [
      'a newer version',
      { ...counter(), version: 2 },
      'version 2 is not supported; this app reads version 1.',
    ],
    [
      'a text version',
      { ...counter(), version: '1' },
      'version "1" is not supported; this app reads version 1.',
    ],
    [
      'a missing kind',
      without(counter(), 'kind'),
      'kind is missing; use "counter" or "checklist".',
    ],
    [
      'an unknown kind',
      { ...counter(), kind: 'timer' },
      'kind must be "counter" or "checklist", not "timer".',
    ],
    ['a missing name', without(counter(), 'name'), 'name must be text.'],
    ['a blank name', { ...counter(), name: '   ' }, 'name must not be empty.'],
    [
      'a name over the cap',
      { ...counter(), name: 'x'.repeat(LIMITS.name + 1) },
      'name is longer than 60 characters.',
    ],
    ['a max of 0', { ...counter(), max: 0 }, 'max must be a whole number from 1 to 999.'],
    ['a fractional max', { ...counter(), max: 2.5 }, 'max must be a whole number from 1 to 999.'],
    [
      'a value above max',
      { ...counter(), value: 4 },
      'value must be a whole number from 0 to max (3).',
    ],
    [
      'a negative value',
      { ...counter(), value: -1 },
      'value must be a whole number from 0 to max (3).',
    ],
    [
      'an unknown reset',
      { ...counter(), reset: 'dawn' },
      'reset must be "short", "long" or "none".',
    ],
    ['an unknown counter field', { ...counter(), colour: 'red' }, 'unknown field "colour".'],
    ['an id in a pasted spec', { ...counter(), id: 4 }, 'unknown field "id".'],
    ['items that are not a list', { ...checklist(), items: 'rope' }, 'items must be a list.'],
    [
      'an empty checklist',
      { ...checklist(), items: [] },
      'items must have between 1 and 50 entries.',
    ],
    [
      'too many items',
      { ...checklist(), items: Array.from({ length: 51 }, () => ({ text: 'a', done: false })) },
      'items must have between 1 and 50 entries.',
    ],
    [
      'an item that is not an object',
      { ...checklist(), items: ['rope'] },
      'item 1 must be an object with text and done.',
    ],
    [
      'an item with blank text',
      { ...checklist(), items: [{ text: '', done: false }] },
      'item 1 text must not be empty.',
    ],
    [
      'item text over the cap',
      { ...checklist(), items: [{ text: 'x'.repeat(LIMITS.itemText + 1), done: false }] },
      'item 1 text is longer than 120 characters.',
    ],
    [
      'an item with a text done',
      { ...checklist(), items: [{ text: 'a', done: 'yes' }] },
      'item 1 done must be true or false.',
    ],
    [
      'an item with an unknown field',
      { ...checklist(), items: [{ text: 'a', done: false, due: 'today' }] },
      'item 1 has an unknown field "due".',
    ],
    ['counter fields on a checklist', { ...checklist(), max: 3 }, 'unknown field "max".'],
  ])('rejects %s with a readable message', (_, value, message) => {
    expect(errorsFor(value)).toContain(message);
  });

  it('accepts strings exactly at the caps', () => {
    const name = 'x'.repeat(LIMITS.name);
    const text = 'y'.repeat(LIMITS.itemText);
    expect(validateSpec({ ...counter(), name }).ok).toBe(true);
    expect(validateSpec({ ...checklist(), items: [{ text, done: false }] }).ok).toBe(true);
  });

  it('reports every problem at once', () => {
    expect(errorsFor({ ...counter(), name: '', reset: 'dawn', extra: 1 })).toHaveLength(3);
  });

  it('returns a copy, so later edits to the input cannot change the widget', () => {
    const input = checklist();
    const result = validateSpec(input);
    if (!result.ok) throw new Error('expected acceptance');
    (input.items as Json[])[0]!.done = true;
    expect(result.spec).toStrictEqual(checklist());
  });
});

describe('parseSpecText', () => {
  it('parses and validates pasted text', () => {
    expect(parseSpecText(counterText)).toStrictEqual({ ok: true, spec: counter() });
  });

  it.each([
    ['empty text', '  \n', 'Paste a widget spec first.'],
    [
      'broken JSON',
      '{"kind": "counter",',
      'That is not valid JSON. Check for missing quotes, commas or brackets.',
    ],
    [
      'oversized text',
      `"${'x'.repeat(LIMITS.specText)}"`,
      'That spec is too long (over 5000 characters).',
    ],
  ])('rejects %s', (_, text, message) => {
    expect(parseSpecText(text)).toStrictEqual({ ok: false, errors: [message] });
  });
});

describe('validateWidget', () => {
  it('accepts a stored widget with a positive whole id', () => {
    expect(validateWidget({ ...counter(), id: 7 })).toStrictEqual({
      ok: true,
      widget: { ...counter(), id: 7 },
    });
  });

  it.each([undefined, 0, -1, 1.5, '1'])('rejects id %s', (id) => {
    const result = validateWidget({ ...counter(), id });
    expect(result.ok).toBe(false);
  });
});

describe('docs/EXAMPLES.md', () => {
  it('shows exactly the two fixture specs, so the docs can be pasted as-is', () => {
    const blocks = [...examplesText.matchAll(/```json\n([\s\S]*?)```/g)].map((m) =>
      JSON.parse(m[1]!),
    );
    expect(blocks).toStrictEqual([counter(), checklist()]);
  });
});
