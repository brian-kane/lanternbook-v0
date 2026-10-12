// Runs Vitest with coverage, then validates the results even when Vitest failed, so the CI
// annotations name the real reason (failing test, zero tests, empty coverage).
import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { reportError } from './ci-annotate.mjs';

rmSync('coverage', { recursive: true, force: true });
const reporters = [
  '--reporter=default',
  '--reporter=json',
  '--outputFile.json=coverage/test-results.json',
];
if (process.env.GITHUB_ACTIONS) reporters.push('--reporter=github-actions');
const vitest = spawnSync('pnpm', ['exec', 'vitest', 'run', '--coverage', ...reporters], {
  stdio: 'inherit',
});
const report = spawnSync('node', ['scripts/check-test-report.mjs'], { stdio: 'inherit' });

if (vitest.status !== 0) reportError(`test: vitest exited with status ${vitest.status}`);
process.exit(vitest.status !== 0 || report.status !== 0 ? 1 : 0);
