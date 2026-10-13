<script setup lang="ts">
// Draws one widget and contains its failures: if the widget's data breaks rendering, this frame
// shows a placeholder and the rest of the board keeps working.
import { onErrorCaptured, ref, watch } from 'vue';
import type { HpChange } from '../board/board';
import type { Widget } from '../widgets/spec';
import ChecklistWidget from './ChecklistWidget.vue';
import CounterWidget from './CounterWidget.vue';

const props = defineProps<{ widget: Widget }>();
const emit = defineEmits<{
  step: [id: number, delta: 1 | -1];
  toggle: [id: number, index: number];
  hp: [id: number, change: HpChange, amount: number];
}>();

const failed = ref(false);
watch(
  () => props.widget,
  () => (failed.value = false),
);
onErrorCaptured(() => {
  failed.value = true;
  return false;
});
</script>

<template>
  <section class="widget">
    <h2>{{ typeof widget.name === 'string' ? widget.name : 'Unnamed widget' }}</h2>
    <p v-if="failed" class="hint">This widget couldn't be shown.</p>
    <CounterWidget
      v-else-if="widget.kind === 'counter'"
      :widget="widget"
      @step="(delta) => emit('step', widget.id, delta)"
      @hp="(change, amount) => emit('hp', widget.id, change, amount)"
    />
    <ChecklistWidget
      v-else-if="widget.kind === 'checklist'"
      :widget="widget"
      @toggle="(index) => emit('toggle', widget.id, index)"
    />
    <p v-else class="hint">This widget couldn't be shown.</p>
  </section>
</template>

<style scoped>
.widget {
  border: 1px solid var(--line);
  border-radius: 0.75rem;
  padding: 0.75rem 1rem;
}
h2 {
  margin: 0 0 0.5rem;
  font-size: 1.1rem;
  overflow-wrap: anywhere;
}
</style>
