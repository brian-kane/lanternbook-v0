import { describe, expect, it } from 'vitest';
import counterText from '../widgets/fixtures/counter.json?raw';
import checklistText from '../widgets/fixtures/checklist.json?raw';
import type { WidgetSpec } from '../widgets/spec';
import {
  HISTORY_LIMIT,
  addWidget,
  emptyBoard,
  restBoard,
  stepCounter,
  toggleItem,
  undo,
  type Board,
} from './board';

const counter: WidgetSpec = JSON.parse(counterText);
const checklist: WidgetSpec = JSON.parse(checklistText);
const shortCounter: WidgetSpec = {
  ...counter,
  name: 'Lucky coin flips',
  value: 0,
  max: 2,
  reset: 'short',
} as WidgetSpec;

function seeded(): Board {
  let board = addWidget(emptyBoard(), counter);
  board = addWidget(board, checklist);
  board = addWidget(board, shortCounter);
  return stepCounter(stepCounter(board, 1, -1), 1, -1);
}

describe('board changes', () => {
  it('adds widgets with increasing ids', () => {
    const board = seeded();
    expect(board.widgets.map((w) => w.id)).toStrictEqual([1, 2, 3]);
    expect(board.widgets[0]).toStrictEqual({ ...counter, id: 1, value: 1 });
  });

  it('keeps counters within 0 and max', () => {
    let board = seeded();
    board = stepCounter(stepCounter(stepCounter(board, 1, 1), 1, 1), 1, 1);
    expect(board.widgets[0]).toMatchObject({ value: 3 });
    board = stepCounter(stepCounter(stepCounter(stepCounter(board, 1, -1), 1, -1), 1, -1), 1, -1);
    expect(board.widgets[0]).toMatchObject({ value: 0 });
  });

  it('ticks and unticks one checklist item', () => {
    const board = toggleItem(toggleItem(seeded(), 2, 0), 2, 2);
    expect(board.widgets[1]).toMatchObject({
      items: [
        { text: 'Buy rope', done: true },
        { text: 'Refill waterskins', done: false },
        { text: 'Pay the innkeeper', done: false },
      ],
    });
  });

  it('applies the rest rule to the whole board', () => {
    expect(restBoard(seeded(), 'long').widgets[0]).toMatchObject({ value: 3 });
    const short = restBoard(seeded(), 'short');
    expect(short.widgets[0]).toMatchObject({ value: 1 });
    expect(short.widgets[2]).toMatchObject({ value: 2 });
  });
});

describe('undo', () => {
  const changes: [string, (b: Board) => Board][] = [
    ['add a widget', (b) => addWidget(b, checklist)],
    ['counter +', (b) => stepCounter(b, 1, 1)],
    ['counter -', (b) => stepCounter(b, 1, -1)],
    ['checklist tick', (b) => toggleItem(b, 2, 1)],
    ['checklist untick', (b) => toggleItem(b, 2, 2)],
    ['short rest', (b) => restBoard(b, 'short')],
    ['long rest', (b) => restBoard(b, 'long')],
  ];

  it.each(changes)('restores the exact state before: %s', (_, change) => {
    const before = seeded();
    const snapshot = structuredClone(before);
    const after = change(before);
    expect(after.widgets).not.toStrictEqual(before.widgets);
    expect(undo(after)).toStrictEqual(snapshot);
  });

  it('undoes changes one at a time, newest first', () => {
    const states = [seeded()];
    for (const [, change] of changes) states.push(change(states.at(-1)!));
    let board = states.at(-1)!;
    for (let i = states.length - 2; i >= 0; i--) {
      expect(board).not.toStrictEqual(states[i]);
      board = undo(board);
      expect(board).toStrictEqual(states[i]);
    }
  });

  it('records nothing when a change has no effect', () => {
    const full = stepCounter(stepCounter(seeded(), 1, 1), 1, 1);
    expect(stepCounter(full, 1, 1)).toBe(full);
    const rested = restBoard(full, 'long');
    expect(restBoard(rested, 'long')).toBe(rested);
    expect(stepCounter(full, 99, 1)).toBe(full);
    expect(toggleItem(full, 2, 99)).toBe(full);
  });

  it(`keeps only the last ${HISTORY_LIMIT} snapshots`, () => {
    let board = emptyBoard();
    const states = [board];
    for (let i = 0; i < 25; i++) {
      board = addWidget(board, counter);
      states.push(board);
    }
    expect(board.history).toHaveLength(HISTORY_LIMIT);
    for (let i = 0; i < HISTORY_LIMIT; i++) board = undo(board);
    expect(board.widgets).toStrictEqual(states[25 - HISTORY_LIMIT]!.widgets);
    expect(undo(board)).toBe(board);
  });

  it('does nothing with an empty history', () => {
    const board = emptyBoard();
    expect(undo(board)).toBe(board);
  });
});
