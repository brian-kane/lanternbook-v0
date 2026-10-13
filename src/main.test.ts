import { describe, expect, it } from 'vitest';
import { base } from '../vite.config';

describe('main', () => {
  it('mounts the app into #app', async () => {
    document.body.innerHTML = '<div id="app"></div>';
    await import('./main');
    expect(document.querySelector('#app h1')?.textContent).toBe('lanternbook');
  });

  it('runs under the same base path as dev and the build', () => {
    expect(import.meta.env.BASE_URL).toBe(base);
  });
});
