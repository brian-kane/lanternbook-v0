// `pnpm audit --prod`, failing on any advisory and also when it audited no packages.
import { spawnSync } from 'node:child_process';

const run = spawnSync('pnpm', ['audit', '--prod', '--json'], { encoding: 'utf8' });
let report;
try {
  report = JSON.parse(run.stdout);
} catch {
  console.error('audit: could not parse pnpm audit output; the audit did not run');
  console.error(run.stdout);
  console.error(run.stderr);
  process.exit(1);
}

const audited = report.metadata?.dependencies;
if (!(audited > 0)) {
  console.error(
    `audit: pnpm audit reported ${audited} production dependencies; nothing was audited`,
  );
  process.exit(1);
}
const counts = report.metadata?.vulnerabilities ?? {};
const found = Object.values(counts).reduce((n, c) => n + c, 0);
console.log(`audit: ${audited} production dependencies audited, ${found} advisories`);
if (found > 0 || run.status !== 0) {
  console.error(JSON.stringify(counts));
  process.exit(1);
}
