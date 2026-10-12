import { describe, expect, it } from 'vitest';

describe('main', () => {
  it('mounts the app into #app', async () => {
    document.body.innerHTML = '<div id="app"></div>';
    await import('./main');
    expect(document.querySelector('#app h1')?.textContent).toBe('lanternbook');
  });
});
