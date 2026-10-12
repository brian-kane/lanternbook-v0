<script setup lang="ts">
import { computed } from 'vue';
import type { ChecklistSpec } from '../widgets/spec';

const props = defineProps<{ widget: ChecklistSpec }>();
const emit = defineEmits<{ toggle: [index: number] }>();

const done = computed(() => props.widget.items.filter((item) => item.done).length);
</script>

<template>
  <ul class="checklist">
    <li v-for="(item, index) in widget.items" :key="index">
      <label>
        <input type="checkbox" :checked="item.done" @change="emit('toggle', index)" />
        <span>{{ item.text }}</span>
      </label>
    </li>
  </ul>
  <p class="hint">{{ done }} of {{ widget.items.length }} done</p>
</template>

<style scoped>
.checklist {
  list-style: none;
  margin: 0;
  padding: 0;
}
.checklist label {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  min-height: 2.75rem;
  overflow-wrap: anywhere;
}
.checklist input {
  width: 1.4rem;
  height: 1.4rem;
  flex: none;
}
</style>
