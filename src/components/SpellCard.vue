<script setup lang="ts">
// One spell as a card. Every field renders as text; line breaks in the text are kept by CSS.
import { computed } from 'vue';
import type { SpellSpec } from '../widgets/spell-spec';

const props = defineProps<{ spell: SpellSpec; private: boolean }>();
const emit = defineEmits<{ remove: [] }>();

const ORDINALS = ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'];
const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

const type = computed(() => {
  const { level, school, ritual } = props.spell;
  const base = level === 0 ? `${capitalise(school)} cantrip` : `${ORDINALS[level]}-level ${school}`;
  return ritual ? `${base} (ritual)` : base;
});
const classes = computed(() => props.spell.classes.map(capitalise).join(', '));
</script>

<template>
  <article class="spell-card">
    <header>
      <h2>{{ spell.name }}</h2>
      <span v-if="props.private" class="private-tag">Private</span>
    </header>
    <p class="spell-type">{{ type }}</p>
    <dl>
      <dt>Casting time</dt>
      <dd class="casting-time">{{ spell.castingTime }}</dd>
      <dt>Range</dt>
      <dd class="range">{{ spell.range }}</dd>
      <dt>Components</dt>
      <dd class="components">{{ spell.components }}</dd>
      <dt>Duration</dt>
      <dd class="duration">{{ spell.duration }}</dd>
      <template v-if="classes">
        <dt>Classes</dt>
        <dd class="classes">{{ classes }}</dd>
      </template>
    </dl>
    <p class="spell-text">{{ spell.text }}</p>
    <button
      v-if="props.private"
      type="button"
      class="remove"
      :aria-label="`Remove private spell ${spell.name}`"
      @click="emit('remove')"
    >
      Remove
    </button>
  </article>
</template>

<style scoped>
.spell-card {
  break-inside: avoid;
  margin: 0 0 1rem;
  border: 1px solid var(--line);
  border-radius: 0.75rem;
  padding: 0.75rem 1rem;
}
header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
}
h2 {
  margin: 0;
  font-size: 1.1rem;
  overflow-wrap: anywhere;
}
.private-tag {
  flex: none;
  padding: 0.1rem 0.5rem;
  border: 1px solid currentColor;
  border-radius: 1rem;
  font-size: 0.8rem;
}
.spell-type {
  margin: 0.1rem 0 0.5rem;
  font-style: italic;
}
dl {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 0.15rem 0.75rem;
  margin: 0 0 0.5rem;
}
dt {
  font-weight: 600;
}
dd {
  margin: 0;
}
.spell-text {
  margin: 0;
  white-space: pre-line;
  overflow-wrap: anywhere;
}
.remove {
  margin-top: 0.75rem;
}
</style>
