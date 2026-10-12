import { describe, expect, it } from 'vitest';
import { clockJumpMessage, takeNetworkViolations } from './guards';

describe('clock guard', () => {
  it('accepts clocks that advance together', () => {
    expect(clockJumpMessage({ wall: 1000, mono: 10 }, { wall: 1500, mono: 510 })).toBeNull();
  });

  it('reports a wall clock jump with the documented message', () => {
    const message = clockJumpMessage({ wall: 1000, mono: 10 }, { wall: 75_000, mono: 510 });
    expect(message).toBe(
      'System clock jumped by 73.5s during this test; environment problem, not a code failure',
    );
  });
});

describe('network guard', () => {
  it.each(['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource'] as const)(
    'blocks %s and records the attempt',
    (name) => {
      const use = () => {
        const g = globalThis as unknown as Record<string, (...args: unknown[]) => unknown>;
        return g[name]?.('http://localhost/');
      };
      expect(use).toThrow(/Network access is not allowed/);
      expect(takeNetworkViolations()).toEqual([name]);
    },
  );
});
