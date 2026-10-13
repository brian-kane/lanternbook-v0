// Prepared spells are the private class list named "Prepared", kept with the other private lists
// under lanternbook:spells. Being a class list, it also works in the spell view's class filter.
import { normalize, type ClassLists } from './filter';
import type { PrivateSpells } from './store';

export const PREPARED_LIST = 'Prepared';

/** The prepared spell names, in the order they were pasted. */
export function preparedNames(data: PrivateSpells): string[] {
  const entry = Object.entries(data.classLists).find(
    ([name]) => normalize(name) === normalize(PREPARED_LIST),
  );
  return entry ? entry[1] : [];
}

/** Returns the lists with one list replaced (matched ignoring case), or removed when null. */
export function setClassList(lists: ClassLists, name: string, names: string[] | null): ClassLists {
  const others = Object.entries(lists).filter(([key]) => normalize(key) !== normalize(name));
  return Object.fromEntries(names === null ? others : [...others, [name, names]]);
}
