<script setup lang="ts">
import { computed, defineAsyncComponent, provide, ref, shallowRef } from 'vue';
import NewCounterForm from './components/NewCounterForm.vue';
import SpellSlotsForm from './components/SpellSlotsForm.vue';
import TableSidebar from './components/TableSidebar.vue';
import {
  addWidget,
  addWidgets,
  changeHp,
  restBoard,
  stepCounter,
  toggleItem,
  undo,
  type Board,
} from './board/board';
import { browserStore } from './board/storage';
import type { RestKind } from './rules/rest';
import { PRIVATE_SPELLS, createPrivateSpellsState } from './spells/private-state';
import { parseSpecText, type WidgetSpec } from './widgets/spec';

// Loaded only when the Spells tab opens, so the spell view and the SRD data stay out of startup.
const SpellView = defineAsyncComponent(() => import('./components/SpellView.vue'));

type Tab = 'board' | 'spells';
const SPELLS_HASH = '#spells';
const tab = ref<Tab>(location.hash === SPELLS_HASH ? 'spells' : 'board');
/** The spell the sidebar asked to open; null shows the whole spell list. */
const openSpell = ref<string | null>(null);
function show(next: Tab) {
  tab.value = next;
  if (next === 'board') openSpell.value = null;
  // The hash makes the spell view linkable; it is not a router.
  const url = next === 'spells' ? SPELLS_HASH : location.pathname + location.search;
  history.replaceState(null, '', url);
}

const store = browserStore();
const loaded = store.load();
// The board is immutable, so a shallow ref is enough and snapshots stay plain objects.
const board = shallowRef<Board>(loaded.board);
const notice = ref<string | null>(loaded.notice);
const specText = ref('');
const errors = ref<string[]>([]);

function apply(next: Board) {
  if (next === board.value) return;
  board.value = next;
  notice.value = store.save(next) ?? notice.value;
}

function add() {
  const result = parseSpecText(specText.value);
  if (!result.ok) {
    errors.value = result.errors;
    return;
  }
  errors.value = [];
  specText.value = '';
  apply(addWidget(board.value, result.spec));
}

const addSpec = (spec: WidgetSpec) => apply(addWidget(board.value, spec));
const addSlots = (specs: WidgetSpec[]) => apply(addWidgets(board.value, specs, 'spell slots'));
const widgetNames = computed(() => board.value.widgets.map((w) => w.name));
const rest = (kind: RestKind) => apply(restBoard(board.value, kind));

// Private spells and the prepared list, shared by the sidebar and the spell view.
const privateSpells = createPrivateSpellsState();
provide(PRIVATE_SPELLS, privateSpells);

function open(name: string) {
  openSpell.value = name;
  show('spells');
}
</script>

<template>
  <div class="layout">
    <aside class="sidebar" aria-label="Character">
      <TableSidebar
        :board="board"
        @step="(id, delta) => apply(stepCounter(board, id, delta))"
        @toggle="(id, index) => apply(toggleItem(board, id, index))"
        @hp="(id, change, amount) => apply(changeHp(board, id, change, amount))"
        @rest="rest"
        @undo="apply(undo(board))"
        @open="open"
      />
    </aside>

    <main>
      <header class="top">
        <h1>lanternbook</h1>
        <nav class="tabs" role="tablist" aria-label="Views">
          <button
            v-for="t in ['board', 'spells'] as const"
            :key="t"
            type="button"
            role="tab"
            :aria-selected="tab === t ? 'true' : 'false'"
            @click="show(t)"
          >
            {{ t === 'board' ? 'Board' : 'Spells' }}
          </button>
        </nav>
      </header>

      <p v-if="notice" class="notice" role="status">{{ notice }}</p>
      <p v-if="privateSpells.notice.value" class="notice" role="status">
        {{ privateSpells.notice.value }}
      </p>

      <SpellView v-if="tab === 'spells'" :open="openSpell" @close="openSpell = null" />
      <template v-else>
        <section class="board-section">
          <h2>New counter</h2>
          <NewCounterForm @add="addSpec" />
        </section>
        <section class="board-section">
          <h2>Spell slots</h2>
          <SpellSlotsForm :existing-names="widgetNames" @add="addSlots" />
        </section>
        <section class="board-section">
          <h2>Advanced: paste a spec</h2>
          <div class="add-form">
            <label for="spec">Paste a widget spec (see docs/EXAMPLES.md)</label>
            <textarea
              id="spec"
              v-model="specText"
              aria-label="Widget spec"
              rows="6"
              spellcheck="false"
              autocapitalize="off"
              autocomplete="off"
            ></textarea>
            <button type="button" class="add" @click="add">Add widget</button>
            <ul v-if="errors.length" class="errors" role="alert">
              <li v-for="(error, i) in errors" :key="i">{{ error }}</li>
            </ul>
          </div>
        </section>
      </template>
    </main>
  </div>
</template>

<style>
:root {
  color-scheme: light dark;
  --line: #8886;
  --bg: #fff;
  --error: #b00020;
  font-family: system-ui, sans-serif;
  line-height: 1.4;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #1b1b1f;
    --error: #ff8a80;
  }
}
body {
  margin: 0;
  background: var(--bg);
}
button,
textarea {
  font: inherit;
  font-size: 1rem;
}
button {
  min-height: 2.75rem;
  padding: 0 1rem;
  border-radius: 0.5rem;
}
</style>

<style scoped>
.layout {
  display: grid;
  grid-template-columns: 20rem minmax(0, 1fr);
  min-height: 100vh;
}
.sidebar {
  position: sticky;
  top: 0;
  height: 100vh;
  overflow-y: auto;
  box-sizing: border-box;
  padding: 1rem;
  border-right: 1px solid var(--line);
}
main {
  min-width: 0;
  max-width: 80rem;
  padding: 1rem;
  display: grid;
  align-content: start;
  gap: 1rem;
}
.top {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}
h1 {
  margin: 0;
  font-size: 1.4rem;
}
.tabs {
  display: flex;
  gap: 0.25rem;
}
.tabs [aria-selected='true'] {
  font-weight: 700;
  border-width: 2px;
}
.notice {
  margin: 0;
  padding: 0.75rem;
  border: 1px solid var(--line);
  border-radius: 0.5rem;
}
.board-section {
  max-width: 36rem;
}
.board-section h2 {
  margin: 0 0 0.5rem;
  font-size: 1.1rem;
}
.add-form {
  display: grid;
  gap: 0.5rem;
  max-width: 36rem;
}
textarea {
  width: 100%;
  box-sizing: border-box;
  font-family: ui-monospace, monospace;
}
.add {
  justify-self: start;
}
.errors {
  margin: 0;
  padding-left: 1.25rem;
  color: var(--error);
}
:deep(.hint) {
  margin: 0.5rem 0 0;
  opacity: 0.75;
}
/* Narrow screens: the sidebar stacks above the tabs. */
@media (max-width: 48rem) {
  .layout {
    grid-template-columns: 1fr;
  }
  .sidebar {
    position: static;
    height: auto;
    border-right: 0;
    border-bottom: 1px solid var(--line);
  }
}
</style>
