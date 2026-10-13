import { describe, expect, it } from 'vitest';
import counterText from '../widgets/fixtures/counter.json?raw';
import checklistText from '../widgets/fixtures/checklist.json?raw';
import hpText from '../widgets/fixtures/hp-counter.json?raw';
import type { WidgetSpec } from '../widgets/spec';
import {
  HISTORY_LIMIT,
  addWidget,
  changeHp,
  emptyBoard,
  restBoard,
  stepCounter,
  toggleItem,
  undo,
  undoLabel,
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
  const snapshotting: [string, (b: Board) => Board][] = [
    ['add a widget', (b) => addWidget(b, checklist)],
    ['short rest', (b) => restBoard(b, 'short')],
    ['long rest', (b) => restBoard(b, 'long')],
  ];
  const adjustments: [string, (b: Board) => Board][] = [
    ['counter +', (b) => stepCounter(b, 1, 1)],
    ['counter -', (b) => stepCounter(b, 1, -1)],
    ['checklist tick', (b) => toggleItem(b, 2, 1)],
    ['checklist untick', (b) => toggleItem(b, 2, 2)],
  ];

  it.each(snapshotting)('restores the exact state before: %s', (_, change) => {
    const before = seeded();
    const snapshot = structuredClone(before);
    const after = change(before);
    expect(after.widgets).not.toStrictEqual(before.widgets);
    expect(after.history).toHaveLength(before.history.length + 1);
    expect(undo(after)).toStrictEqual(snapshot);
  });

  it.each(adjustments)('takes no snapshot for: %s', (_, change) => {
    const before = seeded();
    const after = change(before);
    expect(after.widgets).not.toStrictEqual(before.widgets);
    expect(after.history).toBe(before.history);
  });

  it.each(adjustments)('undo after %s returns to before the last add or rest', (_, change) => {
    const beforeRest = seeded();
    const snapshot = structuredClone(beforeRest);
    const rested = restBoard(beforeRest, 'short');
    const adjusted = change(change(rested));
    expect(undo(adjusted)).toStrictEqual(snapshot);
  });

  it('undoes adds and rests one at a time, newest first', () => {
    const states = [seeded()];
    for (const [, change] of snapshotting) states.push(change(states.at(-1)!));
    let board = states.at(-1)!;
    for (let i = states.length - 2; i >= 0; i--) {
      expect(board).not.toStrictEqual(states[i]);
      board = undo(board);
      expect(board).toStrictEqual(states[i]);
    }
  });

  it('takes no snapshot for a rest that refills nothing', () => {
    const rested = restBoard(seeded(), 'long');
    expect(restBoard(rested, 'long')).toBe(rested);
    expect(restBoard(rested, 'short')).toBe(rested);
  });

  it('records what each snapshot was taken for', () => {
    const added = addWidget(emptyBoard(), counter);
    expect(added.history.at(-1)?.action).toStrictEqual({ kind: 'add', name: 'Lantern oil flasks' });
    const rested = restBoard(stepCounter(added, 1, -1), 'long');
    expect(rested.history.at(-1)?.action).toStrictEqual({ kind: 'rest', rest: 'long' });
  });

  it('ignores steps and ticks that change nothing', () => {
    const full = stepCounter(stepCounter(seeded(), 1, 1), 1, 1);
    expect(stepCounter(full, 1, 1)).toBe(full);
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

describe('undoLabel', () => {
  it('names the add or rest that Undo will reverse', () => {
    expect(undoLabel(emptyBoard())).toBeNull();
    const added = addWidget(emptyBoard(), counter);
    expect(undoLabel(added)).toBe('Undo add: Lantern oil flasks');
    const drained = stepCounter(stepCounter(added, 1, -1), 1, -1);
    expect(undoLabel(restBoard(drained, 'long'))).toBe('Undo long rest');
    const short = addWidget(drained, shortCounter);
    expect(undoLabel(restBoard(short, 'short'))).toBe('Undo short rest');
    expect(undoLabel(undo(restBoard(drained, 'long')))).toBe('Undo add: Lantern oil flasks');
  });
});

describe('damage and heal by amount', () => {
  const hp: WidgetSpec = JSON.parse(hpText);
  const hurt = (): Board => changeHp(addWidget(emptyBoard(), hp), 1, 'damage', 10);
  const value = (board: Board) => (board.widgets[0] as { value: number }).value;

  it('subtracts damage and adds healing by exactly the amount', () => {
    expect(value(hurt())).toBe(17);
    expect(value(changeHp(hurt(), 1, 'heal', 4))).toBe(21);
    expect(value(changeHp(hurt(), 1, 'damage', 1))).toBe(16);
  });

  it('stops damage at 0 and healing at max', () => {
    expect(value(changeHp(hurt(), 1, 'damage', 999))).toBe(0);
    expect(value(changeHp(hurt(), 1, 'heal', 999))).toBe(27);
  });

  it('snapshots each damage or heal, so Undo reverses exactly that one', () => {
    const before = hurt();
    const snapshot = structuredClone(before);
    const healed = changeHp(before, 1, 'heal', 4);
    expect(healed.history).toHaveLength(before.history.length + 1);
    expect(healed.history.at(-1)?.action).toStrictEqual({
      kind: 'hp',
      name: 'Hit points',
      change: 'heal',
      amount: 4,
    });
    expect(undo(healed)).toStrictEqual(snapshot);
    expect(undoLabel(healed)).toBe('Undo heal 4: Hit points');
    expect(undoLabel(hurt())).toBe('Undo damage 10: Hit points');
  });

  it('takes no snapshot when nothing changes', () => {
    const full = addWidget(emptyBoard(), hp);
    expect(changeHp(full, 1, 'heal', 5)).toBe(full);
    const down = changeHp(full, 1, 'damage', 999);
    expect(changeHp(down, 1, 'damage', 3)).toBe(down);
    expect(changeHp(full, 99, 'damage', 3)).toBe(full);
  });

  it('changes only counters', () => {
    const board = addWidget(emptyBoard(), checklist);
    expect(changeHp(board, 1, 'damage', 3)).toBe(board);
  });
});

describe('temp HP on the board', () => {
  const hp: WidgetSpec = JSON.parse(hpText);
  const counterOf = (board: Board) => board.widgets[0] as { value: number; temp?: number };
  const withTemp = (): Board => changeHp(addWidget(emptyBoard(), hp), 1, 'temp', 8);

  it('gains temp HP with a snapshot and an Undo label', () => {
    const before = addWidget(emptyBoard(), hp);
    const board = withTemp();
    expect(counterOf(board).temp).toBe(8);
    expect(undoLabel(board)).toBe('Undo temp HP 8: Hit points');
    expect(undo(board)).toStrictEqual(before);
  });

  it('takes no snapshot when the new temp HP is not higher', () => {
    const board = withTemp();
    expect(changeHp(board, 1, 'temp', 5)).toBe(board);
    expect(changeHp(board, 1, 'temp', 8)).toBe(board);
  });

  it('takes damage off temp HP first, with a snapshot even when only temp HP changes', () => {
    const board = changeHp(withTemp(), 1, 'damage', 5);
    expect(counterOf(board)).toMatchObject({ value: 27, temp: 3 });
    expect(undoLabel(board)).toBe('Undo damage 5: Hit points');
    const through = changeHp(board, 1, 'damage', 10);
    expect(counterOf(through).value).toBe(20);
    expect('temp' in counterOf(through)).toBe(false);
  });

  it('heals without restoring temp HP', () => {
    const hurt = changeHp(changeHp(withTemp(), 1, 'damage', 20), 1, 'heal', 30);
    expect(counterOf(hurt).value).toBe(27);
    expect('temp' in counterOf(hurt)).toBe(false);
  });

  it('clears temp HP on a long rest but not a short one', () => {
    expect(counterOf(restBoard(withTemp(), 'short')).temp).toBe(8);
    expect('temp' in counterOf(restBoard(withTemp(), 'long'))).toBe(false);
  });
});
