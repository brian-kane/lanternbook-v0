<script setup lang="ts">
// One spell as a card. Every field renders as text; line breaks in the text are kept by CSS, and
// tables follow the text, scrolling sideways inside the card when they are wider than it.
import { computed } from 'vue';
import type { SpellSpec } from '../widgets/spell-spec';

const props = defineProps<{ spell: SpellSpec; private: boolean; prepared: boolean }>();
const emit = defineEmits<{ remove: []; prepare: [] }>();

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
      <span v-if="props.prepared" class="prepared-tag">Prepared</span>
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
    <template v-if="spell.tables">
      <div v-for="(table, t) in spell.tables" :key="t" class="table-scroll">
        <table>
          <caption v-if="table.caption">
            {{
              table.caption
            }}
          </caption>
          <thead>
            <tr>
              <th v-for="(cell, c) in table.header" :key="c" scope="col">{{ cell }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, r) in table.rows" :key="r">
              <td v-for="(cell, c) in row" :key="c">{{ cell }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
    <button
      type="button"
      class="prepare"
      :aria-pressed="props.prepared ? 'true' : 'false'"
      @click="emit('prepare')"
    >
      {{ props.prepared ? 'Unprepare' : 'Prepare' }}
    </button>
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
.prepared-tag,
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
.table-scroll {
  max-width: 100%;
  overflow-x: auto;
  margin-top: 0.75rem;
}
table {
  border-collapse: collapse;
  font-size: 0.9rem;
}
caption {
  text-align: left;
  font-weight: 600;
  padding-bottom: 0.25rem;
}
th,
td {
  border: 1px solid var(--line);
  padding: 0.25rem 0.5rem;
  text-align: left;
  vertical-align: top;
}
.prepare,
.remove {
  margin-top: 0.75rem;
  margin-right: 0.5rem;
}
</style>
