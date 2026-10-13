// Loads the SRD 5.1 spells on demand. The dynamic import keeps the data out of the startup bundle
// (pnpm perf checks this); the promise is shared, so the data loads at most once.
import type { SpellSpec } from '../widgets/spell-spec';

let loading: Promise<SpellSpec[]> | null = null;

export function loadSrdSpells(): Promise<SpellSpec[]> {
  // Checked by src/spells/content.test.ts, so the data is known to be valid spell specs.
  loading ??= import('./data/srd-spells.json').then((m) => m.default as SpellSpec[]);
  loading.catch(() => (loading = null));
  return loading;
}
