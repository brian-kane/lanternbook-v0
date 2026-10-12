// Runs the real .husky/pre-commit in a temporary git repo with stubbed tools and asserts that
// every stage blocks a bad commit. A hook that silently stops running is the failure this guards.
import { execFileSync, spawnSync } from 'node:child_process';
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const root = process.cwd();
const tmp = mkdtempSync(join(tmpdir(), 'hook-check-'));
const repo = join(tmp, 'repo');
const stubs = join(tmp, 'stubs');
const home = join(tmp, 'home');
const log = join(tmp, 'calls.log');
const problems = [];

mkdirSync(repo);
mkdirSync(stubs);
mkdirSync(home);

function stub(name, body) {
  const file = join(stubs, name);
  writeFileSync(file, `#!/bin/sh\n${body}\n`);
  chmodSync(file, 0o755);
}

stub(
  'gitleaks',
  `echo "gitleaks $*" >> "$HOOKLOG"
[ "\${STUB_FAIL:-}" = gitleaks ] && { echo "stub gitleaks: leak found" >&2; exit 1; }
exit 0`,
);
stub(
  'pnpm',
  `echo "pnpm $*" >> "$HOOKLOG"
case "$*" in
  "exec lint-staged") stage=lint-staged ;;
  "typecheck") stage=typecheck ;;
  "exec vitest related"*) stage=vitest ;;
  *) echo "stub pnpm: unexpected call: $*" >&2; exit 99 ;;
esac
if [ "\${STUB_FAIL:-}" = "$stage" ]; then echo "stub $stage: failed" >&2; exit 1; fi
if [ "$stage" = vitest ]; then
  for a in "$@"; do case "$a" in --outputFile.json=*) out="\${a#--outputFile.json=}" ;; esac; done
  echo "{\\"numTotalTests\\": \${STUB_TESTS:-1}}" > "$out"
fi
exit 0`,
);

function git(...args) {
  return execFileSync('git', args, { cwd: repo, encoding: 'utf8', env: baseEnv() });
}
function baseEnv(extra = {}) {
  return {
    PATH: `${stubs}:${dirname(process.execPath)}:/usr/bin:/bin`,
    HOME: home,
    HOOKLOG: log,
    GIT_CONFIG_NOSYSTEM: '1',
    ...extra,
  };
}

git('init', '-q', '-b', 'main');
git('config', 'user.name', 'hook-check');
git('config', 'user.email', 'hook-check@example.invalid');
git('config', 'commit.gpgsign', 'false');
mkdirSync(join(repo, '.husky'));
mkdirSync(join(repo, 'scripts/hooks'), { recursive: true });
copyFileSync(join(root, '.husky/pre-commit'), join(repo, '.husky/pre-commit'));
chmodSync(join(repo, '.husky/pre-commit'), 0o755);
copyFileSync(
  join(root, 'scripts/hooks/related-tests.mjs'),
  join(repo, 'scripts/hooks/related-tests.mjs'),
);
git('config', 'core.hooksPath', '.husky');
git('add', '-A');
git('commit', '-q', '--no-verify', '-m', 'seed');

let n = 0;
function scenario(
  name,
  { stage, tests, files, removeGitleaks },
  expectBlocked,
  expectCalls,
  expectStderr,
) {
  n += 1;
  rmSync(log, { force: true });
  for (const [file, text] of Object.entries(
    files ?? { 'src/a.ts': `export const a${n} = ${n};\n` },
  )) {
    mkdirSync(dirname(join(repo, file)), { recursive: true });
    writeFileSync(join(repo, file), text);
  }
  git('add', '-A');
  if (removeGitleaks) rmSync(join(stubs, 'gitleaks'), { force: true });
  const env = baseEnv({
    ...(stage ? { STUB_FAIL: stage } : {}),
    ...(tests !== undefined ? { STUB_TESTS: String(tests) } : {}),
  });
  const run = spawnSync('git', ['commit', '-q', '-m', `scenario ${n}`], {
    cwd: repo,
    encoding: 'utf8',
    env,
  });
  const blocked = run.status !== 0;
  const calls = existsSync(log) ? readFileSync(log, 'utf8').split('\n').filter(Boolean) : [];
  const ok = (cond, what) => {
    if (!cond)
      problems.push(
        `${name}: ${what}\n    calls: ${JSON.stringify(calls)}\n    stderr: ${run.stderr.trim()}`,
      );
  };
  ok(
    blocked === expectBlocked,
    expectBlocked
      ? 'commit was NOT blocked'
      : `commit was blocked unexpectedly (exit ${run.status})`,
  );
  for (const [i, want] of expectCalls.entries())
    ok(calls[i]?.includes(want), `call ${i} should include "${want}"`);
  ok(
    calls.length === expectCalls.length,
    `expected ${expectCalls.length} tool calls, saw ${calls.length}`,
  );
  if (expectStderr)
    ok(run.stderr.includes(expectStderr), `stderr should mention "${expectStderr}"`);
  if (blocked) {
    git('reset', '-q', '--hard', 'HEAD');
    git('clean', '-fdq');
  }
  if (removeGitleaks) stub('gitleaks', 'echo "gitleaks $*" >> "$HOOKLOG"\nexit 0');
  console.log(`${blocked === expectBlocked ? 'ok  ' : 'FAIL'} ${name}`);
}

const all = ['gitleaks', 'lint-staged', 'typecheck', 'vitest related'];
scenario('passes when every stage passes and runs all four', {}, false, [
  'gitleaks git --pre-commit --staged',
  'pnpm exec lint-staged',
  'pnpm typecheck',
  'pnpm exec vitest related',
]);
scenario(
  'vitest related receives the staged source file',
  {},
  false,
  all.map((s) => s.replace(/^gitleaks$/, 'gitleaks git')),
);
scenario(
  'gitleaks failure blocks the commit before later stages',
  { stage: 'gitleaks' },
  true,
  ['gitleaks'],
  'leak found',
);
scenario('lint-staged failure blocks the commit', { stage: 'lint-staged' }, true, [
  'gitleaks',
  'pnpm exec lint-staged',
]);
scenario('typecheck failure blocks the commit', { stage: 'typecheck' }, true, [
  'gitleaks',
  'pnpm exec lint-staged',
  'pnpm typecheck',
]);
scenario('vitest failure blocks the commit', { stage: 'vitest' }, true, [
  'gitleaks',
  'pnpm exec lint-staged',
  'pnpm typecheck',
  'pnpm exec vitest related',
]);
scenario(
  'zero related tests blocks the commit even when vitest exits 0',
  { tests: 0 },
  true,
  ['gitleaks', 'pnpm exec lint-staged', 'pnpm typecheck', 'pnpm exec vitest related'],
  'no related tests found',
);
scenario(
  'missing gitleaks blocks the commit and points at scripts/setup.sh',
  { removeGitleaks: true },
  true,
  [],
  'scripts/setup.sh',
);
scenario(
  'docs-only commit skips related tests but still runs the other stages',
  { files: { 'notes.md': '# notes\n' }, tests: 0 },
  false,
  ['gitleaks', 'pnpm exec lint-staged', 'pnpm typecheck'],
);

// The staged file must actually reach vitest.
{
  rmSync(log, { force: true });
  mkdirSync(join(repo, 'src'), { recursive: true });
  writeFileSync(join(repo, 'src/target.ts'), 'export const t = 1;\n');
  git('add', '-A');
  spawnSync('git', ['commit', '-q', '-m', 'target'], {
    cwd: repo,
    encoding: 'utf8',
    env: baseEnv(),
  });
  const calls = readFileSync(log, 'utf8');
  if (!/vitest related .*src\/target\.ts/.test(calls))
    problems.push(`staged file did not reach vitest related:\n${calls}`);
  else console.log('ok   staged source file path is passed to vitest related');
}

rmSync(tmp, { recursive: true, force: true });
if (problems.length > 0) {
  console.error(`\nhook check: ${problems.length} problem(s)\n${problems.join('\n')}`);
  process.exit(1);
}
console.log(`hook check: ${n + 1} scenarios passed against the real .husky/pre-commit`);
