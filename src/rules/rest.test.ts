import { describe, expect, it } from 'vitest';
import casesText from './fixtures/rest-cases.json?raw';
import { applyRest, type RestKind } from './rest';
import type { Widget } from '../widgets/spec';

interface RestCase {
  description: string;
  rest: RestKind;
  before: Widget[];
  after: Widget[];
}

const cases: RestCase[] = JSON.parse(casesText);

describe('applyRest (golden fixtures in fixtures/rest-cases.json)', () => {
  it('loads the fixtures', () => {
    expect(cases.length).toBeGreaterThanOrEqual(4);
  });

  it.each(cases.map((c) => [c.description, c] as const))('%s', (_, c) => {
    const before = structuredClone(c.before);
    expect(applyRest(before, c.rest)).toStrictEqual(c.after);
    expect(before).toStrictEqual(c.before);
  });
});
