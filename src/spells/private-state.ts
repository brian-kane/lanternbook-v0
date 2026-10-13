// The person's private spells and class lists as reactive state, shared by the sidebar and the
// spell view: App provides one instance, and a view mounted on its own makes its own.
import { inject, ref, shallowRef, type InjectionKey, type Ref, type ShallowRef } from 'vue';
import { privateSpellStore, type PrivateSpells, type PrivateSpellStore } from './store';

export interface PrivateSpellsState {
  data: ShallowRef<PrivateSpells>;
  /** Load and save problems, for the person to read. */
  notice: Ref<string | null>;
  /** Replaces the data and saves it; a failed save becomes the notice. */
  apply(next: PrivateSpells): void;
}

export const PRIVATE_SPELLS: InjectionKey<PrivateSpellsState> = Symbol('private spells');

export function createPrivateSpellsState(
  store: PrivateSpellStore = privateSpellStore(),
): PrivateSpellsState {
  const loaded = store.load();
  const data = shallowRef(loaded.data);
  const notice = ref(loaded.notice);
  return {
    data,
    notice,
    apply(next) {
      data.value = next;
      notice.value = store.save(next) ?? notice.value;
    },
  };
}

/** The shared state when App provides it, otherwise a new one; `shared` says which. */
export function usePrivateSpells(): { state: PrivateSpellsState; shared: boolean } {
  const provided = inject(PRIVATE_SPELLS, null);
  return provided
    ? { state: provided, shared: true }
    : { state: createPrivateSpellsState(), shared: false };
}
