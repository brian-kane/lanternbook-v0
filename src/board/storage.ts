// Saves the board in browser storage. Reading never throws: missing data starts an empty board,
// and unreadable data starts an empty board with a notice, after copying the old text to a backup
// key so nothing is silently destroyed.
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
const UNREADABLE =
  "Saved widgets couldn't be read, so lanternbook started empty. The old data is kept as a backup in this browser.";
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

function parse(raw: string): LoadResult | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return null;
  const { version, widgets, history } = data as Record<string, unknown>;
  if (version !== STORED_VERSION || !Array.isArray(widgets) || !Array.isArray(history)) return null;

  const current = readWidgets(widgets);
  if (current.dropped > 0) {
    // Undo could no longer restore exactly what was there, so the history goes too.
    const s = current.dropped === 1 ? '' : 's';
    return {
      board: { widgets: current.widgets, history: [] },
      notice: `${current.dropped} saved widget${s} couldn't be read and was left out.`,
    };
  }

  const snapshots: Widget[][] = [];
  for (const snapshot of history.slice(-HISTORY_LIMIT)) {
    const read = Array.isArray(snapshot) ? readWidgets(snapshot) : null;
    if (!read || read.dropped > 0) {
      return {
        board: { widgets: current.widgets, history: [] },
        notice: "Saved undo history couldn't be read, so Undo starts fresh.",
      };
    }
    snapshots.push(read.widgets);
  }
  return { board: { widgets: current.widgets, history: snapshots }, notice: null };
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
      if (result) return result;
      try {
        storage.setItem(BACKUP_KEY, raw);
      } catch {
        // The notice below still tells the person; the backup is a best effort.
      }
      return { board: emptyBoard(), notice: UNREADABLE };
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
