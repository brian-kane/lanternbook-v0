// Saves the person's private spells and class lists in browser storage, never anywhere else.
// Same contract as the board store (src/board/storage.ts): reading never throws, missing data
// starts empty, and before anything stored is dropped the original text is copied unchanged to a
// backup key and a notice says what was dropped.
import type { KeyValueStorage } from '../board/storage';
import { checkClassList, validateSpell, type SpellSpec } from '../widgets/spell-spec';
import type { ClassLists } from './filter';

// Under "lanternbook:" like every other key (docs/KNOWN-ISSUES.md).
export const SPELLS_KEY = 'lanternbook:spells';
export const SPELLS_BACKUP_KEY = 'lanternbook:spells-backup';
const STORED_VERSION = 1;

export interface PrivateSpells {
  spells: SpellSpec[];
  classLists: ClassLists;
}

export interface PrivateSpellStore {
  load(): { data: PrivateSpells; notice: string | null };
  /** Returns a notice when the data could not be saved, otherwise null. */
  save(data: PrivateSpells): string | null;
}

export const emptyPrivateSpells = (): PrivateSpells => ({ spells: [], classLists: {} });

const BLOCKED =
  "This browser isn't letting lanternbook save, so private spells will be lost when the page closes.";
const UNREADABLE = "Saved private spells couldn't be read, so they were left out.";
const BACKED_UP = 'The original data is kept as a backup in this browser.';
const NOT_BACKED_UP = "The original data couldn't be backed up.";
const SAVE_FAILED =
  "Couldn't save private spells in this browser; the last change will be lost when the page closes.";

const dropped = (count: number, what: string) =>
  count === 1
    ? `1 saved ${what} couldn't be read and was left out.`
    : `${count} saved ${what}s couldn't be read and were left out.`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Reads what it can; lists what had to be dropped. Null means nothing was readable. */
function parse(raw: string): { data: PrivateSpells; problems: string[] } | null {
  let stored: unknown;
  try {
    stored = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(stored)) return null;
  const { version, spells, classLists } = stored;
  if (version !== STORED_VERSION || !Array.isArray(spells) || !isRecord(classLists)) return null;

  const data = emptyPrivateSpells();
  for (const value of spells) {
    const result = validateSpell(value);
    if (result.ok) data.spells.push(result.spell);
  }
  for (const [name, names] of Object.entries(classLists)) {
    if (checkClassList(name, names).length === 0) data.classLists[name] = [...(names as string[])];
  }
  const badSpells = spells.length - data.spells.length;
  const badLists = Object.keys(classLists).length - Object.keys(data.classLists).length;
  const problems = [];
  if (badSpells > 0) problems.push(dropped(badSpells, 'private spell'));
  if (badLists > 0) problems.push(dropped(badLists, 'class list'));
  return { data, problems };
}

/** Copies the stored text to the backup key; returns whether that worked. */
function backUp(storage: KeyValueStorage, raw: string): boolean {
  try {
    storage.setItem(SPELLS_BACKUP_KEY, raw);
    return true;
  } catch {
    return false;
  }
}

export function privateSpellStore(
  getStorage: () => KeyValueStorage = () => window.localStorage,
): PrivateSpellStore {
  return {
    load() {
      let storage: KeyValueStorage;
      let raw: string | null;
      try {
        storage = getStorage();
        raw = storage.getItem(SPELLS_KEY);
      } catch {
        return { data: emptyPrivateSpells(), notice: BLOCKED };
      }
      if (raw === null) return { data: emptyPrivateSpells(), notice: null };
      const result = parse(raw);
      if (result && result.problems.length === 0) return { data: result.data, notice: null };
      const problems = result ? result.problems : [UNREADABLE];
      return {
        data: result ? result.data : emptyPrivateSpells(),
        notice: [...problems, backUp(storage, raw) ? BACKED_UP : NOT_BACKED_UP].join(' '),
      };
    },

    save(data) {
      let storage: KeyValueStorage;
      try {
        storage = getStorage();
      } catch {
        return BLOCKED;
      }
      try {
        storage.setItem(SPELLS_KEY, JSON.stringify({ version: STORED_VERSION, ...data }));
        return null;
      } catch {
        return SAVE_FAILED;
      }
    },
  };
}
