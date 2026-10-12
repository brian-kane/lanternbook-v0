// Pre-commit stage: run the tests related to staged source files. Unlike `vitest related`
// alone, this fails when source files are staged and no related test ran.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const staged = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], {
  encoding: 'utf8',
})
  .split('\n')
  .filter(Boolean);

const sources = staged.filter((f) => /^src\/.*\.(ts|vue)$/.test(f) && !f.endsWith('.d.ts'));
if (sources.length === 0) {
  console.log('related tests: no source files staged, nothing to run');
  process.exit(0);
}

const dir = mkdtempSync(join(tmpdir(), 'related-tests-'));
const out = join(dir, 'results.json');
try {
  const run = spawnSync(
    'pnpm',
    [
      'exec',
      'vitest',
      'related',
      '--run',
      '--reporter=json',
      `--outputFile.json=${out}`,
      ...sources,
    ],
    { stdio: ['ignore', 'inherit', 'inherit'] },
  );
  if (run.status !== 0) {
    console.error('related tests: vitest failed');
    process.exit(run.status ?? 1);
  }
  let total = 0;
  try {
    total = JSON.parse(readFileSync(out, 'utf8')).numTotalTests ?? 0;
  } catch {
    console.error('related tests: vitest wrote no readable result file');
    process.exit(1);
  }
  if (total === 0) {
    console.error(
      `related tests: no related tests found for staged files:\n  ${sources.join('\n  ')}`,
    );
    process.exit(1);
  }
  console.log(`related tests: ${total} tests passed for ${sources.length} staged source files`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
