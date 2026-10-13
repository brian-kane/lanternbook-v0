import { describe, expect, it } from 'vitest';
import inventedText from './fixtures/invented-spells.json?raw';
import type { KeyValueStorage } from '../board/storage';
import {
  SPELLS_BACKUP_KEY,
  SPELLS_KEY,
  emptyPrivateSpells,
  privateSpellStore,
  type PrivateSpells,
} from './store';

const [hum, pebble] = JSON.parse(inventedText);

function memory(
  initial: Record<string, string> = {},
): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
  };
}

const sample = (): PrivateSpells => ({
  spells: [hum, pebble],
  classLists: { Artificer: ['Lantern Hum', 'Pebble Count'] },
});

const BACKED_UP = 'The original data is kept as a backup in this browser.';
const UNREADABLE = "Saved private spells couldn't be read, so they were left out.";

function loadRaw(raw: string) {
  const storage = memory({ [SPELLS_KEY]: raw });
  return { storage, result: privateSpellStore(() => storage).load() };
}

describe('privateSpellStore', () => {
  it('uses keys under lanternbook:', () => {
    expect(SPELLS_KEY).toBe('lanternbook:spells');
    expect(SPELLS_BACKUP_KEY).toBe('lanternbook:spells-backup');
  });

  it('round-trips private spells and class lists', () => {
    const storage = memory();
    const store = privateSpellStore(() => storage);
    expect(store.save(sample())).toBeNull();
    expect(store.load()).toStrictEqual({ data: sample(), notice: null });
  });

  it('starts empty and silent when nothing is stored', () => {
    expect(privateSpellStore(() => memory()).load()).toStrictEqual({
      data: emptyPrivateSpells(),
      notice: null,
    });
  });

  it.each([
    ['text that is not JSON', '{"spells": ['],
    ['JSON that is not an object', '[1, 2]'],
    ['an unknown version', JSON.stringify({ version: 2, spells: [], classLists: {} })],
    ['spells that are not a list', JSON.stringify({ version: 1, spells: {}, classLists: {} })],
    [
      'class lists that are not an object',
      JSON.stringify({ version: 1, spells: [], classLists: [] }),
    ],
  ])('starts empty with a notice, backing up first, for %s', (_, raw) => {
    const { storage, result } = loadRaw(raw);
    expect(result).toStrictEqual({
      data: emptyPrivateSpells(),
      notice: `${UNREADABLE} ${BACKED_UP}`,
    });
    expect(storage.data.get(SPELLS_BACKUP_KEY)).toBe(raw);
    expect(storage.data.get(SPELLS_KEY)).toBe(raw);
  });

  it('writes no backup for clean data', () => {
    const storage = memory({ [SPELLS_KEY]: JSON.stringify({ version: 1, ...sample() }) });
    privateSpellStore(() => storage).load();
    expect(storage.data.has(SPELLS_BACKUP_KEY)).toBe(false);
  });

  it('keeps the readable spells and lists, drops the rest, and backs up first', () => {
    const raw = JSON.stringify({
      version: 1,
      spells: [hum, { ...pebble, level: 10 }, { ...pebble, kind: 'counter' }],
      classLists: { Artificer: ['Lantern Hum'], Bad: 'Lantern Hum', '': ['Pebble Count'] },
    });
    const { storage, result } = loadRaw(raw);
    expect(result.data).toStrictEqual({
      spells: [hum],
      classLists: { Artificer: ['Lantern Hum'] },
    });
    expect(result.notice).toBe(
      `2 saved private spells couldn't be read and were left out. 2 saved class lists couldn't be read and were left out. ${BACKED_UP}`,
    );
    expect(storage.data.get(SPELLS_BACKUP_KEY)).toBe(raw);
  });

  it('says so when storage is blocked, and never throws', () => {
    const blocked = () => {
      throw new Error('SecurityError');
    };
    const store = privateSpellStore(blocked);
    expect(store.load()).toStrictEqual({
      data: emptyPrivateSpells(),
      notice:
        "This browser isn't letting lanternbook save, so private spells will be lost when the page closes.",
    });
    expect(store.save(sample())).toBe(
      "This browser isn't letting lanternbook save, so private spells will be lost when the page closes.",
    );
  });

  it('reports a failed save', () => {
    const full: KeyValueStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    expect(privateSpellStore(() => full).save(sample())).toBe(
      "Couldn't save private spells in this browser; the last change will be lost when the page closes.",
    );
  });

  it('notes a failed backup instead of throwing', () => {
    const storage: KeyValueStorage = {
      getItem: () => 'not json',
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    expect(privateSpellStore(() => storage).load().notice).toBe(
      `${UNREADABLE} The original data couldn't be backed up.`,
    );
  });
});
