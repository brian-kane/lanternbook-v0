// The board: the widgets on screen plus an undo history of whole-board snapshots. An add, a rest,
// and damage or healing by a typed amount take a snapshot when they change something (of the state
// just before them, labelled with what was done), so Undo returns to the state before the last of
// those, discarding any +/- and ticks made since. All updates are immutable, so a snapshot can never be altered after it is taken.
import { applyRest, type RestKind } from '../rules/rest';
import type { Widget, WidgetSpec } from '../widgets/spec';

export const HISTORY_LIMIT = 20;

export type HpChange = 'damage' | 'heal';

export type UndoAction =
  | { kind: 'add'; name: string }
  | { kind: 'rest'; rest: RestKind }
  | { kind: 'hp'; name: string; change: HpChange; amount: number };

/** The largest damage or healing typed in one go. */
export const MAX_AMOUNT = 999;

export interface HistoryEntry {
  /** What was done right after this snapshot was taken; Undo reverses it. */
  action: UndoAction;
  widgets: Widget[];
}

export interface Board {
  widgets: Widget[];
  /** Oldest first; the last entry is the state before the most recent add or rest. */
  history: HistoryEntry[];
}

export const emptyBoard = (): Board => ({ widgets: [], history: [] });

const unchanged = (before: Widget[], after: Widget[]) =>
  before.length === after.length && after.every((w, i) => w === before[i]);

/** Records the current widgets as a snapshot, then moves to the new ones. */
function snapshot(board: Board, action: UndoAction, widgets: Widget[]): Board {
  if (unchanged(board.widgets, widgets)) return board;
  const entry = { action, widgets: board.widgets };
  return { widgets, history: [...board.history, entry].slice(-HISTORY_LIMIT) };
}

/** Changes one widget without a snapshot; a change with no effect returns the same board. */
function adjust(board: Board, id: number, change: (widget: Widget) => Widget): Board {
  const widgets = board.widgets.map((w) => (w.id === id ? change(w) : w));
  return unchanged(board.widgets, widgets) ? board : { ...board, widgets };
}

export function addWidget(board: Board, spec: WidgetSpec): Board {
  const id = Math.max(0, ...board.widgets.map((w) => w.id)) + 1;
  return snapshot(board, { kind: 'add', name: spec.name }, [...board.widgets, { ...spec, id }]);
}

export function stepCounter(board: Board, id: number, delta: 1 | -1): Board {
  return adjust(board, id, (w) => {
    if (w.kind !== 'counter') return w;
    const value = Math.min(w.max, Math.max(0, w.value + delta));
    return value === w.value ? w : { ...w, value };
  });
}

/** Damage or heals a counter by an amount, staying between 0 and max; snapshots for Undo. */
export function changeHp(board: Board, id: number, change: HpChange, amount: number): Board {
  const target = board.widgets.find((w) => w.id === id);
  if (!target || target.kind !== 'counter') return board;
  const signed = change === 'damage' ? -amount : amount;
  const value = Math.min(target.max, Math.max(0, target.value + signed));
  if (value === target.value) return board;
  const widgets = board.widgets.map((w) => (w === target ? { ...target, value } : w));
  return snapshot(board, { kind: 'hp', name: target.name, change, amount }, widgets);
}

/** Reads a typed damage or healing amount: a whole number from 1 to MAX_AMOUNT, digits only. */
export function parseAmount(
  text: string,
): { ok: true; amount: number } | { ok: false; error: string } {
  const trimmed = text.trim();
  const amount = Number(trimmed);
  if (!/^\d+$/.test(trimmed) || amount < 1 || amount > MAX_AMOUNT) {
    return { ok: false, error: `Type a whole number from 1 to ${MAX_AMOUNT}.` };
  }
  return { ok: true, amount };
}

export function toggleItem(board: Board, id: number, index: number): Board {
  return adjust(board, id, (w) => {
    if (w.kind !== 'checklist' || !w.items[index]) return w;
    const items = w.items.map((item, i) => (i === index ? { ...item, done: !item.done } : item));
    return { ...w, items };
  });
}

export function restBoard(board: Board, rest: RestKind): Board {
  return snapshot(board, { kind: 'rest', rest }, applyRest(board.widgets, rest));
}

export function undo(board: Board): Board {
  const previous = board.history.at(-1);
  if (!previous) return board;
  return { widgets: previous.widgets, history: board.history.slice(0, -1) };
}

/** The Undo button's label, naming what it will reverse; null when there is nothing to undo. */
export function undoLabel(board: Board): string | null {
  const action = board.history.at(-1)?.action;
  if (!action) return null;
  if (action.kind === 'add') return `Undo add: ${action.name}`;
  if (action.kind === 'hp') return `Undo ${action.change} ${action.amount}: ${action.name}`;
  return `Undo ${action.rest} rest`;
}
