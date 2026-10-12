// Reads the Vitest JSON and coverage summary written by `pnpm test:ci` and fails on empty results.
import { reportError } from './ci-annotate.mjs';
import { existsSync, readFileSync } from 'node:fs';

function fail(message) {
  reportError(`test report: ${message}`);
  process.exit(1);
}

const resultsPath = 'coverage/test-results.json';
const summaryPath = 'coverage/coverage-summary.json';
if (!existsSync(resultsPath)) fail(`${resultsPath} missing`);
if (!existsSync(summaryPath)) fail(`${summaryPath} missing`);

const results = JSON.parse(readFileSync(resultsPath, 'utf8'));
const total = results.numTotalTests ?? 0;
const passed = results.numPassedTests ?? 0;
if (total === 0) fail('zero tests ran');
if (passed !== total || results.success !== true)
  fail(`${total - passed} of ${total} tests did not pass`);

const summary = JSON.parse(readFileSync(summaryPath, 'utf8')).total;
if (!summary || !summary.lines || summary.lines.total === 0)
  fail('coverage report covers zero lines');
const files = Object.keys(JSON.parse(readFileSync(summaryPath, 'utf8'))).filter(
  (k) => k !== 'total',
);
if (files.length === 0) fail('coverage report lists no files');

console.log(
  `test report: ${passed} tests passed in ${results.numTotalTestSuites} suites; coverage over ${files.length} files, ` +
    `${summary.lines.covered}/${summary.lines.total} lines (${summary.lines.pct}%). No threshold set yet.`,
);
