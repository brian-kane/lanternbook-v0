import { describe, expect, it } from 'vitest';
import inventedText from '../spells/fixtures/invented-spells.json?raw';
import spellsDoc from '../../docs/SPELLS.md?raw';
import { SCHOOLS, SPELL_LIMITS, parseSpellText, validateSpell } from './spell-spec';

type Json = Record<string, unknown>;
const invented = (): Json[] => JSON.parse(inventedText);
const spell = (): Json => invented()[0]!;

function without(value: Json, key: string): Json {
  const copy = { ...value };
  delete copy[key];
  return copy;
}

function errorsFor(value: unknown): string[] {
  const result = validateSpell(value);
  if (result.ok) throw new Error(`expected rejection, got ${JSON.stringify(result.spell)}`);
  return result.errors;
}

describe('validateSpell', () => {
  it('accepts every invented fixture spell unchanged', () => {
    for (const value of invented()) {
      expect(validateSpell(value)).toStrictEqual({ ok: true, spell: value });
    }
  });

  it('knows the eight schools', () => {
    expect(SCHOOLS).toStrictEqual([
      'abjuration',
      'conjuration',
      'divination',
      'enchantment',
      'evocation',
      'illusion',
      'necromancy',
      'transmutation',
    ]);
  });

  it.each([
    ['a non-object', 'spell', 'A spell spec must be a JSON object, like the example.'],
    [
      'a missing version',
      without(spell(), 'version'),
      'version is missing; this app reads version 1.',
    ],
    [
      'version 2',
      { ...spell(), version: 2 },
      'version 2 is not supported; this app reads version 1.',
    ],
    ['a widget kind', { ...spell(), kind: 'counter' }, 'kind must be "spell", not "counter".'],
    ['a missing kind', without(spell(), 'kind'), 'kind is missing; use "spell".'],
    ['a blank name', { ...spell(), name: ' ' }, 'name must not be empty.'],
    [
      'a name over the cap',
      { ...spell(), name: 'x'.repeat(SPELL_LIMITS.name + 1) },
      `name is longer than ${SPELL_LIMITS.name} characters.`,
    ],
    ['level 10', { ...spell(), level: 10 }, 'level must be a whole number from 0 (cantrip) to 9.'],
    ['level -1', { ...spell(), level: -1 }, 'level must be a whole number from 0 (cantrip) to 9.'],
    [
      'a fractional level',
      { ...spell(), level: 1.5 },
      'level must be a whole number from 0 (cantrip) to 9.',
    ],
    [
      'an unknown school',
      { ...spell(), school: 'chronomancy' },
      'school must be one of abjuration, conjuration, divination, enchantment, evocation, illusion, necromancy, transmutation.',
    ],
    [
      'a capitalised school',
      { ...spell(), school: 'Illusion' },
      'school must be one of abjuration, conjuration, divination, enchantment, evocation, illusion, necromancy, transmutation.',
    ],
    ['a text ritual', { ...spell(), ritual: 'no' }, 'ritual must be true or false.'],
    ['a missing casting time', without(spell(), 'castingTime'), 'castingTime must be text.'],
    ['a blank range', { ...spell(), range: '' }, 'range must not be empty.'],
    [
      'components over the cap',
      { ...spell(), components: 'x'.repeat(SPELL_LIMITS.components + 1) },
      `components is longer than ${SPELL_LIMITS.components} characters.`,
    ],
    ['a missing duration', without(spell(), 'duration'), 'duration must be text.'],
    [
      'text over the cap',
      { ...spell(), text: 'x'.repeat(SPELL_LIMITS.text + 1) },
      `text is longer than ${SPELL_LIMITS.text} characters.`,
    ],
    ['classes that are not a list', { ...spell(), classes: 'bard' }, 'classes must be a list.'],
    ['a blank class', { ...spell(), classes: [''] }, 'class 1 must not be empty.'],
    [
      'too many classes',
      { ...spell(), classes: Array.from({ length: SPELL_LIMITS.classes + 1 }, (_, i) => `c${i}`) },
      `classes must have at most ${SPELL_LIMITS.classes} entries.`,
    ],
    ['an extra field', { ...spell(), page: 114 }, 'unknown field "page".'],
  ])('rejects %s with a readable message', (_, value, message) => {
    expect(errorsFor(value)).toContain(message);
  });

  it('reports every problem at once', () => {
    expect(errorsFor({ ...spell(), level: 10, school: 'x', extra: 1 })).toHaveLength(3);
  });

  it('returns a copy, so later edits to the input cannot change the spell', () => {
    const input = spell();
    const result = validateSpell(input);
    if (!result.ok) throw new Error('expected acceptance');
    (input.classes as string[]).push('ranger');
    expect(result.spell).toStrictEqual(spell());
  });
});

describe('parseSpellText', () => {
  it('parses and validates pasted text', () => {
    expect(parseSpellText(JSON.stringify(spell()))).toStrictEqual({ ok: true, spell: spell() });
  });

  it.each([
    ['empty text', ' ', 'Paste a spell spec first.'],
    [
      'broken JSON',
      '{"kind": "spell",',
      'That is not valid JSON. Check for missing quotes, commas or brackets.',
    ],
    [
      'oversized text',
      `"${'x'.repeat(SPELL_LIMITS.specText)}"`,
      `That spell spec is too long (over ${SPELL_LIMITS.specText} characters).`,
    ],
  ])('rejects %s', (_, text, message) => {
    expect(parseSpellText(text)).toStrictEqual({ ok: false, errors: [message] });
  });
});

describe('docs/SPELLS.md', () => {
  it('shows the first invented fixture spell, so the example can be pasted as-is', () => {
    const blocks = [...spellsDoc.matchAll(/```json\n([\s\S]*?)```/g)].map((m) => JSON.parse(m[1]!));
    expect(blocks).toStrictEqual([spell()]);
  });
});
