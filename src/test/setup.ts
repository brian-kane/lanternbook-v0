import { afterEach, beforeEach } from 'vitest';
import {
  clockJumpMessage,
  installNetworkGuard,
  readClocks,
  removeNetworkGuard,
  takeNetworkViolations,
  type ClockReading,
} from './guards';

let started: ClockReading | null = null;

beforeEach(() => {
  installNetworkGuard();
  started = readClocks();
});

afterEach(() => {
  const finished = readClocks();
  removeNetworkGuard();
  const used = takeNetworkViolations();
  if (used.length > 0) {
    throw new Error(
      `Network access is not allowed in unit tests: used ${[...new Set(used)].join(', ')}`,
    );
  }
  if (started) {
    const message = clockJumpMessage(started, finished);
    if (message) throw new Error(message);
  }
});
