import { describe, expect, it } from 'vitest';
import { PREPARED_LIST, preparedNames, setClassList } from './prepared';
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
