// Reads the base path from vite.config.ts through Vite's own config loader, so the build checks
// use the same value as dev, build and tests. Fails unless it is an absolute path ending in "/".
import { loadConfigFromFile } from 'vite';
import { reportError } from './ci-annotate.mjs';

export async function viteBase(label) {
  const loaded = await loadConfigFromFile({ command: 'build', mode: 'production' });
  const base = loaded?.config.base;
  if (typeof base !== 'string' || !base.startsWith('/') || !base.endsWith('/')) {
    reportError(`${label}: vite.config.ts must set base to an absolute path ending in "/"`);
    process.exit(1);
  }
  return base;
}
