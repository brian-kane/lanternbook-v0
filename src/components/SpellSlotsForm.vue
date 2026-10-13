<script setup lang="ts">
// Adds spell slot counters without writing JSON: a max per level, one Refills choice. App adds
// what passes as one undo step; levels that already have a counter are reported and left alone.
import { ref } from 'vue';
import { SLOT_LEVELS, checkSlots, slotName, type SlotsResult } from '../widgets/slots-form';
import type { WidgetSpec } from '../widgets/spec';

const props = defineProps<{ existingNames: string[] }>();
const emit = defineEmits<{ add: [specs: WidgetSpec[]] }>();

const maxes = ref<string[]>(SLOT_LEVELS.map(() => ''));
const reset = ref('long');
const result = ref<SlotsResult | null>(null);

function submit() {
  const checked = checkSlots({ maxes: maxes.value, reset: reset.value }, props.existingNames);
  result.value = checked;
  if (checked.specs.length === 0) return;
  // Clear the rows that were added; keep the skipped ones so their messages make sense.
  maxes.value = maxes.value.map((max, i) => (SLOT_LEVELS[i]! in checked.skipped ? max : ''));
  emit('add', checked.specs);
}

const messageId = (level: number) => `slot-${level}-message`;
const message = (level: number) =>
  result.value?.rowErrors[level]?.join(' ') ?? result.value?.skipped[level] ?? null;
const isError = (level: number) => Boolean(result.value?.rowErrors[level]);
</script>

<template>
  <form class="spell-slots" novalidate @submit.prevent="submit">
    <div class="rows">
      <div v-for="(level, i) in SLOT_LEVELS" :key="level" class="row">
        <label :for="`slot-${level}`">Level {{ level }}</label>
        <input
          :id="`slot-${level}`"
          v-model="maxes[i]"
          :name="`slot-${level}`"
          :aria-label="`Max ${slotName(level)}`"
          inputmode="numeric"
          autocomplete="off"
          placeholder="—"
          :aria-invalid="isError(level) ? 'true' : undefined"
          :aria-describedby="message(level) ? messageId(level) : undefined"
        />
        <p
          v-if="message(level)"
          :id="messageId(level)"
          :class="isError(level) ? 'row-error' : 'row-note'"
        >
          {{ message(level) }}
        </p>
      </div>
    </div>
    <div class="field">
      <label for="slots-reset">Refills on</label>
      <select id="slots-reset" v-model="reset" name="slots-reset">
        <option value="short">A short or long rest</option>
        <option value="long">A long rest</option>
      </select>
    </div>
    <p v-if="result?.formErrors.length" class="form-error">{{ result.formErrors.join(' ') }}</p>
    <button type="submit" class="add-slots">Add spell slots</button>
  </form>
</template>

<style scoped>
.spell-slots {
  display: grid;
  gap: 0.75rem;
}
.rows {
  display: grid;
  gap: 0.5rem;
}
.row {
  display: grid;
  grid-template-columns: 5rem 6rem 1fr;
  align-items: center;
  gap: 0.5rem;
}
.row input,
.field select {
  min-height: 2.5rem;
  font: inherit;
  font-size: 1rem;
}
.row p {
  margin: 0;
}
.row-error,
.form-error {
  margin: 0;
  color: var(--error);
}
.field {
  display: grid;
  gap: 0.25rem;
  max-width: 16rem;
}
.add-slots {
  justify-self: start;
}
</style>
