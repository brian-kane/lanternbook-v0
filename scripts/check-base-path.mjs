// Checks that the built site only refers to URLs under the base path from vite.config.ts: every
// src/href in dist/index.html, the manifest's start_url, scope and icons, and the service worker
// registration. Served from a subpath, anything outside it would 404 or escape the app's scope.
// Fails if it finds nothing to check.
import { reportError } from './ci-annotate.mjs';
import { viteBase } from './vite-base.mjs';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const distDir = 'dist';
const problems = [];
const base = await viteBase('base path');

function read(name) {
  const path = join(distDir, name);
  if (!existsSync(path)) {
    reportError(`base path: ${path} missing; run the build first`);
    process.exit(1);
  }
  return readFileSync(path, 'utf8');
}

const isExternal = (url) => /^(https?:|data:|mailto:|#)/.test(url);

const html = read('index.html');
const urls = [...html.matchAll(/\s(?:src|href)="([^"]*)"/g)]
  .map((m) => m[1])
  .filter((u) => !isExternal(u));
if (urls.length === 0) problems.push('dist/index.html has no local src or href URLs to check');
for (const url of urls) {
  if (!url.startsWith(base)) problems.push(`dist/index.html: ${url} does not start with ${base}`);
}

const manifest = JSON.parse(read('manifest.webmanifest'));
for (const key of ['start_url', 'scope']) {
  if (typeof manifest[key] !== 'string' || !manifest[key].startsWith(base)) {
    problems.push(`manifest ${key} is ${JSON.stringify(manifest[key])}, not under ${base}`);
  }
}
const icons = manifest.icons ?? [];
if (icons.length === 0) problems.push('manifest lists no icons');
for (const icon of icons) {
  // Relative icon URLs resolve against the manifest, which is served from the base path.
  if (icon.src.startsWith('/') && !icon.src.startsWith(base)) {
    problems.push(`manifest icon ${icon.src} does not start with ${base}`);
  }
}

const register = read('registerSW.js');
const sw = register.match(/register\('([^']+)',\s*\{\s*scope:\s*'([^']+)'/);
if (!sw) problems.push('registerSW.js has no service worker registration to check');
else {
  if (!sw[1].startsWith(base)) problems.push(`service worker ${sw[1]} is not under ${base}`);
  if (sw[2] !== base) problems.push(`service worker scope is ${sw[2]}, not ${base}`);
}

if (problems.length > 0) {
  reportError(`base path: ${problems.length} problem(s)\n${problems.join('\n')}`);
  process.exit(1);
}
console.log(
  `base path: ${urls.length} index.html URLs, manifest start_url/scope/${icons.length} icon(s) and the service worker are all under ${base}`,
);
