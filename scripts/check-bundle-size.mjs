// Measures the JavaScript that dist/index.html actually loads at startup (script tags and
// modulepreload links, gzipped) and compares it with the ceiling in perf-budget.json.
// Measuring a file-name pattern such as index-*.js instead would drift from what loads.
import { reportError } from './ci-annotate.mjs';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

function fail(message) {
  reportError(`perf budget: ${message}`);
  process.exit(1);
}

const distDir = 'dist';
const htmlPath = join(distDir, 'index.html');
if (!existsSync(htmlPath)) fail(`${htmlPath} missing; run the build first`);

const budget = JSON.parse(readFileSync('perf-budget.json', 'utf8')).startupJsGzipKiB;
if (typeof budget !== 'number' || !(budget > 0))
  fail('perf-budget.json has no positive startupJsGzipKiB');

const html = readFileSync(htmlPath, 'utf8');
const urls = new Set();
for (const m of html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)) urls.add(m[1]);
for (const m of html.matchAll(/<link\b[^>]*\brel="modulepreload"[^>]*\bhref="([^"]+)"/g))
  urls.add(m[1]);
const local = [...urls].filter((u) => !/^https?:\/\//.test(u));
if (local.length === 0) fail('index.html loads no local scripts; nothing to measure');

let bytes = 0;
for (const url of local) {
  const file = join(distDir, url.replace(/^\//, ''));
  if (!existsSync(file)) fail(`index.html references ${url} but ${file} is missing`);
  const gz = gzipSync(readFileSync(file)).length;
  console.log(`  ${url}: ${(gz / 1024).toFixed(1)} KiB gzip`);
  bytes += gz;
}
const kib = bytes / 1024;
console.log(
  `perf budget: ${local.length} startup scripts, ${kib.toFixed(1)} KiB gzip, ceiling ${budget} KiB`,
);
if (kib > budget)
  fail(`startup JavaScript is ${kib.toFixed(1)} KiB gzip, over the ${budget} KiB ceiling`);
