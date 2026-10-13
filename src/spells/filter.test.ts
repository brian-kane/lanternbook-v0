import { describe, expect, it } from 'vitest';
import inventedText from './fixtures/invented-spells.json?raw';
import casesText from './fixtures/filter-cases.json?raw';
import { filterSpells, type ClassLists, type SpellQuery } from './filter';
import type { SpellSpec } from '../widgets/spell-spec';

const spells: SpellSpec[] = JSON.parse(inventedText);
const golden: {
  classLists: ClassLists;
  cases: { name: string; query: SpellQuery; expected: string[] }[];
} = JSON.parse(casesText);

describe('filterSpells', () => {
  it('has golden cases', () => {
    expect(golden.cases.length).toBeGreaterThan(10);
  });

  it.each(golden.cases.map((c) => [c.name, c] as const))('%s', (_, { query, expected }) => {
    const names = filterSpells(spells, query, golden.classLists).map((s) => s.name);
    expect(names).toStrictEqual(expected);
  });

  it('returns the same spell objects and leaves the input order alone', () => {
    const input = [...spells];
    const result = filterSpells(input, golden.cases[0]!.query, {});
    expect(result.every((s) => spells.includes(s))).toBe(true);
    expect(input).toStrictEqual(spells);
  });
});
