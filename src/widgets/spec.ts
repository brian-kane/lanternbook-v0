// Widget specs: the JSON a person pastes to add a widget. Hand-written validation, so every
// rejection reads as a sentence and no runtime dependency is needed. Examples: docs/EXAMPLES.md.

export const SPEC_VERSION = 1;

export const LIMITS = {
  name: 60,
  itemText: 120,
  items: 50,
  max: 999,
  specText: 5000,
} as const;

export type ResetKind = 'short' | 'long' | 'none';

export interface CounterSpec {
  version: typeof SPEC_VERSION;
  kind: 'counter';
  name: string;
  value: number;
  max: number;
  reset: ResetKind;
}

export interface ChecklistItem {
  text: string;
  done: boolean;
}

export interface ChecklistSpec {
  version: typeof SPEC_VERSION;
  kind: 'checklist';
  name: string;
  items: ChecklistItem[];
}

export type WidgetSpec = CounterSpec | ChecklistSpec;

/** A spec once it is on the board. */
export type Widget = WidgetSpec & { id: number };

export type SpecResult = { ok: true; spec: WidgetSpec } | { ok: false; errors: string[] };
export type WidgetResult = { ok: true; widget: Widget } | { ok: false; errors: string[] };

type Json = Record<string, unknown>;

const FIELDS = {
  counter: ['version', 'kind', 'name', 'value', 'max', 'reset'],
  checklist: ['version', 'kind', 'name', 'items'],
} as const;

const RESETS: readonly unknown[] = ['short', 'long', 'none'];

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isWholeIn = (value: unknown, min: number, max: number): value is number =>
  Number.isInteger(value) && (value as number) >= min && (value as number) <= max;

function checkText(value: unknown, label: string, cap: number, errors: string[]) {
  if (typeof value !== 'string') errors.push(`${label} must be text.`);
  else if (value.trim() === '') errors.push(`${label} must not be empty.`);
  else if (value.length > cap) errors.push(`${label} is longer than ${cap} characters.`);
}

function checkItems(items: unknown, errors: string[]) {
  if (!Array.isArray(items)) {
    errors.push('items must be a list.');
    return;
  }
  if (items.length < 1 || items.length > LIMITS.items) {
    errors.push(`items must have between 1 and ${LIMITS.items} entries.`);
  }
  items.forEach((item: unknown, i) => {
    const n = i + 1;
    if (!isObject(item)) {
      errors.push(`item ${n} must be an object with text and done.`);
      return;
    }
    checkText(item.text, `item ${n} text`, LIMITS.itemText, errors);
    if (typeof item.done !== 'boolean') errors.push(`item ${n} done must be true or false.`);
    for (const key of Object.keys(item)) {
      if (key !== 'text' && key !== 'done') errors.push(`item ${n} has an unknown field "${key}".`);
    }
  });
}

function check(value: unknown, extraFields: readonly string[]): string[] {
  if (!isObject(value)) return ['A widget spec must be a JSON object, like the examples.'];
  const errors: string[] = [];

  if (!('version' in value))
    errors.push(`version is missing; this app reads version ${SPEC_VERSION}.`);
  else if (value.version !== SPEC_VERSION) {
    errors.push(
      `version ${JSON.stringify(value.version)} is not supported; this app reads version ${SPEC_VERSION}.`,
    );
  }

  const kind = value.kind;
  if (kind !== 'counter' && kind !== 'checklist') {
    errors.push(
      kind === undefined
        ? 'kind is missing; use "counter" or "checklist".'
        : `kind must be "counter" or "checklist", not ${JSON.stringify(kind)}.`,
    );
    return errors;
  }

  checkText(value.name, 'name', LIMITS.name, errors);

  if (kind === 'counter') {
    const maxOk = isWholeIn(value.max, 1, LIMITS.max);
    if (!maxOk) errors.push(`max must be a whole number from 1 to ${LIMITS.max}.`);
    if (!isWholeIn(value.value, 0, maxOk ? (value.max as number) : LIMITS.max)) {
      errors.push(`value must be a whole number from 0 to max${maxOk ? ` (${value.max})` : ''}.`);
    }
    if (!RESETS.includes(value.reset)) errors.push('reset must be "short", "long" or "none".');
  } else {
    checkItems(value.items, errors);
  }

  const allowed: readonly string[] = [...FIELDS[kind], ...extraFields];
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) errors.push(`unknown field "${key}".`);
  }
  return errors;
}

/** Copies only the known fields, so nothing outside the spec rides along. */
function copy(value: Json): WidgetSpec {
  if (value.kind === 'counter') {
    const { version, kind, name, value: count, max, reset } = value;
    return { version, kind, name, value: count, max, reset } as CounterSpec;
  }
  const items = (value.items as ChecklistItem[]).map(({ text, done }) => ({ text, done }));
  return { version: value.version, kind: 'checklist', name: value.name, items } as ChecklistSpec;
}

export function validateSpec(value: unknown): SpecResult {
  const errors = check(value, []);
  return errors.length > 0 ? { ok: false, errors } : { ok: true, spec: copy(value as Json) };
}

/** Validates a widget read back from storage: a spec plus its board id. */
export function validateWidget(value: unknown): WidgetResult {
  const errors = check(value, ['id']);
  if (isObject(value) && !isWholeIn(value.id, 1, Number.MAX_SAFE_INTEGER)) {
    errors.push('id must be a positive whole number.');
  }
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, widget: { ...copy(value as Json), id: (value as Json).id as number } };
}

/** Parses pasted text into a spec, turning every failure into a message for the person. */
export function parseSpecText(text: string): SpecResult {
  if (text.trim() === '') return { ok: false, errors: ['Paste a widget spec first.'] };
  if (text.length > LIMITS.specText) {
    return { ok: false, errors: [`That spec is too long (over ${LIMITS.specText} characters).`] };
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return {
      ok: false,
      errors: ['That is not valid JSON. Check for missing quotes, commas or brackets.'],
    };
  }
  return validateSpec(value);
}
