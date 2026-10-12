<script setup lang="ts">
import type { CounterSpec } from '../widgets/spec';

defineProps<{ widget: CounterSpec }>();
const emit = defineEmits<{ step: [delta: 1 | -1] }>();

const RESET_LABELS = {
  short: 'Refills on a short or long rest',
  long: 'Refills on a long rest',
  none: 'Never refills on a rest',
} as const;
</script>

<template>
  <div class="counter">
    <button
      type="button"
      :aria-label="`Decrease ${widget.name}`"
      :disabled="widget.value <= 0"
      @click="emit('step', -1)"
    >
      −
    </button>
    <output class="counter-value">{{ widget.value }} / {{ widget.max }}</output>
    <button
      type="button"
      :aria-label="`Increase ${widget.name}`"
      :disabled="widget.value >= widget.max"
      @click="emit('step', 1)"
    >
      +
    </button>
  </div>
  <p class="hint">{{ RESET_LABELS[widget.reset] }}</p>
</template>

<style scoped>
.counter {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.counter button {
  min-width: 3rem;
  font-size: 1.4rem;
}
.counter-value {
  min-width: 5ch;
  text-align: center;
  font-size: 1.4rem;
  font-variant-numeric: tabular-nums;
}
</style>
