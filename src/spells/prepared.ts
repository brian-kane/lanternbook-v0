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

/** Whether a spell name is on the Prepared list, ignoring case and apostrophe style. */
export function isPrepared(data: PrivateSpells, name: string): boolean {
  return preparedNames(data).some((n) => normalize(n) === normalize(name));
}

/** Adds the spell name to the Prepared list, or removes every entry matching it. */
export function togglePrepared(data: PrivateSpells, name: string): PrivateSpells {
  const names = preparedNames(data);
  const kept = names.filter((n) => normalize(n) !== normalize(name));
  const next = kept.length < names.length ? kept : [...names, name];
  const listName =
    Object.keys(data.classLists).find((key) => normalize(key) === normalize(PREPARED_LIST)) ??
    PREPARED_LIST;
  return {
    ...data,
    classLists: setClassList(data.classLists, listName, next.length > 0 ? next : null),
  };
}
