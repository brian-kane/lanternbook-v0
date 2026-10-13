import { describe, expect, it } from 'vitest';
import counterText from '../widgets/fixtures/counter.json?raw';
import checklistText from '../widgets/fixtures/checklist.json?raw';
import { addWidget, emptyBoard, stepCounter } from './board';
import { BACKUP_KEY, STORAGE_KEY, browserStore, type KeyValueStorage } from './storage';

const counter = JSON.parse(counterText);
const checklist = JSON.parse(checklistText);

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

const sample = () => stepCounter(addWidget(addWidget(emptyBoard(), counter), checklist), 1, -1);

describe('browserStore', () => {
  it('round-trips widgets and history', () => {
    const storage = memory();
    const store = browserStore(() => storage);
    expect(store.save(sample())).toBeNull();
    expect(store.load()).toStrictEqual({ board: sample(), notice: null });
  });

  it('starts empty and silent when nothing is stored', () => {
    expect(browserStore(() => memory()).load()).toStrictEqual({
      board: emptyBoard(),
      notice: null,
    });
  });

  it.each([
    ['text that is not JSON', '{"widgets": ['],
    ['JSON that is not an object', '[1, 2]'],
    ['an unknown version', JSON.stringify({ version: 9, widgets: [], history: [] })],
    ['widgets that are not a list', JSON.stringify({ version: 1, widgets: 'x', history: [] })],
    ['history that is not a list', JSON.stringify({ version: 1, widgets: [], history: {} })],
  ])('falls back to empty with a notice, keeping a backup, for %s', (_, raw) => {
    const storage = memory({ [STORAGE_KEY]: raw });
    const result = browserStore(() => storage).load();
    expect(result.board).toStrictEqual(emptyBoard());
    expect(result.notice).toBe(
      "Saved widgets couldn't be read, so lanternbook started empty. The original data is kept as a backup in this browser.",
    );
    expect(storage.data.get(BACKUP_KEY)).toBe(raw);
  });

  const BACKED_UP = 'The original data is kept as a backup in this browser.';
  const BAD_HISTORY_NOTICE = "Saved undo history couldn't be read, so Undo starts fresh.";
  const good = { ...counter, id: 1 };
  const entry = (widgets: unknown[], action: unknown = { kind: 'add', name: 'Rope' }) => ({
    action,
    widgets,
  });
  const bad = { ...checklist, id: 2, items: null };

  function loadRaw(stored: unknown) {
    const raw = JSON.stringify(stored);
    const storage = memory({ [STORAGE_KEY]: raw });
    return { raw, storage, result: browserStore(() => storage).load() };
  }

  it('writes no backup for clean data', () => {
    const { storage } = loadRaw({ version: 1, widgets: [good], history: [entry([])] });
    expect(storage.data.has(BACKUP_KEY)).toBe(false);
  });

  it('drops a bad widget, keeps the valid widgets and the valid history, and backs up first', () => {
    const history = [entry([]), entry([good])];
    const { raw, storage, result } = loadRaw({ version: 1, widgets: [good, bad], history });
    expect(result.board).toStrictEqual({ widgets: [good], history });
    expect(result.notice).toBe(`1 saved widget couldn't be read and was left out. ${BACKED_UP}`);
    expect(storage.data.get(BACKUP_KEY)).toBe(raw);
    expect(storage.data.get(STORAGE_KEY)).toBe(raw);
  });

  it('counts every dropped widget, repeated ids included', () => {
    const { result } = loadRaw({
      version: 1,
      widgets: [good, bad, { ...checklist, id: 1 }],
      history: [],
    });
    expect(result.board.widgets).toStrictEqual([good]);
    expect(result.notice).toBe(`2 saved widgets couldn't be read and were left out. ${BACKED_UP}`);
  });

  it('clears an unreadable history, keeps the widgets, and backs up first', () => {
    const { raw, storage, result } = loadRaw({
      version: 1,
      widgets: [good],
      history: [entry([good]), entry([{ kind: 'timer' }])],
    });
    expect(result.board).toStrictEqual({ widgets: [good], history: [] });
    expect(result.notice).toBe(
      `Saved undo history couldn't be read, so Undo starts fresh. ${BACKED_UP}`,
    );
    expect(storage.data.get(BACKUP_KEY)).toBe(raw);
  });

  it('reports both problems when a widget and the history are bad', () => {
    const { result } = loadRaw({ version: 1, widgets: [good, bad], history: [entry([bad])] });
    expect(result.board).toStrictEqual({ widgets: [good], history: [] });
    expect(result.notice).toBe(
      `1 saved widget couldn't be read and was left out. Saved undo history couldn't be read, so Undo starts fresh. ${BACKED_UP}`,
    );
  });

  it.each([
    ['a bare list of widgets', [good]],
    ['an unknown action', entry([good], { kind: 'tick' })],
    ['an add without a name', entry([good], { kind: 'add' })],
    ['a rest of an unknown kind', entry([good], { kind: 'rest', rest: 'nap' })],
    ['an entry with no widgets', { action: { kind: 'rest', rest: 'long' } }],
  ])('treats a history entry with %s as unreadable', (_, bad) => {
    const { result } = loadRaw({ version: 1, widgets: [good], history: [entry([]), bad] });
    expect(result.board.history).toStrictEqual([]);
    expect(result.notice).toBe(`${BAD_HISTORY_NOTICE} ${BACKED_UP}`);
  });

  it('says so when the backup itself cannot be written', () => {
    const raw = JSON.stringify({ version: 1, widgets: [good, bad], history: [] });
    const storage = memory({ [STORAGE_KEY]: raw });
    storage.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    expect(browserStore(() => storage).load().notice).toBe(
      "1 saved widget couldn't be read and was left out. The original data couldn't be backed up.",
    );
  });

  it('starts empty with a notice when browser storage is blocked', () => {
    const store = browserStore(() => {
      throw new Error('SecurityError');
    });
    expect(store.load()).toStrictEqual({
      board: emptyBoard(),
      notice:
        "This browser isn't letting lanternbook save, so changes will be lost when the page closes.",
    });
    expect(store.save(sample())).toBe(
      "This browser isn't letting lanternbook save, so changes will be lost when the page closes.",
    );
  });

  it('reports a failed save instead of throwing', () => {
    const storage = memory();
    storage.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    expect(browserStore(() => storage).save(sample())).toBe(
      "Couldn't save the last change in this browser; it will be lost when the page closes.",
    );
  });

  it('uses only keys under the lanternbook: prefix', () => {
    expect(STORAGE_KEY).toBe('lanternbook:board');
    expect(BACKUP_KEY).toBe('lanternbook:board-backup');
    const storage = memory({ [STORAGE_KEY]: '{"broken' });
    const keys: string[] = [];
    const logged: KeyValueStorage = {
      getItem: (key) => (keys.push(key), storage.getItem(key)),
      setItem: (key, value) => (keys.push(key), storage.setItem(key, value)),
    };
    const store = browserStore(() => logged);
    store.load();
    store.save(sample());
    expect(new Set(keys)).toStrictEqual(new Set([STORAGE_KEY, BACKUP_KEY]));
    expect(keys.every((key) => key.startsWith('lanternbook:'))).toBe(true);
  });
});
