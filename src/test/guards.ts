// Guards that turn environment problems into loud test failures.

const CLOCK_TOLERANCE_MS = 1000;

export interface ClockReading {
  wall: number;
  mono: number;
}

export function readClocks(): ClockReading {
  return { wall: Date.now(), mono: performance.now() };
}

/** Returns the failure message if the wall clock and the monotonic clock disagree by more than the tolerance. */
export function clockJumpMessage(start: ClockReading, end: ClockReading): string | null {
  const wallElapsed = end.wall - start.wall;
  const monoElapsed = end.mono - start.mono;
  if (Math.abs(wallElapsed - monoElapsed) <= CLOCK_TOLERANCE_MS) return null;
  const seconds = ((wallElapsed - monoElapsed) / 1000).toFixed(1);
  return `System clock jumped by ${seconds}s during this test; environment problem, not a code failure`;
}

const NETWORK_GLOBALS = ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource'] as const;

type Slot = Record<string, unknown>;

const violations: string[] = [];
let saved: Map<string, PropertyDescriptor | undefined> | null = null;

function forbidden(name: string) {
  const message = `Network access is not allowed in unit tests: ${name} was used`;
  const stub = function (): never {
    violations.push(name);
    throw new Error(message);
  };
  return stub;
}

export function installNetworkGuard(): void {
  const target = globalThis as unknown as Slot;
  saved = new Map();
  violations.length = 0;
  for (const name of NETWORK_GLOBALS) {
    saved.set(name, Object.getOwnPropertyDescriptor(target, name));
    Object.defineProperty(target, name, {
      value: forbidden(name),
      configurable: true,
      writable: true,
    });
  }
}

export function removeNetworkGuard(): void {
  const target = globalThis as unknown as Slot;
  for (const [name, descriptor] of saved ?? []) {
    if (descriptor) Object.defineProperty(target, name, descriptor);
    else delete target[name];
  }
  saved = null;
}

/** Returns and clears recorded violations. Only the guard's own tests should call this. */
export function takeNetworkViolations(): string[] {
  return violations.splice(0, violations.length);
}
