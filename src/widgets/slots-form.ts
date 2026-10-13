// The Spell slots form: one max per spell level, one Refills choice for all. Each filled level
// becomes the same counter spec pasting would give ("Level N slots", starting full), checked by
// the same validator. No class or level tables: the person types the maxes.
import { whole } from './counter-form';
import { LIMITS, validateSpec, type WidgetSpec } from './spec';

export const SLOT_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

export interface SlotsForm {
  /** One entry per level in SLOT_LEVELS; blank skips that level. */
  maxes: string[];
  reset: string;
}

export interface SlotsResult {
  /** What to add, as one undo step. Empty whenever any row or the form has an error. */
  specs: WidgetSpec[];
  rowErrors: Record<number, string[]>;
  /** Levels left out because a counter with that name already exists. */
  skipped: Record<number, string>;
  formErrors: string[];
}

export const slotName = (level: number) => `Level ${level} slots`;

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export function checkSlots(form: SlotsForm, existingNames: readonly string[]): SlotsResult {
  const result: SlotsResult = { specs: [], rowErrors: {}, skipped: {}, formErrors: [] };
  if (form.reset !== 'short' && form.reset !== 'long') {
    result.formErrors.push('Choose whether the slots refill on a short or a long rest.');
  }
  const filled = SLOT_LEVELS.filter((_, i) => (form.maxes[i] ?? '').trim() !== '');
  if (filled.length === 0) result.formErrors.push('Fill in a max for at least one spell level.');

  const specs: WidgetSpec[] = [];
  for (const level of filled) {
    const max = whole(form.maxes[level - 1]!);
    const spec = {
      version: 1,
      kind: 'counter',
      name: slotName(level),
      // Slots start full; while max itself is wrong, only max gets a message.
      value: Number.isInteger(max) && (max as number) <= LIMITS.max ? max : 0,
      max,
      reset: form.reset === 'short' ? 'short' : 'long',
    };
    const checked = validateSpec(spec);
    if (!checked.ok) {
      result.rowErrors[level] = checked.errors.map((e) =>
        e.startsWith('max ') ? `Max${e.slice(3)}` : e,
      );
    } else if (existingNames.some((name) => sameName(name, slotName(level)))) {
      result.skipped[level] =
        `You already have a counter named “${slotName(level)}”, so nothing was added for level ${level}.`;
    } else specs.push(checked.spec);
  }
  const anyErrors = result.formErrors.length > 0 || Object.keys(result.rowErrors).length > 0;
  result.specs = anyErrors ? [] : specs;
  return result;
}
