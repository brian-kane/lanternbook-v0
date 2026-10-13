// The board: the widgets on screen plus an undo history of whole-board snapshots. An add, a rest,
// and damage or healing by a typed amount take a snapshot when they change something (of the state
// just before them, labelled with what was done), so Undo returns to the state before the last of
// those, discarding any +/- and ticks made since. All updates are immutable, so a snapshot can never be altered after it is taken.
import { damage, gainTemp, heal, type HpState } from '../rules/hp';
import { applyRest, type RestKind } from '../rules/rest';
import { withHp, type Widget, type WidgetSpec } from '../widgets/spec';

export const HISTORY_LIMIT = 20;

export type HpChange = 'damage' | 'heal' | 'temp';

export type UndoAction =
  | { kind: 'add'; name: string }
  | { kind: 'rest'; rest: RestKind }
  | { kind: 'hp'; name: string; change: HpChange; amount: number };

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

const UNDO_NAMES: Record<HpChange, string> = { damage: 'damage', heal: 'heal', temp: 'temp HP' };

/**
 * Damages, heals or gives temp HP to a counter by an amount, by the hit point rule
 * (src/rules/hp.ts); snapshots for Undo when anything changes. Temp HP of 0 is stored as no field.
 */
export function changeHp(board: Board, id: number, change: HpChange, amount: number): Board {
  const target = board.widgets.find((w) => w.id === id);
  if (!target || target.kind !== 'counter') return board;
  const state: HpState = { value: target.value, max: target.max, temp: target.temp ?? 0 };
  const next =
    change === 'damage'
      ? damage(state, amount)
      : change === 'heal'
        ? heal(state, amount)
        : gainTemp(state, amount).state;
  if (next.value === state.value && next.temp === state.temp) return board;
  const updated = withHp(target, next.value, next.temp);
  const widgets = board.widgets.map((w) => (w === target ? updated : w));
  return snapshot(board, { kind: 'hp', name: target.name, change, amount }, widgets);
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
  if (action.kind === 'hp')
    return `Undo ${UNDO_NAMES[action.change]} ${action.amount}: ${action.name}`;
  return `Undo ${action.rest} rest`;
}
