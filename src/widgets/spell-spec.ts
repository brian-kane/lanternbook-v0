// Spell specs: one spell as JSON, either from the bundled SRD 5.1 data or pasted by the person.
// Same rules as widget specs: hand-written validation, every rejection a sentence. Example:
// docs/SPELLS.md.
import {
  checkFields,
  checkText,
  checkVersion,
  isObject,
  isWholeIn,
  parsePasted,
  type Json,
} from './helpers';

export const SPELL_SPEC_VERSION = 1;

// Each cap is well above the longest SRD 5.1 value (text: 3,781 characters, Prismatic Wall).
export const SPELL_LIMITS = {
  name: 60,
  castingTime: 160,
  range: 80,
  components: 400,
  duration: 80,
  text: 6000,
  classes: 20,
  className: 40,
  specText: 10000,
} as const;

export const SCHOOLS = [
  'abjuration',
  'conjuration',
  'divination',
  'enchantment',
  'evocation',
  'illusion',
  'necromancy',
  'transmutation',
] as const;

export type School = (typeof SCHOOLS)[number];

export interface SpellSpec {
  version: typeof SPELL_SPEC_VERSION;
  kind: 'spell';
  name: string;
  level: number;
  school: School;
  ritual: boolean;
  castingTime: string;
  range: string;
  components: string;
  duration: string;
  text: string;
  classes: string[];
}

export type SpellResult = { ok: true; spell: SpellSpec } | { ok: false; errors: string[] };

const FIELDS = [
  'version',
  'kind',
  'name',
  'level',
  'school',
  'ritual',
  'castingTime',
  'range',
  'components',
  'duration',
  'text',
  'classes',
] as const;

const TEXT_FIELDS = ['name', 'castingTime', 'range', 'components', 'duration', 'text'] as const;

function checkClasses(classes: unknown, errors: string[]) {
  if (!Array.isArray(classes)) {
    errors.push('classes must be a list.');
    return;
  }
  if (classes.length > SPELL_LIMITS.classes) {
    errors.push(`classes must have at most ${SPELL_LIMITS.classes} entries.`);
  }
  classes.forEach((value: unknown, i) =>
    checkText(value, `class ${i + 1}`, SPELL_LIMITS.className, errors),
  );
}

function check(value: unknown): string[] {
  if (!isObject(value)) return ['A spell spec must be a JSON object, like the example.'];
  const errors: string[] = [];
  checkVersion(value, SPELL_SPEC_VERSION, errors);
  if (value.kind !== 'spell') {
    errors.push(
      value.kind === undefined
        ? 'kind is missing; use "spell".'
        : `kind must be "spell", not ${JSON.stringify(value.kind)}.`,
    );
  }
  for (const field of TEXT_FIELDS) checkText(value[field], field, SPELL_LIMITS[field], errors);
  if (!isWholeIn(value.level, 0, 9)) {
    errors.push('level must be a whole number from 0 (cantrip) to 9.');
  }
  if (!(SCHOOLS as readonly unknown[]).includes(value.school)) {
    errors.push(`school must be one of ${SCHOOLS.join(', ')}.`);
  }
  if (typeof value.ritual !== 'boolean') errors.push('ritual must be true or false.');
  checkClasses(value.classes, errors);
  checkFields(value, FIELDS, errors);
  return errors;
}

/** Copies only the known fields, so nothing outside the spec rides along. */
function copy(value: Json): SpellSpec {
  const spell = Object.fromEntries(FIELDS.map((field) => [field, value[field]]));
  return { ...spell, classes: [...(value.classes as string[])] } as SpellSpec;
}

export function validateSpell(value: unknown): SpellResult {
  const errors = check(value);
  return errors.length > 0 ? { ok: false, errors } : { ok: true, spell: copy(value as Json) };
}

/** Parses pasted text into a spell, turning every failure into a message for the person. */
export function parseSpellText(text: string): SpellResult {
  const parsed = parsePasted(text, SPELL_LIMITS.specText, {
    empty: 'Paste a spell spec first.',
    tooLong: `That spell spec is too long (over ${SPELL_LIMITS.specText} characters).`,
  });
  return parsed.ok ? validateSpell(parsed.value) : parsed;
}
