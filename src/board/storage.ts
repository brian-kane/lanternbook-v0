// Saves the board in browser storage. Reading never throws. Missing data starts an empty board.
// Whenever anything stored has to be dropped (unreadable data, a bad widget, a bad undo history),
// the original stored text is first copied unchanged to a backup key, and a notice says what was
// dropped. Nothing else is written while loading; the main key changes only on the next save.
import { HISTORY_LIMIT, emptyBoard, type Board } from './board';
import { validateWidget, type Widget } from '../widgets/spec';

export const STORAGE_KEY = 'lanternbook.board';
export const BACKUP_KEY = 'lanternbook.board.unreadable';
const STORED_VERSION = 1;

/** The part of the browser's Storage this needs; tests pass an in-memory one. */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface LoadResult {
  board: Board;
  notice: string | null;
}

export interface BoardStore {
  load(): LoadResult;
  /** Returns a notice when the board could not be saved, otherwise null. */
  save(board: Board): string | null;
}

const BLOCKED =
  "This browser isn't letting lanternbook save, so changes will be lost when the page closes.";
const UNREADABLE = "Saved widgets couldn't be read, so lanternbook started empty.";
const BAD_HISTORY = "Saved undo history couldn't be read, so Undo starts fresh.";
const BACKED_UP = 'The original data is kept as a backup in this browser.';
const NOT_BACKED_UP = "The original data couldn't be backed up.";
const SAVE_FAILED =
  "Couldn't save the last change in this browser; it will be lost when the page closes.";

/** Keeps the widgets that validate and have unique ids; reports how many were dropped. */
function readWidgets(list: unknown[]): { widgets: Widget[]; dropped: number } {
  const widgets: Widget[] = [];
  for (const item of list) {
    const result = validateWidget(item);
    if (result.ok && !widgets.some((w) => w.id === result.widget.id)) widgets.push(result.widget);
  }
  return { widgets, dropped: list.length - widgets.length };
}

/** Reads what it can; lists what had to be dropped. Null means nothing was readable. */
function parse(raw: string): { board: Board; problems: string[] } | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return null;
  const { version, widgets, history } = data as Record<string, unknown>;
  if (version !== STORED_VERSION || !Array.isArray(widgets) || !Array.isArray(history)) return null;

  const problems: string[] = [];
  const current = readWidgets(widgets);
  if (current.dropped > 0) {
    const [s, was] = current.dropped === 1 ? ['', 'was'] : ['s', 'were'];
    problems.push(`${current.dropped} saved widget${s} couldn't be read and ${was} left out.`);
  }

  // Undo must restore exactly what was there, so the history is kept whole or not at all.
  const snapshots = history
    .slice(-HISTORY_LIMIT)
    .map((snapshot) => (Array.isArray(snapshot) ? readWidgets(snapshot) : null));
  const historyOk = snapshots.every((read) => read !== null && read.dropped === 0);
  if (!historyOk) problems.push(BAD_HISTORY);

  return {
    board: {
      widgets: current.widgets,
      history: historyOk ? snapshots.map((read) => read!.widgets) : [],
    },
    problems,
  };
}

/** Copies the stored text to the backup key; returns whether that worked. */
function backUp(storage: KeyValueStorage, raw: string): boolean {
  try {
    storage.setItem(BACKUP_KEY, raw);
    return true;
  } catch {
    return false;
  }
}

export function browserStore(
  getStorage: () => KeyValueStorage = () => window.localStorage,
): BoardStore {
  return {
    load() {
      let storage: KeyValueStorage;
      let raw: string | null;
      try {
        storage = getStorage();
        raw = storage.getItem(STORAGE_KEY);
      } catch {
        return { board: emptyBoard(), notice: BLOCKED };
      }
      if (raw === null) return { board: emptyBoard(), notice: null };
      const result = parse(raw);
      if (result && result.problems.length === 0) return { board: result.board, notice: null };
      const backedUp = backUp(storage, raw);
      const problems = result ? result.problems : [UNREADABLE];
      return {
        board: result ? result.board : emptyBoard(),
        notice: [...problems, backedUp ? BACKED_UP : NOT_BACKED_UP].join(' '),
      };
    },

    save(board) {
      let storage: KeyValueStorage;
      try {
        storage = getStorage();
      } catch {
        return BLOCKED;
      }
      try {
        storage.setItem(STORAGE_KEY, JSON.stringify({ version: STORED_VERSION, ...board }));
        return null;
      } catch {
        return SAVE_FAILED;
      }
    },
  };
}
