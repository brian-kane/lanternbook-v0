// vue-tsc strict typecheck. Fails if the tsconfig selects no source files (a tsconfig with
// "files": [] passes instantly while checking nothing).
import { spawnSync } from 'node:child_process';

function run(args) {
  return spawnSync('pnpm', ['exec', 'vue-tsc', ...args], { encoding: 'utf8' });
}

const listed = run(['--noEmit', '--listFilesOnly']);
if (listed.status !== 0) {
  process.stdout.write(listed.stdout ?? '');
  process.stderr.write(listed.stderr ?? '');
  process.exit(listed.status ?? 1);
}
const sources = listed.stdout
  .split('\n')
  .filter((f) => f.includes('/src/') && !f.includes('node_modules'));
if (sources.length === 0) {
  console.error('typecheck: tsconfig selects no files under src/; refusing to pass');
  process.exit(1);
}

const checked = run(['--noEmit']);
process.stdout.write(checked.stdout ?? '');
process.stderr.write(checked.stderr ?? '');
if (checked.status !== 0) process.exit(checked.status ?? 1);
console.log(`typecheck: ${sources.length} source files checked, no errors`);
