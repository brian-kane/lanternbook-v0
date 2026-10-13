<script setup lang="ts">
import { ref } from 'vue';
import { parseAmount, type HpChange } from '../board/board';
import type { CounterSpec } from '../widgets/spec';

defineProps<{ widget: CounterSpec }>();
const emit = defineEmits<{ step: [delta: 1 | -1]; hp: [change: HpChange, amount: number] }>();

// Hit points counters also take damage and healing by a typed amount.
const amountText = ref('');
const amountError = ref<string | null>(null);
function changeBy(change: HpChange) {
  const result = parseAmount(amountText.value);
  if (!result.ok) {
    amountError.value = result.error;
    return;
  }
  amountError.value = null;
  amountText.value = '';
  emit('hp', change, result.amount);
}

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
  <div v-if="widget.hp" class="amount">
    <input
      v-model="amountText"
      :aria-label="`Amount for ${widget.name}`"
      inputmode="numeric"
      autocomplete="off"
      placeholder="Amount"
      @keydown.enter="changeBy('damage')"
    />
    <button type="button" :aria-label="`Damage ${widget.name}`" @click="changeBy('damage')">
      Damage
    </button>
    <button type="button" :aria-label="`Heal ${widget.name}`" @click="changeBy('heal')">
      Heal
    </button>
  </div>
  <p v-if="amountError" class="amount-error" role="alert">{{ amountError }}</p>
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
.amount {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
}
.amount input {
  width: 6ch;
  min-height: 2.75rem;
  font: inherit;
  font-size: 1rem;
}
.amount-error {
  margin: 0.25rem 0 0;
  color: var(--error);
}
</style>
