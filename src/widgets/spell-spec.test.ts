import { describe, expect, it } from 'vitest';
import inventedText from '../spells/fixtures/invented-spells.json?raw';
import spellsDoc from '../../docs/SPELLS.md?raw';
import { SCHOOLS, SPELL_LIMITS, parseClassList, parseSpellText, validateSpell } from './spell-spec';

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

describe('validateSpell tables', () => {
  const table = () => ({
    caption: 'Moth count',
    header: ['d4', 'Moths'],
    rows: [
      ['1-2', 'A few'],
      ['3-4', 'Very many'],
    ],
  });
  const withTables = (tables: unknown) => ({ ...spell(), tables });

  it('accepts a spell with tables, with or without a caption, and copies them', () => {
    const tables = [table(), { header: table().header, rows: table().rows }];
    const input = withTables(tables);
    const result = validateSpell(input);
    expect(result).toStrictEqual({ ok: true, spell: input });
    if (!result.ok) return;
    tables[0]!.rows[0]![0] = 'changed';
    expect(result.spell.tables![0]!.rows[0]![0]).toBe('1-2');
  });

  it('leaves a spell without tables without the field', () => {
    const result = validateSpell(spell());
    expect(result.ok && 'tables' in result.spell).toBe(false);
  });

  it.each([
    ['tables that are not a list', table(), 'tables must be a list.'],
    ['an empty tables list', [], `tables must have between 1 and ${SPELL_LIMITS.tables} entries.`],
    [
      'too many tables',
      Array.from({ length: SPELL_LIMITS.tables + 1 }, table),
      `tables must have between 1 and ${SPELL_LIMITS.tables} entries.`,
    ],
    ['a table that is not an object', ['d4'], 'table 1 must be an object with a header and rows.'],
    [
      'an extra field in a table',
      [{ ...table(), notes: 'x' }],
      'table 1 has an unknown field "notes".',
    ],
    ['a blank caption', [{ ...table(), caption: ' ' }], 'table 1 caption must not be empty.'],
    [
      'an overlong caption',
      [{ ...table(), caption: 'x'.repeat(SPELL_LIMITS.tableCaption + 1) }],
      `table 1 caption is longer than ${SPELL_LIMITS.tableCaption} characters.`,
    ],
    [
      'a header that is not a list',
      [{ ...table(), header: 'd4' }],
      'table 1 header must be a list.',
    ],
    [
      'too many columns',
      [
        {
          header: Array.from({ length: SPELL_LIMITS.tableColumns + 1 }, (_, i) => `c${i}`),
          rows: [],
        },
      ],
      `table 1 header must have between 1 and ${SPELL_LIMITS.tableColumns} cells.`,
    ],
    [
      'a blank header cell',
      [{ ...table(), header: ['d4', ''] }],
      'table 1 header cell 2 must not be empty.',
    ],
    ['rows that are not a list', [{ ...table(), rows: 'x' }], 'table 1 rows must be a list.'],
    [
      'no rows',
      [{ ...table(), rows: [] }],
      `table 1 must have between 1 and ${SPELL_LIMITS.tableRows} rows.`,
    ],
    [
      'too many rows',
      [{ ...table(), rows: Array.from({ length: SPELL_LIMITS.tableRows + 1 }, () => ['1', 'a']) }],
      `table 1 must have between 1 and ${SPELL_LIMITS.tableRows} rows.`,
    ],
    [
      'a row that is not a list',
      [{ ...table(), rows: ['1 A few'] }],
      'table 1 row 1 must be a list of cells.',
    ],
    [
      'a row with the wrong cell count',
      [
        {
          ...table(),
          rows: [
            ['1-2', 'A few'],
            ['3-4', 'Very', 'many'],
          ],
        },
      ],
      'table 1 row 2 has 3 cells; the header has 2.',
    ],
    [
      'an overlong cell',
      [{ ...table(), rows: [['1-2', 'x'.repeat(SPELL_LIMITS.tableCell + 1)]] }],
      `table 1 row 1 cell 2 is longer than ${SPELL_LIMITS.tableCell} characters.`,
    ],
    [
      'a blank cell',
      [{ ...table(), rows: [['1-2', ' ']] }],
      'table 1 row 1 cell 2 must not be empty.',
    ],
  ])('rejects %s with a readable message', (_, tables, message) => {
    expect(errorsFor(withTables(tables))).toContain(message);
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

describe('parseClassList', () => {
  it('takes one spell name per line, trimmed, skipping blanks and repeats', () => {
    expect(
      parseClassList(' Artificer ', 'Lantern Hum\n\n  Pebble Count \r\nLantern Hum\n'),
    ).toStrictEqual({
      ok: true,
      className: 'Artificer',
      names: ['Lantern Hum', 'Pebble Count'],
    });
  });

  it.each([
    ['a blank class name', ' ', 'Lantern Hum', 'class name must not be empty.'],
    ['no spell names', 'Artificer', ' \n ', 'Add at least one spell name, one per line.'],
    [
      'a name over the cap',
      'Artificer',
      'x'.repeat(SPELL_LIMITS.name + 1),
      `spell name 1 is longer than ${SPELL_LIMITS.name} characters.`,
    ],
    [
      'too many names',
      'Artificer',
      Array.from({ length: SPELL_LIMITS.classListNames + 1 }, (_, i) => `s${i}`).join('\n'),
      `A class list can have at most ${SPELL_LIMITS.classListNames} spell names.`,
    ],
  ])('rejects %s', (_, className, text, message) => {
    const result = parseClassList(className, text);
    expect(result.ok ? [] : result.errors).toContain(message);
  });
});
