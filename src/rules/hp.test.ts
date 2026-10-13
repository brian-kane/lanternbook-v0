import { describe, expect, it } from 'vitest';
import casesText from './fixtures/hp-cases.json?raw';
import { damage, gainTemp, heal, parseAmount, restTemp, type HpState } from './hp';
import type { RestKind } from './rest';

type Case = {
  description: string;
  before: HpState;
  op: 'damage' | 'heal' | 'gainTemp' | 'rest';
  amount?: number;
  rest?: RestKind;
  kept?: 'old' | 'new' | 'same';
  message?: string;
  after: HpState;
};
const golden: { cases: Case[]; amounts: { text: string; amount?: number; error?: string }[] } =
  JSON.parse(casesText);

function run(c: Case): HpState {
  if (c.op === 'damage') return damage(c.before, c.amount!);
  if (c.op === 'heal') return heal(c.before, c.amount!);
  if (c.op === 'rest') return restTemp(c.before, c.rest!);
  return gainTemp(c.before, c.amount!).state;
}

describe('temp HP rule (golden cases)', () => {
  it('has golden cases', () => {
    expect(golden.cases.length).toBeGreaterThanOrEqual(18);
  });

  it.each(golden.cases.map((c) => [c.description, c] as const))('%s', (_, c) => {
    const before = structuredClone(c.before);
    expect(run(c)).toStrictEqual(c.after);
    expect(c.before).toStrictEqual(before);
    expect(c.after.max).toBe(c.before.max);
  });

  it.each(golden.cases.filter((c) => c.op === 'gainTemp').map((c) => [c.description, c] as const))(
    'says which temp HP was kept: %s',
    (_, c) => {
      const result = gainTemp(c.before, c.amount!);
      expect(result.kept).toBe(c.kept);
      expect(result.message).toBe(c.message);
    },
  );
});

describe('parseAmount (golden cases)', () => {
  it.each(golden.amounts.map((a) => [a.text, a] as const))('%j', (text, a) => {
    expect(parseAmount(text)).toStrictEqual(
      a.error === undefined ? { ok: true, amount: a.amount } : { ok: false, error: a.error },
    );
  });
});
