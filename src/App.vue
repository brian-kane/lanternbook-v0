<script setup lang="ts">
import { ref, shallowRef } from 'vue';
import WidgetFrame from './components/WidgetFrame.vue';
import { addWidget, restBoard, stepCounter, toggleItem, undo, type Board } from './board/board';
import { browserStore } from './board/storage';
import type { RestKind } from './rules/rest';
import { parseSpecText } from './widgets/spec';

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

const rest = (kind: RestKind) => apply(restBoard(board.value, kind));
</script>

<template>
  <main>
    <h1>lanternbook</h1>
    <p v-if="notice" class="notice" role="status">{{ notice }}</p>

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

    <p v-if="board.widgets.length === 0" class="hint">No widgets yet.</p>
    <div class="widgets">
      <WidgetFrame
        v-for="widget in board.widgets"
        :key="widget.id"
        :widget="widget"
        @step="(id, delta) => apply(stepCounter(board, id, delta))"
        @toggle="(id, index) => apply(toggleItem(board, id, index))"
      />
    </div>

    <nav class="actions" aria-label="Board actions">
      <button type="button" @click="rest('short')">Short rest</button>
      <button type="button" @click="rest('long')">Long rest</button>
      <button type="button" :disabled="board.history.length === 0" @click="apply(undo(board))">
        Undo
      </button>
    </nav>
  </main>
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
main {
  max-width: 36rem;
  margin: 0 auto;
  padding: 1rem 1rem 0;
  display: grid;
  gap: 1rem;
}
h1 {
  margin: 0;
  font-size: 1.4rem;
}
.notice {
  margin: 0;
  padding: 0.75rem;
  border: 1px solid var(--line);
  border-radius: 0.5rem;
}
.add-form {
  display: grid;
  gap: 0.5rem;
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
.widgets {
  display: grid;
  gap: 0.75rem;
}
.actions {
  position: sticky;
  bottom: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0.75rem 0 calc(0.75rem + env(safe-area-inset-bottom, 0px));
  background: var(--bg);
  border-top: 1px solid var(--line);
}
.actions button {
  flex: 1 1 6rem;
}
:deep(.hint) {
  margin: 0.5rem 0 0;
  opacity: 0.75;
}
</style>
