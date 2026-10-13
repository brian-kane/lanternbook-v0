// Filters spells for the spell view. Pure: same spells and query in, same list out.
import type { School, SpellSpec } from '../widgets/spell-spec';

export interface SpellQuery {
  search: string;
  level: number | null;
  school: School | null;
  className: string | null;
}

/** Private class lists: a class name and the spell names on it, as the person pasted them. */
export type ClassLists = Record<string, string[]>;

/** Lower case, straight apostrophes, no surrounding spaces: how names and classes are compared. */
export const normalize = (text: string) => text.trim().toLowerCase().replace(/[‘’]/g, "'");

function inClass(spell: SpellSpec, className: string, lists: ClassLists): boolean {
  const wanted = normalize(className);
  if (spell.classes.some((c) => normalize(c) === wanted)) return true;
  const name = normalize(spell.name);
  return Object.entries(lists).some(
    ([listName, names]) =>
      normalize(listName) === wanted && names.some((n) => normalize(n) === name),
  );
}

/** The spells that match every part of the query, by level and then by name. */
export function filterSpells<T extends SpellSpec>(
  spells: readonly T[],
  query: SpellQuery,
  lists: ClassLists = {},
): T[] {
  const search = normalize(query.search);
  return spells
    .filter(
      (spell) =>
        (search === '' || normalize(spell.name).includes(search)) &&
        (query.level === null || spell.level === query.level) &&
        (query.school === null || spell.school === query.school) &&
        (query.className === null || inClass(spell, query.className, lists)),
    )
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name, 'en'));
}
