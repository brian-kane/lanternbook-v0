// Keeps the public repo to SRD 5.1 spells and invented test spells (docs/CONTENT-POLICY.md).
// The bundled data comes from the SRD's spell descriptions; the allow-list comes from a different
// part of the same document, its class spell lists, so each checks the other.
import { describe, expect, it } from 'vitest';
import srdSpells from './data/srd-spells.json';
import srdLists from './data/srd-spell-lists.json';
import { validateSpell } from '../widgets/spell-spec';

const SRD_SPELL_COUNT = 319;
const INVENTED_MARKER = 'Invented for lanternbook tests.';
// A possessive name in front, like "Someone's Spell". The SRD 5.1 renamed such spells, so outside
// the SRD's own lists the pattern means a spell from another book.
const POSSESSIVE_PREFIX = /^[^\s]+['’]s\s/;

const listed = new Set(Object.values(srdLists.classes).flat());

/** Every JSON file under src, so a spell in any fixture or data file is seen. */
const jsonFiles = import.meta.glob<string>('/src/**/*.json', {
  query: '?raw',
  import: 'default',
  eager: true,
});

type Found = { file: string; spell: Record<string, unknown> };

function spellsIn(value: unknown, file: string, out: Found[] = []): Found[] {
  if (Array.isArray(value)) value.forEach((v) => spellsIn(v, file, out));
  else if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>;
    if (record.kind === 'spell') out.push({ file, spell: record });
    else Object.values(record).forEach((v) => spellsIn(v, file, out));
  }
  return out;
}

const SRD_FILE = '/src/spells/data/srd-spells.json';
const allSpells = Object.entries(jsonFiles).flatMap(([file, raw]) =>
  spellsIn(JSON.parse(raw), file),
);
const fixtureSpells = allSpells.filter((f) => f.file !== SRD_FILE);

/** Names that break the possessive-prefix ban: any spell name not on the SRD lists. */
const banned = (name: unknown) =>
  typeof name !== 'string' || (POSSESSIVE_PREFIX.test(name) && !listed.has(name));

describe('bundled SRD 5.1 spells', () => {
  it('scans the data file and at least one fixture file', () => {
    expect(Object.keys(jsonFiles)).toContain(SRD_FILE);
    expect(fixtureSpells.length).toBeGreaterThan(0);
  });

  it(`has all ${SRD_SPELL_COUNT} SRD spells, each a valid spell spec`, () => {
    expect(srdSpells).toHaveLength(SRD_SPELL_COUNT);
    const invalid = srdSpells.filter((s) => !validateSpell(s).ok).map((s) => s.name);
    expect(invalid).toStrictEqual([]);
  });

  it("names only spells on the SRD's class spell lists, and every listed spell", () => {
    const names = srdSpells.map((s) => s.name);
    expect(names.filter((n) => !listed.has(n))).toStrictEqual([]);
    expect([...listed].filter((n) => !names.includes(n))).toStrictEqual([]);
    expect(new Set(names).size).toBe(names.length);
  });

  it('gives each spell exactly the classes whose SRD list names it', () => {
    const lists = Object.entries(srdLists.classes);
    const wrong = srdSpells.filter((s) => {
      const expected = lists.filter(([, names]) => names.includes(s.name)).map(([c]) => c);
      return JSON.stringify(s.classes) !== JSON.stringify(expected);
    });
    expect(wrong.map((s) => s.name)).toStrictEqual([]);
  });

  it('covers the classes the SRD has spell lists for', () => {
    expect(Object.keys(srdLists.classes)).toStrictEqual([
      'bard',
      'cleric',
      'druid',
      'paladin',
      'ranger',
      'sorcerer',
      'warlock',
      'wizard',
    ]);
  });
});

describe('tables in the bundled SRD spells', () => {
  type Table = { caption?: string; header: string[]; rows: string[][] };
  const withTables = srdSpells.filter((s) => 'tables' in s) as unknown as {
    name: string;
    text: string;
    tables: Table[];
  }[];

  it('are on exactly the seven spells whose descriptions have tables', () => {
    expect(withTables.map((s) => s.name)).toStrictEqual([
      'Animate Objects',
      'Confusion',
      'Control Weather',
      'Creation',
      'Reincarnate',
      'Scrying',
      'Teleport',
    ]);
  });

  it('are not repeated in the spell text', () => {
    const repeated = withTables.flatMap((spell) =>
      spell.tables
        .flatMap((t) => [t.caption ?? '', t.header.join(' '), ...t.rows.map((r) => r.join(' '))])
        .filter((line) => line !== '' && spell.text.includes(line))
        .map((line) => `${spell.name}: ${line}`),
    );
    expect(repeated).toStrictEqual([]);
  });

  it('leave no table rows behind as single line breaks in any spell text', () => {
    const leftovers = srdSpells.filter((s) => /[^\n]\n[^\n]/.test(s.text)).map((s) => s.name);
    expect(leftovers).toStrictEqual([]);
  });
});

describe('spell names anywhere in the repo', () => {
  it('has no possessive name prefix unless the SRD lists that name', () => {
    expect(
      allSpells.filter((f) => banned(f.spell.name)).map((f) => `${f.file}: ${f.spell.name}`),
    ).toStrictEqual([]);
  });
});

describe('fixture spells', () => {
  it('are invented: marked, not named like an SRD spell, and sharing no SRD text', () => {
    const srdTexts = new Set(srdSpells.map((s) => s.text));
    const real = fixtureSpells.filter(
      ({ spell }) =>
        typeof spell.text !== 'string' ||
        !spell.text.startsWith(INVENTED_MARKER) ||
        listed.has(spell.name as string) ||
        srdTexts.has(spell.text),
    );
    expect(real.map((f) => `${f.file}: ${f.spell.name}`)).toStrictEqual([]);
  });
});
