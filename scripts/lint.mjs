// ESLint over the whole repo via the API, so a run that matched no files fails instead of passing.
import { reportError } from './ci-annotate.mjs';
import { ESLint } from 'eslint';

const eslint = new ESLint({ warnIgnored: false });
const results = await eslint.lintFiles(['.']);

const errors = results.reduce((n, r) => n + r.errorCount + r.fatalErrorCount, 0);
const warnings = results.reduce((n, r) => n + r.warningCount, 0);

if (results.length === 0) {
  reportError('lint: ESLint matched no files; refusing to pass');
  process.exit(1);
}

const formatter = await eslint.loadFormatter('stylish');
const text = await formatter.format(results);
if (text) console.log(text);
console.log(`lint: ${results.length} files checked, ${errors} errors, ${warnings} warnings`);
if (errors > 0 || warnings > 0) {
  reportError(`lint: ${errors} errors and ${warnings} warnings`);
  process.exit(1);
}
