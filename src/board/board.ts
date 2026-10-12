// The board: the widgets on screen plus an undo history of whole-board snapshots. Every change
// goes through commit(), which records the state before it; a change with no effect records
// nothing, so Undo never appears to do nothing. All updates are immutable, so a snapshot can
// never be altered after it is taken.
import { applyRest, type RestKind } from '../rules/rest';
import type { Widget, WidgetSpec } from '../widgets/spec';

export const HISTORY_LIMIT = 20;

export interface Board {
  widgets: Widget[];
  /** Oldest first; the last entry is the state before the most recent change. */
  history: Widget[][];
}

export const emptyBoard = (): Board => ({ widgets: [], history: [] });

function commit(board: Board, widgets: Widget[]): Board {
  if (widgets.every((w, i) => w === board.widgets[i]) && widgets.length === board.widgets.length) {
    return board;
  }
  return { widgets, history: [...board.history, board.widgets].slice(-HISTORY_LIMIT) };
}

function update(board: Board, id: number, change: (widget: Widget) => Widget): Board {
  return commit(
    board,
    board.widgets.map((w) => (w.id === id ? change(w) : w)),
  );
}

export function addWidget(board: Board, spec: WidgetSpec): Board {
  const id = Math.max(0, ...board.widgets.map((w) => w.id)) + 1;
  return commit(board, [...board.widgets, { ...spec, id }]);
}

export function stepCounter(board: Board, id: number, delta: 1 | -1): Board {
  return update(board, id, (w) => {
    if (w.kind !== 'counter') return w;
    const value = Math.min(w.max, Math.max(0, w.value + delta));
    return value === w.value ? w : { ...w, value };
  });
}

export function toggleItem(board: Board, id: number, index: number): Board {
  return update(board, id, (w) => {
    if (w.kind !== 'checklist' || !w.items[index]) return w;
    const items = w.items.map((item, i) => (i === index ? { ...item, done: !item.done } : item));
    return { ...w, items };
  });
}

export function restBoard(board: Board, rest: RestKind): Board {
  return commit(board, applyRest(board.widgets, rest));
}

export function undo(board: Board): Board {
  const previous = board.history.at(-1);
  if (!previous) return board;
  return { widgets: previous, history: board.history.slice(0, -1) };
}
