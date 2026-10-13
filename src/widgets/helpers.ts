// Validation helpers shared by the widget and spell validators. Every rejection is a sentence.

export type Json = Record<string, unknown>;

export const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const isWholeIn = (value: unknown, min: number, max: number): value is number =>
  Number.isInteger(value) && (value as number) >= min && (value as number) <= max;

export function checkText(value: unknown, label: string, cap: number, errors: string[]) {
  if (typeof value !== 'string') errors.push(`${label} must be text.`);
  else if (value.trim() === '') errors.push(`${label} must not be empty.`);
  else if (value.length > cap) errors.push(`${label} is longer than ${cap} characters.`);
}

/** Pushes one message per key that is not in the allowed list. */
export function checkFields(value: Json, allowed: readonly string[], errors: string[]) {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) errors.push(`unknown field "${key}".`);
  }
}

/** Checks the version field the same way for every kind of spec. */
export function checkVersion(value: Json, version: number, errors: string[]) {
  if (!('version' in value)) errors.push(`version is missing; this app reads version ${version}.`);
  else if (value.version !== version) {
    errors.push(
      `version ${JSON.stringify(value.version)} is not supported; this app reads version ${version}.`,
    );
  }
}

/** Parses pasted JSON text, turning size and syntax failures into one message each. */
export function parsePasted(
  text: string,
  cap: number,
  messages: { empty: string; tooLong: string },
): { ok: true; value: unknown } | { ok: false; errors: string[] } {
  if (text.trim() === '') return { ok: false, errors: [messages.empty] };
  if (text.length > cap) {
    return { ok: false, errors: [messages.tooLong] };
  }
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return {
      ok: false,
      errors: ['That is not valid JSON. Check for missing quotes, commas or brackets.'],
    };
  }
}
