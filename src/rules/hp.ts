// The hit point rule, and its only home: damage, healing, temp HP and what a rest does to temp HP.
// Golden cases: fixtures/hp-cases.json.
// - Damage comes off temp HP first; the rest reduces current HP, which stops at 0.
// - Healing raises current HP up to max and never restores temp HP.
// - Temp HP does not stack: gaining keeps the higher of the old and the new amount.
// - A long rest clears temp HP; a short rest does not. Nothing here changes max HP.
import type { RestKind } from './rest';

export interface HpState {
  value: number;
  max: number;
  temp: number;
}

/** The largest amount typed in one go. */
export const MAX_AMOUNT = 999;

export function damage(state: HpState, amount: number): HpState {
  const absorbed = Math.min(state.temp, amount);
  const value = Math.max(0, state.value - (amount - absorbed));
  return { ...state, value, temp: state.temp - absorbed };
}

export function heal(state: HpState, amount: number): HpState {
  return { ...state, value: Math.min(state.max, state.value + amount) };
}

export type TempKept = 'old' | 'new' | 'same';

export function gainTemp(
  state: HpState,
  amount: number,
): { state: HpState; kept: TempKept; message: string } {
  const old = state.temp;
  if (amount === old) {
    return { state, kept: 'same', message: `Kept ${old} temp HP: the new amount is the same.` };
  }
  if (amount < old) {
    const message = `Kept ${old} temp HP: the old ${old} is higher than the new ${amount}.`;
    return { state, kept: 'old', message };
  }
  const message =
    old === 0
      ? `Gained ${amount} temp HP.`
      : `Now ${amount} temp HP: the new ${amount} is higher than the old ${old}.`;
  return { state: { ...state, temp: amount }, kept: 'new', message };
}

/** What a rest does to temp HP. Refilling current HP is the counter's reset rule (rest.ts). */
export function restTemp(state: HpState, rest: RestKind): HpState {
  return rest === 'long' ? { ...state, temp: 0 } : state;
}

/** Reads a typed amount: a whole number from 0 to MAX_AMOUNT, digits only. */
export function parseAmount(
  text: string,
): { ok: true; amount: number } | { ok: false; error: string } {
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed) || Number(trimmed) > MAX_AMOUNT) {
    return { ok: false, error: `Type a whole number from 0 to ${MAX_AMOUNT}.` };
  }
  return { ok: true, amount: Number(trimmed) };
}
