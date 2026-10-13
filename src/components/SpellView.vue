<script setup lang="ts">
// The spell tab: SRD 5.1 spells plus the person's private ones, filtered by name, level, school
// and class. The SRD data loads here, on demand, so it is not part of the startup bundle.
import { computed, onMounted, ref, shallowRef } from 'vue';
import { filterSpells, normalize, unmatchedNames, type ClassLists } from '../spells/filter';
import { privateSpellStore, type PrivateSpells } from '../spells/store';
import {
  SCHOOLS,
  parseClassList,
  parseSpellText,
  type School,
  type SpellSpec,
} from '../widgets/spell-spec';
import SpellCard from './SpellCard.vue';

const store = privateSpellStore();
const loaded = store.load();
const mine = shallowRef<PrivateSpells>(loaded.data);
const notice = ref<string | null>(loaded.notice);

const srd = shallowRef<SpellSpec[]>([]);
const loading = ref(true);
onMounted(async () => {
  try {
    // Checked by src/spells/content.test.ts, so the data is known to be valid spell specs.
    srd.value = (await import('../spells/data/srd-spells.json')).default as SpellSpec[];
  } catch {
    notice.value =
      "The SRD spells couldn't be loaded. Check the connection and open the tab again.";
  } finally {
    loading.value = false;
  }
});

const search = ref('');
const level = ref('');
const school = ref<School | ''>('');
const className = ref('');

// Verbatim from the "Legal Information" page (page 1) of the SRD 5.1 (CC) PDF, which asks for
// exactly this statement and no other attribution regarding Wizards. Also in NOTICE.
const SRD_ATTRIBUTION =
  'This work includes material taken from the System Reference Document 5.1 (“SRD 5.1”) by Wizards of the Coast LLC and available at https://dnd.wizards.com/resources/systems-reference-document. The SRD 5.1 is licensed under the Creative Commons Attribution 4.0 International License available at https://creativecommons.org/licenses/by/4.0/legalcode.';

const LEVELS = ['Cantrip', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'];
const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

const classOptions = computed(() => {
  const own = new Map<string, string>();
  for (const spell of [...srd.value, ...mine.value.spells]) {
    for (const c of spell.classes) if (!own.has(normalize(c))) own.set(normalize(c), c);
  }
  const options = [...own.values()].map((value) => ({ value, label: capitalise(value) }));
  for (const name of Object.keys(mine.value.classLists)) {
    if (!own.has(normalize(name))) options.push({ value: name, label: `${name} (private list)` });
  }
  return options.sort((a, b) => a.label.localeCompare(b.label, 'en'));
});

const allSpells = computed(() => [...srd.value, ...mine.value.spells]);
/** For each private class list, the names that match no SRD or private spell. */
const unmatched = computed(() =>
  Object.fromEntries(
    Object.entries(mine.value.classLists).map(([name, names]) => [
      name,
      unmatchedNames(names, allSpells.value),
    ]),
  ),
);
const privateSet = computed(() => new Set(mine.value.spells));
const results = computed(() =>
  filterSpells(
    allSpells.value,
    {
      search: search.value,
      level: level.value === '' ? null : Number(level.value),
      school: school.value === '' ? null : school.value,
      className: className.value === '' ? null : className.value,
    },
    mine.value.classLists,
  ),
);
const countText = computed(() => {
  const n = results.value.length;
  if (n === 0) return 'No spells match.';
  return n === 1 ? '1 spell' : `${n} spells`;
});

function apply(next: PrivateSpells) {
  mine.value = next;
  notice.value = store.save(next) ?? notice.value;
}

const spellText = ref('');
const spellErrors = ref<string[]>([]);
function addSpell() {
  const result = parseSpellText(spellText.value);
  if (!result.ok) {
    spellErrors.value = result.errors;
    return;
  }
  spellErrors.value = [];
  spellText.value = '';
  apply({ ...mine.value, spells: [...mine.value.spells, result.spell] });
}

function removeSpell(spell: SpellSpec) {
  apply({ ...mine.value, spells: mine.value.spells.filter((s) => s !== spell) });
}

const listName = ref('');
const listText = ref('');
const listErrors = ref<string[]>([]);
function withoutList(lists: ClassLists, name: string): ClassLists {
  return Object.fromEntries(
    Object.entries(lists).filter(([key]) => normalize(key) !== normalize(name)),
  );
}
function saveClassList() {
  const result = parseClassList(listName.value, listText.value);
  if (!result.ok) {
    listErrors.value = result.errors;
    return;
  }
  listErrors.value = [];
  listName.value = '';
  listText.value = '';
  const classLists = { ...withoutList(mine.value.classLists, result.className) };
  classLists[result.className] = result.names;
  apply({ ...mine.value, classLists });
}
function removeClassList(name: string) {
  if (normalize(className.value) === normalize(name)) className.value = '';
  apply({ ...mine.value, classLists: withoutList(mine.value.classLists, name) });
}
</script>

<template>
  <div class="spell-view">
    <p v-if="notice" class="notice" role="status">{{ notice }}</p>

    <div class="filters" role="search">
      <input
        v-model="search"
        type="search"
        aria-label="Search spells by name"
        placeholder="Search by name"
        autocomplete="off"
      />
      <select v-model="level" aria-label="Level">
        <option value="">Any level</option>
        <option v-for="(label, i) in LEVELS" :key="i" :value="String(i)">{{ label }}</option>
      </select>
      <select v-model="school" aria-label="School">
        <option value="">Any school</option>
        <option v-for="s in SCHOOLS" :key="s" :value="s">{{ capitalise(s) }}</option>
      </select>
      <select v-model="className" aria-label="Class">
        <option value="">Any class</option>
        <option v-for="c in classOptions" :key="c.value" :value="c.value">{{ c.label }}</option>
      </select>
    </div>

    <p class="result-count" aria-live="polite">{{ loading ? 'Loading spells…' : countText }}</p>
    <div class="cards">
      <SpellCard
        v-for="(spell, i) in results"
        :key="`${privateSet.has(spell) ? 'p' : 's'}:${spell.name}:${i}`"
        :spell="spell"
        :private="privateSet.has(spell)"
        @remove="removeSpell(spell)"
      />
    </div>

    <details class="private">
      <summary>Your private spells and class lists</summary>
      <p class="hint">
        Kept in this browser only, never in the repo. Format and an example: docs/SPELLS.md.
      </p>
      <div class="paste">
        <label for="spell-spec">Paste a spell spec</label>
        <textarea
          id="spell-spec"
          v-model="spellText"
          aria-label="Spell spec"
          rows="6"
          spellcheck="false"
          autocapitalize="off"
          autocomplete="off"
        ></textarea>
        <button type="button" class="add-spell" @click="addSpell">Add private spell</button>
        <ul v-if="spellErrors.length" class="errors" role="alert">
          <li v-for="(error, i) in spellErrors" :key="i">{{ error }}</li>
        </ul>
      </div>
      <div class="paste">
        <label for="class-name">Class list: a class name, then spell names, one per line</label>
        <input id="class-name" v-model="listName" aria-label="Class name" autocomplete="off" />
        <textarea
          v-model="listText"
          aria-label="Spell names"
          rows="6"
          spellcheck="false"
          autocomplete="off"
        ></textarea>
        <button type="button" class="save-class-list" @click="saveClassList">
          Save class list
        </button>
        <ul v-if="listErrors.length" class="errors" role="alert">
          <li v-for="(error, i) in listErrors" :key="i">{{ error }}</li>
        </ul>
      </div>
      <ul v-if="Object.keys(mine.classLists).length" class="lists">
        <li v-for="(names, name) in mine.classLists" :key="name">
          {{ name }} ({{ names.length }} spells)
          <span v-if="!loading && unmatched[name]?.length" class="class-list-unmatched">
            Not found in the SRD or your private spells: {{ unmatched[name]!.join(', ') }}
          </span>
          <button
            type="button"
            :aria-label="`Remove class list ${name}`"
            @click="removeClassList(String(name))"
          >
            Remove
          </button>
        </li>
      </ul>
    </details>

    <footer class="attribution">
      <p>{{ SRD_ATTRIBUTION }}</p>
    </footer>
  </div>
</template>

<style scoped>
.spell-view {
  display: grid;
  gap: 1rem;
}
.notice {
  margin: 0;
  padding: 0.75rem;
  border: 1px solid var(--line);
  border-radius: 0.5rem;
}
.filters {
  display: grid;
  grid-template-columns: minmax(12rem, 2fr) repeat(3, minmax(8rem, 1fr));
  gap: 0.5rem;
}
.filters input,
.filters select {
  min-height: 2.75rem;
  font: inherit;
  font-size: 1rem;
}
.result-count {
  margin: 0;
}
.cards {
  columns: 22rem;
  column-gap: 1rem;
}
.private {
  border-top: 1px solid var(--line);
  padding-top: 0.75rem;
}
.paste {
  display: grid;
  gap: 0.5rem;
  max-width: 40rem;
  margin-top: 0.75rem;
}
.paste textarea {
  width: 100%;
  box-sizing: border-box;
  font-family: ui-monospace, monospace;
}
.paste button {
  justify-self: start;
}
.errors {
  margin: 0;
  padding-left: 1.25rem;
  color: var(--error);
}
.class-list-unmatched {
  display: block;
  color: var(--error);
}
.hint {
  margin: 0.5rem 0 0;
  opacity: 0.75;
}
.attribution {
  border-top: 1px solid var(--line);
  padding: 0.75rem 0 1rem;
  font-size: 0.85rem;
  opacity: 0.8;
}
.attribution p {
  margin: 0;
  overflow-wrap: anywhere;
}
@media (max-width: 40rem) {
  .filters {
    grid-template-columns: 1fr 1fr;
  }
  .filters input {
    grid-column: 1 / -1;
  }
}
</style>
