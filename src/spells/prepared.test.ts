import { describe, expect, it } from 'vitest';
import { PREPARED_LIST, isPrepared, preparedNames, setClassList, togglePrepared } from './prepared';
import { emptyPrivateSpells } from './store';

describe('prepared spells', () => {
  it('are the private class list named Prepared', () => {
    expect(PREPARED_LIST).toBe('Prepared');
    expect(preparedNames(emptyPrivateSpells())).toStrictEqual([]);
    const data = { ...emptyPrivateSpells(), classLists: { prepared: ['Lantern Hum'] } };
    expect(preparedNames(data)).toStrictEqual(['Lantern Hum']);
  });
});

describe('setClassList', () => {
  const lists = { Artificer: ['Ash Whistle'], Prepared: ['Lantern Hum'] };

  it('replaces a list whatever the case of its name, keeping the others', () => {
    expect(setClassList(lists, 'prepared', ['Moth Ladder'])).toStrictEqual({
      Artificer: ['Ash Whistle'],
      prepared: ['Moth Ladder'],
    });
  });

  it('removes a list when given null', () => {
    expect(setClassList(lists, 'PREPARED', null)).toStrictEqual({ Artificer: ['Ash Whistle'] });
  });

  it('does not change the input', () => {
    setClassList(lists, 'Prepared', null);
    expect(lists).toStrictEqual({ Artificer: ['Ash Whistle'], Prepared: ['Lantern Hum'] });
  });
});

describe('togglePrepared', () => {
  const base = () => ({
    ...emptyPrivateSpells(),
    classLists: { Artificer: ['Ash Whistle'], Prepared: ['Lantern Hum'] },
  });

  it('adds the exact spell name once, at the end, keeping the other lists', () => {
    const next = togglePrepared(base(), 'Pebble Count');
    expect(next.classLists).toStrictEqual({
      Artificer: ['Ash Whistle'],
      Prepared: ['Lantern Hum', 'Pebble Count'],
    });
    expect(isPrepared(next, 'pebble count')).toBe(true);
  });

  it('removes a prepared spell, matching case and apostrophes loosely', () => {
    const data = togglePrepared(base(), 'Won’t Stay Lit');
    expect(isPrepared(data, "Won't Stay Lit")).toBe(true);
    const removed = togglePrepared(data, "won't stay lit");
    expect(preparedNames(removed)).toStrictEqual(['Lantern Hum']);
    expect(togglePrepared(base(), 'LANTERN HUM').classLists).toStrictEqual({
      Artificer: ['Ash Whistle'],
    });
  });

  it('starts the Prepared list when there is none, and never adds a duplicate', () => {
    const once = togglePrepared(emptyPrivateSpells(), 'Moth Ladder');
    expect(once.classLists).toStrictEqual({ Prepared: ['Moth Ladder'] });
    const twice = togglePrepared(togglePrepared(once, 'Ash Whistle'), 'Moth Ladder');
    expect(preparedNames(twice)).toStrictEqual(['Ash Whistle']);
  });
});
