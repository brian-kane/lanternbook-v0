<script setup lang="ts">
// The sidebar beside both tabs: the board's widgets (hit points, slots, resources), the rests and
// Undo, and the prepared spells. It stays on screen while a spell is looked up.
import { computed, ref, shallowRef, watch } from 'vue';
import { undoLabel, type Board, type HpChange } from '../board/board';
import type { RestKind } from '../rules/rest';
import { unmatchedNames } from '../spells/filter';
import { PREPARED_LIST, preparedNames, setClassList } from '../spells/prepared';
import { usePrivateSpells } from '../spells/private-state';
import { loadSrdSpells } from '../spells/srd';
import { parseClassList, type SpellSpec } from '../widgets/spell-spec';
import WidgetFrame from './WidgetFrame.vue';

const props = defineProps<{ board: Board }>();
const emit = defineEmits<{
  step: [id: number, delta: 1 | -1];
  toggle: [id: number, index: number];
  hp: [id: number, change: HpChange, amount: number];
  rest: [kind: RestKind];
  undo: [];
  open: [name: string];
}>();

const undoText = computed(() => undoLabel(props.board));

const { state } = usePrivateSpells();
const prepared = computed(() => preparedNames(state.data.value));

// The SRD data is needed only to report prepared names that match no spell, so it loads (on
// demand, never at startup) once there is a prepared list.
const srd = shallowRef<SpellSpec[] | null>(null);
watch(
  () => prepared.value.length > 0,
  async (needed) => {
    if (!needed || srd.value) return;
    try {
      srd.value = await loadSrdSpells();
    } catch {
      state.notice.value =
        "The SRD spells couldn't be loaded, so prepared spells can't be checked yet.";
    }
  },
  { immediate: true },
);
const unmatched = computed(() =>
  srd.value ? unmatchedNames(prepared.value, [...srd.value, ...state.data.value.spells]) : [],
);
const found = computed(() => prepared.value.filter((name) => !unmatched.value.includes(name)));

const preparedText = ref(prepared.value.join('\n'));
const preparedErrors = ref<string[]>([]);
function savePrepared() {
  const result = parseClassList(PREPARED_LIST, preparedText.value);
  if (!result.ok) {
    preparedErrors.value = result.errors;
    return;
  }
  preparedErrors.value = [];
  const classLists = setClassList(state.data.value.classLists, PREPARED_LIST, result.names);
  state.apply({ ...state.data.value, classLists });
  preparedText.value = result.names.join('\n');
}
function clearPrepared() {
  preparedErrors.value = [];
  preparedText.value = '';
  const classLists = setClassList(state.data.value.classLists, PREPARED_LIST, null);
  state.apply({ ...state.data.value, classLists });
}
</script>

<template>
  <div class="table-sidebar">
    <p v-if="board.widgets.length === 0" class="hint">
      No widgets yet. Add hit points, spell slots and other counters on the Board tab.
    </p>
    <div class="widgets">
      <WidgetFrame
        v-for="widget in board.widgets"
        :key="widget.id"
        :widget="widget"
        @step="(id, delta) => emit('step', id, delta)"
        @toggle="(id, index) => emit('toggle', id, index)"
        @hp="(id, change, amount) => emit('hp', id, change, amount)"
      />
    </div>

    <nav class="actions" aria-label="Board actions">
      <button type="button" @click="emit('rest', 'short')">Short rest</button>
      <button type="button" @click="emit('rest', 'long')">Long rest</button>
      <button type="button" class="undo" :disabled="!undoText" @click="emit('undo')">
        {{ undoText ?? 'Undo' }}
      </button>
    </nav>

    <section class="prepared">
      <h2>Prepared spells</h2>
      <ul v-if="found.length" class="prepared-list">
        <li v-for="name in found" :key="name">
          <button type="button" class="prepared-spell" @click="emit('open', name)">
            {{ name }}
          </button>
        </li>
      </ul>
      <p v-else-if="prepared.length === 0" class="hint">None yet.</p>
      <p v-if="unmatched.length" class="prepared-unmatched">
        Not found in the SRD or your private spells: {{ unmatched.join(', ') }}
      </p>
      <details>
        <summary>Edit prepared spells</summary>
        <textarea
          v-model="preparedText"
          aria-label="Prepared spell names"
          rows="6"
          spellcheck="false"
          autocomplete="off"
          placeholder="One spell name per line"
        ></textarea>
        <div class="row">
          <button type="button" class="save-prepared" @click="savePrepared">Save</button>
          <button type="button" class="clear-prepared" @click="clearPrepared">Clear</button>
        </div>
        <ul v-if="preparedErrors.length" class="errors" role="alert">
          <li v-for="(error, i) in preparedErrors" :key="i">{{ error }}</li>
        </ul>
      </details>
    </section>
  </div>
</template>

<style scoped>
.table-sidebar {
  display: grid;
  gap: 0.75rem;
}
.widgets {
  display: grid;
  gap: 0.75rem;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.actions button {
  flex: 1 1 6rem;
}
.actions .undo {
  flex-basis: 100%;
  overflow-wrap: anywhere;
}
.prepared h2 {
  margin: 0 0 0.25rem;
  font-size: 1.1rem;
}
.prepared-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  margin: 0 0 0.5rem;
  padding: 0;
  list-style: none;
}
.prepared-spell {
  min-height: 2.25rem;
  padding: 0 0.6rem;
  overflow-wrap: anywhere;
}
.prepared-unmatched {
  margin: 0 0 0.5rem;
  color: var(--error);
}
textarea {
  width: 100%;
  box-sizing: border-box;
  margin-top: 0.5rem;
  font-family: ui-monospace, monospace;
}
.row {
  display: flex;
  gap: 0.5rem;
}
.errors {
  margin: 0.5rem 0 0;
  padding-left: 1.25rem;
  color: var(--error);
}
.hint {
  margin: 0;
  opacity: 0.75;
}
</style>
