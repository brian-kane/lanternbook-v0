// The board: the widgets on screen plus an undo history of whole-board snapshots. Only an add
// and a rest that changes something take a snapshot (of the state just before them, labelled with
// what was done), so Undo returns to the state before the last add or rest, discarding any +/- and
// ticks made since. All updates are immutable, so a snapshot can never be altered after it is taken.
import { applyRest, type RestKind } from '../rules/rest';
import type { Widget, WidgetSpec } from '../widgets/spec';

export const HISTORY_LIMIT = 20;

export type UndoAction = { kind: 'add'; name: string } | { kind: 'rest'; rest: RestKind };

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
  return action.kind === 'add' ? `Undo add: ${action.name}` : `Undo ${action.rest} rest`;
}
