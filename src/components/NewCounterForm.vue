<script setup lang="ts">
// Adds a counter without writing JSON. It builds the same spec as pasting and sends it through the
// same validator; App adds it with the same undo snapshot.
import { reactive, ref } from 'vue';
import {
  counterSpecFrom,
  fieldErrors,
  type CounterField,
  type CounterForm,
} from '../widgets/counter-form';
import { validateSpec, type WidgetSpec } from '../widgets/spec';

const emit = defineEmits<{ add: [spec: WidgetSpec] }>();

const blank = (): CounterForm => ({ name: '', max: '', reset: 'long', hp: false, start: '' });
const form = reactive(blank());
const errors = ref<Record<CounterField, string[]> | null>(null);

function submit() {
  const result = validateSpec(counterSpecFrom(form));
  if (!result.ok) {
    errors.value = fieldErrors(result.errors);
    return;
  }
  errors.value = null;
  Object.assign(form, blank());
  emit('add', result.spec);
}

const errorId = (field: CounterField) => `new-counter-${field}-error`;
const described = (field: CounterField) =>
  errors.value?.[field].length ? errorId(field) : undefined;
</script>

<template>
  <form class="new-counter" novalidate @submit.prevent="submit">
    <div class="field">
      <label for="new-counter-name">Name</label>
      <input
        id="new-counter-name"
        v-model="form.name"
        name="name"
        autocomplete="off"
        placeholder="Level 1 slots"
        :aria-invalid="described('name') ? 'true' : undefined"
        :aria-describedby="described('name')"
      />
      <p v-if="described('name')" :id="errorId('name')" class="field-error">
        {{ errors!.name.join(' ') }}
      </p>
    </div>
    <div class="field">
      <label for="new-counter-max">Max</label>
      <input
        id="new-counter-max"
        v-model="form.max"
        name="max"
        inputmode="numeric"
        autocomplete="off"
        :aria-invalid="described('max') ? 'true' : undefined"
        :aria-describedby="described('max')"
      />
      <p v-if="described('max')" :id="errorId('max')" class="field-error">
        {{ errors!.max.join(' ') }}
      </p>
    </div>
    <div class="field">
      <label for="new-counter-start">Starting value (blank: start full)</label>
      <input
        id="new-counter-start"
        v-model="form.start"
        name="start"
        inputmode="numeric"
        autocomplete="off"
        :aria-invalid="described('value') ? 'true' : undefined"
        :aria-describedby="described('value')"
      />
      <p v-if="described('value')" :id="errorId('value')" class="field-error">
        {{ errors!.value.join(' ') }}
      </p>
    </div>
    <div class="field">
      <label for="new-counter-reset">Refills on</label>
      <select
        id="new-counter-reset"
        v-model="form.reset"
        name="reset"
        :aria-invalid="described('reset') ? 'true' : undefined"
        :aria-describedby="described('reset')"
      >
        <option value="short">A short or long rest</option>
        <option value="long">A long rest</option>
        <option value="none">Never (no rest refills it)</option>
      </select>
      <p v-if="described('reset')" :id="errorId('reset')" class="field-error">
        {{ errors!.reset.join(' ') }}
      </p>
    </div>
    <label class="check">
      <input v-model="form.hp" type="checkbox" name="hp" />
      Hit points (adds Damage, Heal and temp HP)
    </label>
    <p v-if="errors?.other.length" class="field-error">{{ errors.other.join(' ') }}</p>
    <button type="submit" class="add-counter">Add counter</button>
  </form>
</template>

<style scoped>
.new-counter {
  display: grid;
  gap: 0.75rem;
}
.field {
  display: grid;
  gap: 0.25rem;
}
.field input,
.field select {
  min-height: 2.75rem;
  font: inherit;
  font-size: 1rem;
}
.check {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.field-error {
  margin: 0;
  color: var(--error);
}
.add-counter {
  justify-self: start;
}
</style>
