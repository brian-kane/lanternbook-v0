// The New counter form: turns what was typed into the same counter spec that pasting would give,
// for the same validator (spec.ts) to check, and places each rejection next to its field.

export interface CounterForm {
  name: string;
  max: string;
  reset: string;
  hp: boolean;
  /** Blank means start full. */
  start: string;
}

export type CounterField = 'name' | 'max' | 'reset' | 'value' | 'other';

/** Digits only become a number; anything else typed becomes NaN, so the validator rejects it. */
function whole(text: string): number | undefined {
  const trimmed = text.trim();
  if (trimmed === '') return undefined;
  return /^\d+$/.test(trimmed) ? Number(trimmed) : NaN;
}

/** The counter spec for the form. It is not checked here: pass it to validateSpec. */
export function counterSpecFrom(form: CounterForm): Record<string, unknown> {
  const max = whole(form.max);
  const maxUsable = Number.isInteger(max) ? (max as number) : 0;
  const value = form.start.trim() === '' ? maxUsable : whole(form.start);
  return {
    version: 1,
    kind: 'counter',
    name: form.name.trim(),
    value,
    max,
    reset: form.reset,
    ...(form.hp ? { hp: true } : {}),
  };
}

const LABELS: [prefix: string, field: CounterField, label: string][] = [
  ['name ', 'name', 'Name'],
  ['max ', 'max', 'Max'],
  ['value ', 'value', 'Starting value'],
  ['reset ', 'reset', 'Reset'],
];

/** Sorts validator messages by form field, naming each field as the form labels it. */
export function fieldErrors(errors: string[]): Record<CounterField, string[]> {
  const sorted: Record<CounterField, string[]> = {
    name: [],
    max: [],
    reset: [],
    value: [],
    other: [],
  };
  for (const error of errors) {
    const match = LABELS.find(([prefix]) => error.startsWith(prefix));
    if (match) sorted[match[1]].push(match[2] + error.slice(match[0].length - 1));
    else sorted.other.push(error);
  }
  return sorted;
}
