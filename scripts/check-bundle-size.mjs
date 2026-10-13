// Measures the JavaScript that dist/index.html actually loads at startup (script tags and
// modulepreload links, gzipped) and compares it with the ceiling in perf-budget.json.
// Measuring a file-name pattern such as index-*.js instead would drift from what loads.
// It also checks that each data file listed under notAtStartup is in some built script but in no
// startup script, so large data stays loaded on demand.
import { reportError } from './ci-annotate.mjs';
import { viteBase } from './vite-base.mjs';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

function fail(message) {
  reportError(`perf budget: ${message}`);
  process.exit(1);
}

const distDir = 'dist';
// Asset URLs in index.html start with the base path; the files sit directly under dist.
const base = await viteBase('perf budget');
const htmlPath = join(distDir, 'index.html');
if (!existsSync(htmlPath)) fail(`${htmlPath} missing; run the build first`);

const config = JSON.parse(readFileSync('perf-budget.json', 'utf8'));
const budget = config.startupJsGzipKiB;
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
const startup = [];
for (const url of local) {
  if (!url.startsWith(base))
    fail(`index.html loads ${url}, which is outside the base path ${base}`);
  const file = join(distDir, url.slice(base.length));
  if (!existsSync(file)) fail(`index.html references ${url} but ${file} is missing`);
  const content = readFileSync(file);
  startup.push(content.toString('utf8'));
  const gz = gzipSync(content).length;
  console.log(`  ${url}: ${(gz / 1024).toFixed(1)} KiB gzip`);
  bytes += gz;
}
const kib = bytes / 1024;
console.log(
  `perf budget: ${local.length} startup scripts, ${kib.toFixed(1)} KiB gzip, ceiling ${budget} KiB`,
);
if (kib > budget)
  fail(`startup JavaScript is ${kib.toFixed(1)} KiB gzip, over the ${budget} KiB ceiling`);

// A run of 40 plain letters and spaces from the data file: bundling leaves such text unescaped.
function sentinel(path) {
  if (!existsSync(path)) fail(`${path} is listed in notAtStartup but is missing`);
  const found = readFileSync(path, 'utf8').match(/[A-Za-z][A-Za-z ]{39}/);
  if (!found) fail(`${path} has no 40-character run of plain text to look for`);
  return found[0];
}

const lazy = config.notAtStartup;
if (!Array.isArray(lazy) || lazy.length === 0)
  fail('perf-budget.json has no notAtStartup list of data files');
const assetsDir = join(distDir, 'assets');
const built = readdirSync(assetsDir)
  .filter((name) => name.endsWith('.js'))
  .map((name) => readFileSync(join(assetsDir, name), 'utf8'));
for (const path of lazy) {
  const text = sentinel(path);
  if (!built.some((js) => js.includes(text)))
    fail(`${path} is in no built script, so this check cannot see where it loads`);
  if (startup.some((js) => js.includes(text)))
    fail(`${path} is bundled into a startup script; load it with a dynamic import() instead`);
}
console.log(`perf budget: ${lazy.length} data file(s) load on demand, not at startup`);
