import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import counterText from './widgets/fixtures/counter.json?raw';
import checklistText from './widgets/fixtures/checklist.json?raw';
import hpText from './widgets/fixtures/hp-counter.json?raw';
import { STORAGE_KEY } from './board/storage';
import { SPELLS_KEY } from './spells/store';
import App from './App.vue';

// Tests use invented spells only: the bundled SRD data is swapped for the fixture spells.
vi.mock('./spells/data/srd-spells.json', async () => ({
  default: JSON.parse((await import('./spells/fixtures/invented-spells.json?raw')).default),
}));

beforeEach(() => {
  localStorage.clear();
  history.replaceState(null, '', '/');
});

async function add(wrapper: VueWrapper, text: string) {
  await wrapper.get('textarea[aria-label="Widget spec"]').setValue(text);
  await wrapper.get('button.add').trigger('click');
}

const undoButton = (wrapper: VueWrapper) => wrapper.get('button.undo');

const button = (wrapper: VueWrapper, label: string) =>
  wrapper
    .findAll('button')
    .find((b) => b.text() === label || b.attributes('aria-label') === label)!;

describe('App', () => {
  it('starts empty with the spec box, the rest buttons and a disabled Undo', () => {
    const wrapper = mount(App);
    expect(wrapper.get('h1').text()).toBe('lanternbook');
    expect(wrapper.findAll('.widget')).toHaveLength(0);
    expect(undoButton(wrapper).attributes('disabled')).toBeDefined();
    expect(undoButton(wrapper).text()).toBe('Undo');
    expect(button(wrapper, 'Short rest').exists()).toBe(true);
    expect(button(wrapper, 'Long rest').exists()).toBe(true);
  });

  it('adds both example widgets from pasted specs and clears the box', async () => {
    const wrapper = mount(App);
    await add(wrapper, counterText);
    await add(wrapper, checklistText);
    const widgets = wrapper.findAll('.widget');
    expect(widgets.map((w) => w.get('h2').text())).toStrictEqual([
      'Lantern oil flasks',
      'Before we leave town',
    ]);
    expect(widgets[0]!.get('.counter-value').text()).toBe('3 / 3');
    expect(widgets[1]!.findAll('input[type="checkbox"]')).toHaveLength(3);
    expect(
      (wrapper.get('textarea[aria-label="Widget spec"]').element as HTMLTextAreaElement).value,
    ).toBe('');
  });

  it('shows readable errors for a bad spec, adds nothing and keeps the text', async () => {
    const wrapper = mount(App);
    const bad = counterText.replace('"counter"', '"timer"');
    await add(wrapper, bad);
    expect(wrapper.get('[role="alert"]').text()).toContain(
      'kind must be "counter" or "checklist", not "timer".',
    );
    expect(wrapper.findAll('.widget')).toHaveLength(0);
    expect(
      (wrapper.get('textarea[aria-label="Widget spec"]').element as HTMLTextAreaElement).value,
    ).toBe(bad);
  });

  it('undoes the last add or rest in one tap, including the steps and ticks since', async () => {
    const wrapper = mount(App);
    await add(wrapper, counterText);
    await add(wrapper, checklistText);
    const value = () => wrapper.get('.counter-value').text();
    const ticked = () =>
      wrapper
        .findAll<HTMLInputElement>('.widget input[type="checkbox"]')
        .map((c) => c.element.checked);

    await button(wrapper, 'Decrease Lantern oil flasks').trigger('click');
    await button(wrapper, 'Decrease Lantern oil flasks').trigger('click');
    await wrapper.findAll('.widget input[type="checkbox"]')[0]!.setValue(true);
    expect(value()).toBe('1 / 3');
    await button(wrapper, 'Long rest').trigger('click');
    expect(value()).toBe('3 / 3');
    expect(undoButton(wrapper).text()).toBe('Undo long rest');

    await undoButton(wrapper).trigger('click');
    expect(value()).toBe('1 / 3');
    expect(ticked()).toStrictEqual([true, false, true]);
    expect(undoButton(wrapper).text()).toBe('Undo add: Before we leave town');

    await undoButton(wrapper).trigger('click');
    expect(wrapper.findAll('.widget')).toHaveLength(1);
    expect(value()).toBe('3 / 3');

    await undoButton(wrapper).trigger('click');
    expect(wrapper.findAll('.widget')).toHaveLength(0);
    expect(undoButton(wrapper).attributes('disabled')).toBeDefined();
  });

  it('does not offer Undo for steps and ticks alone', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 1, widgets: [{ ...JSON.parse(counterText), id: 1 }], history: [] }),
    );
    const wrapper = mount(App);
    await button(wrapper, 'Decrease Lantern oil flasks').trigger('click');
    expect(wrapper.get('.counter-value').text()).toBe('2 / 3');
    expect(undoButton(wrapper).attributes('disabled')).toBeDefined();
  });

  it('renders names and items as text, never as HTML', async () => {
    const wrapper = mount(App);
    const name = '<img src=x onerror="alert(1)">';
    await add(
      wrapper,
      JSON.stringify({
        ...JSON.parse(checklistText),
        name,
        items: [{ text: '<b>bold</b>', done: false }],
      }),
    );
    expect(wrapper.find('img').exists()).toBe(false);
    expect(wrapper.find('b').exists()).toBe(false);
    expect(wrapper.get('h2').text()).toBe(name);
    expect(wrapper.get('.widget label').text()).toBe('<b>bold</b>');
  });

  it('saves every change and shows it again after a reload', async () => {
    const first = mount(App);
    await add(first, counterText);
    await button(first, 'Decrease Lantern oil flasks').trigger('click');
    first.unmount();
    const second = mount(App);
    expect(second.get('.counter-value').text()).toBe('2 / 3');
    await undoButton(second).trigger('click');
    expect(second.findAll('.widget')).toHaveLength(0);
  });

  it('starts with a notice instead of crashing when saved data is corrupt', () => {
    localStorage.setItem(STORAGE_KEY, '{"widgets": [');
    const wrapper = mount(App);
    expect(wrapper.get('h1').text()).toBe('lanternbook');
    expect(wrapper.get('[role="status"]').text()).toContain("Saved widgets couldn't be read");
    expect(wrapper.findAll('.widget')).toHaveLength(0);
  });
});

describe('App tabs', () => {
  const tab = (wrapper: VueWrapper, label: string) =>
    wrapper.findAll('[role="tab"]').find((t) => t.text() === label)!;

  it('opens on the board, with a Spells tab beside it', () => {
    const wrapper = mount(App);
    expect(tab(wrapper, 'Board').attributes('aria-selected')).toBe('true');
    expect(tab(wrapper, 'Spells').attributes('aria-selected')).toBe('false');
    expect(wrapper.find('.spell-view').exists()).toBe(false);
  });

  it('switches to the spell view and back, keeping the board', async () => {
    const wrapper = mount(App);
    await add(wrapper, counterText);
    await tab(wrapper, 'Spells').trigger('click');
    await vi.dynamicImportSettled();
    await flushPromises();
    expect(wrapper.find('.spell-view').exists()).toBe(true);
    expect(wrapper.findAll('.spell-card').length).toBeGreaterThan(0);
    expect(location.hash).toBe('#spells');
    await tab(wrapper, 'Board').trigger('click');
    expect(wrapper.findAll('.widget')).toHaveLength(1);
    expect(location.hash).toBe('');
  });

  it('opens straight on the spell view from a #spells link', async () => {
    history.replaceState(null, '', '/#spells');
    const wrapper = mount(App);
    await vi.dynamicImportSettled();
    await flushPromises();
    expect(tab(wrapper, 'Spells').attributes('aria-selected')).toBe('true');
    expect(wrapper.find('.spell-view').exists()).toBe(true);
  });
});

describe('sidebar', () => {
  const tab = (wrapper: VueWrapper, label: string) =>
    wrapper.findAll('[role="tab"]').find((t) => t.text() === label)!;
  const sidebar = (wrapper: VueWrapper) => wrapper.get('aside.sidebar');
  const hpValue = (wrapper: VueWrapper) =>
    sidebar(wrapper)
      .findAll('.widget')
      .find((w) => w.get('h2').text() === 'Hit points')!
      .get('.counter-value')
      .text();
  async function hit(wrapper: VueWrapper, change: 'Damage' | 'Heal', amount: string) {
    await wrapper.get('input[aria-label="Amount for Hit points"]').setValue(amount);
    await button(wrapper, `${change} Hit points`).trigger('click');
  }
  const slots = JSON.stringify({
    version: 1,
    kind: 'counter',
    name: 'Level 1 slots',
    value: 4,
    max: 4,
    reset: 'long',
  });
  const wildShape = JSON.stringify({
    version: 1,
    kind: 'counter',
    name: 'Wild Shape uses',
    value: 2,
    max: 2,
    reset: 'short',
  });

  it('holds the widgets, rests and Undo beside both tabs', async () => {
    const wrapper = mount(App);
    await add(wrapper, hpText);
    for (const label of ['Board', 'Spells']) {
      await tab(wrapper, label).trigger('click');
      await vi.dynamicImportSettled();
      await flushPromises();
      expect(
        sidebar(wrapper)
          .findAll('.widget')
          .map((w) => w.get('h2').text()),
      ).toStrictEqual(['Hit points']);
      expect(sidebar(wrapper).find('button.undo').exists()).toBe(true);
      expect(
        sidebar(wrapper)
          .findAll('button')
          .some((b) => b.text() === 'Long rest'),
      ).toBe(true);
      expect(sidebar(wrapper).find('input[aria-label="Amount for Hit points"]').exists()).toBe(
        true,
      );
    }
    expect(wrapper.find('.spell-view').exists()).toBe(true);
  });

  it('applies typed damage and healing, clamped to 0 and max, each undoable', async () => {
    const wrapper = mount(App);
    await add(wrapper, hpText);
    await hit(wrapper, 'Damage', '7');
    expect(hpValue(wrapper)).toBe('20 / 27');
    expect(undoButton(wrapper).text()).toBe('Undo damage 7: Hit points');
    await hit(wrapper, 'Heal', '30');
    expect(hpValue(wrapper)).toBe('27 / 27');
    await hit(wrapper, 'Damage', '999');
    expect(hpValue(wrapper)).toBe('0 / 27');
    await undoButton(wrapper).trigger('click');
    expect(hpValue(wrapper)).toBe('27 / 27');
    await undoButton(wrapper).trigger('click');
    expect(hpValue(wrapper)).toBe('20 / 27');
    await button(wrapper, 'Decrease Hit points').trigger('click');
    expect(hpValue(wrapper)).toBe('19 / 27');
  });

  it.each(['abc', '-3', '2.5', ''])('refuses the amount %j with a message', async (amount) => {
    const wrapper = mount(App);
    await add(wrapper, hpText);
    await hit(wrapper, 'Damage', amount);
    expect(sidebar(wrapper).get('[role="alert"]').text()).toBe(
      'Type a whole number from 0 to 999.',
    );
    expect(hpValue(wrapper)).toBe('27 / 27');
  });

  it('shows Damage and Heal only on counters marked as hit points', async () => {
    const wrapper = mount(App);
    await add(wrapper, slots);
    expect(sidebar(wrapper).find('input[aria-label^="Amount for"]').exists()).toBe(false);
  });

  it('refills slots and resources by their reset on short and long rests', async () => {
    const wrapper = mount(App);
    await add(wrapper, slots);
    await add(wrapper, wildShape);
    for (const name of ['Level 1 slots', 'Wild Shape uses']) {
      await button(wrapper, `Decrease ${name}`).trigger('click');
    }
    const values = () =>
      sidebar(wrapper)
        .findAll('.counter-value')
        .map((v) => v.text());
    expect(values()).toStrictEqual(['3 / 4', '1 / 2']);
    await button(wrapper, 'Short rest').trigger('click');
    expect(values()).toStrictEqual(['3 / 4', '2 / 2']);
    await button(wrapper, 'Long rest').trigger('click');
    expect(values()).toStrictEqual(['4 / 4', '2 / 2']);
  });

  it('keeps pasted prepared spells as the Prepared list, reporting names not found', async () => {
    const wrapper = mount(App);
    await wrapper
      .get('textarea[aria-label="Prepared spell names"]')
      .setValue('pebble count\nNot A Spell\nLantern Hum');
    await wrapper.get('button.save-prepared').trigger('click');
    await vi.dynamicImportSettled();
    await flushPromises();
    const prepared = sidebar(wrapper).get('.prepared');
    expect(prepared.findAll('button.prepared-spell').map((b) => b.text())).toStrictEqual([
      'pebble count',
      'Lantern Hum',
    ]);
    expect(prepared.get('.prepared-unmatched').text()).toBe(
      'Not found in the SRD or your private spells: Not A Spell',
    );
    expect(JSON.parse(localStorage.getItem(SPELLS_KEY)!).classLists).toStrictEqual({
      Prepared: ['pebble count', 'Not A Spell', 'Lantern Hum'],
    });
  });

  it('opens the card of the prepared spell that is clicked', async () => {
    const wrapper = mount(App);
    await wrapper
      .get('textarea[aria-label="Prepared spell names"]')
      .setValue('Lantern Hum\nPebble Count');
    await wrapper.get('button.save-prepared').trigger('click');
    await vi.dynamicImportSettled();
    await flushPromises();
    const spellButton = (name: string) =>
      sidebar(wrapper)
        .findAll('button.prepared-spell')
        .find((b) => b.text() === name)!;
    await spellButton('Pebble Count').trigger('click');
    await vi.dynamicImportSettled();
    await flushPromises();
    expect(tab(wrapper, 'Spells').attributes('aria-selected')).toBe('true');
    expect(wrapper.findAll('.spell-card h2').map((h) => h.text())).toStrictEqual(['Pebble Count']);
    await spellButton('Lantern Hum').trigger('click');
    await flushPromises();
    expect(wrapper.findAll('.spell-card h2').map((h) => h.text())).toStrictEqual(['Lantern Hum']);
    await wrapper.get('button.show-all').trigger('click');
    expect(wrapper.findAll('.spell-card').length).toBe(5);
  });

  it('starts with notices instead of crashing when both stores hold corrupt data', async () => {
    localStorage.setItem(STORAGE_KEY, '{"widgets": [');
    localStorage.setItem(SPELLS_KEY, '{"spells": [');
    const wrapper = mount(App);
    await flushPromises();
    const notices = wrapper.findAll('[role="status"]').map((n) => n.text());
    expect(notices.some((n) => n.includes("Saved widgets couldn't be read"))).toBe(true);
    expect(notices.some((n) => n.includes("Saved private spells couldn't be read"))).toBe(true);
    expect(sidebar(wrapper).findAll('.widget')).toHaveLength(0);
    expect(sidebar(wrapper).findAll('button.prepared-spell')).toHaveLength(0);
  });

  it('shows temp HP, says which temp HP was kept, and takes damage off it first', async () => {
    const wrapper = mount(App);
    await add(wrapper, hpText);
    const temp = () => sidebar(wrapper).get('.temp-value').text();
    const gain = async (amount: string) => {
      await wrapper.get('input[aria-label="Temp HP amount for Hit points"]').setValue(amount);
      await button(wrapper, 'Gain temp HP for Hit points').trigger('click');
    };
    expect(temp()).toBe('Temp HP: 0');
    await gain('8');
    expect(temp()).toBe('Temp HP: 8');
    expect(sidebar(wrapper).get('.temp-message').text()).toBe('Gained 8 temp HP.');
    expect(undoButton(wrapper).text()).toBe('Undo temp HP 8: Hit points');
    await gain('5');
    expect(sidebar(wrapper).get('.temp-message').text()).toBe(
      'Kept 8 temp HP: the old 8 is higher than the new 5.',
    );
    await hit(wrapper, 'Damage', '10');
    expect(temp()).toBe('Temp HP: 0');
    expect(hpValue(wrapper)).toBe('25 / 27');
    await gain('-2');
    expect(sidebar(wrapper).get('[role="alert"]').text()).toBe(
      'Type a whole number from 0 to 999.',
    );
    await gain('4');
    await button(wrapper, 'Long rest').trigger('click');
    expect(temp()).toBe('Temp HP: 0');
    expect(hpValue(wrapper)).toBe('27 / 27');
  });

  it('adds a spell prepared from its card to the sidebar, without an undo snapshot', async () => {
    const wrapper = mount(App);
    await add(wrapper, hpText);
    const undoBefore = undoButton(wrapper).text();
    await tab(wrapper, 'Spells').trigger('click');
    await vi.dynamicImportSettled();
    await flushPromises();
    const card = wrapper.findAll('.spell-card').find((c) => c.get('h2').text() === 'Moth Ladder')!;
    await card.get('button.prepare').trigger('click');
    await flushPromises();
    expect(
      sidebar(wrapper)
        .findAll('button.prepared-spell')
        .map((b) => b.text()),
    ).toStrictEqual(['Moth Ladder']);
    expect(
      (wrapper.get('textarea[aria-label="Prepared spell names"]').element as HTMLTextAreaElement)
        .value,
    ).toBe('Moth Ladder');
    expect(undoButton(wrapper).text()).toBe(undoBefore);
  });
});

describe('New counter form', () => {
  async function fill(
    wrapper: VueWrapper,
    fields: { name?: string; max?: string; reset?: string; start?: string; hp?: boolean },
  ) {
    const form = wrapper.get('form.new-counter');
    if (fields.name !== undefined) await form.get('input[name="name"]').setValue(fields.name);
    if (fields.max !== undefined) await form.get('input[name="max"]').setValue(fields.max);
    if (fields.reset !== undefined) await form.get('select[name="reset"]').setValue(fields.reset);
    if (fields.start !== undefined) await form.get('input[name="start"]').setValue(fields.start);
    if (fields.hp !== undefined) await form.get('input[name="hp"]').setValue(fields.hp);
    await form.trigger('submit');
  }
  const widgets = (wrapper: VueWrapper) => wrapper.get('aside.sidebar').findAll('.widget');

  it('adds a counter with an undo snapshot, as pasting does, and clears the form', async () => {
    const wrapper = mount(App);
    await fill(wrapper, { name: 'Wild Shape uses', max: '2', reset: 'short' });
    expect(widgets(wrapper).map((w) => w.get('h2').text())).toStrictEqual(['Wild Shape uses']);
    expect(widgets(wrapper)[0]!.get('.counter-value').text()).toBe('2 / 2');
    expect(undoButton(wrapper).text()).toBe('Undo add: Wild Shape uses');
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!).widgets;
    expect(stored).toStrictEqual([
      {
        version: 1,
        kind: 'counter',
        name: 'Wild Shape uses',
        value: 2,
        max: 2,
        reset: 'short',
        id: 1,
      },
    ]);
    expect((wrapper.get('input[name="name"]').element as HTMLInputElement).value).toBe('');
  });

  it('makes a hit points counter when HP is ticked', async () => {
    const wrapper = mount(App);
    await fill(wrapper, { name: 'Hit points', max: '27', reset: 'long', start: '27', hp: true });
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).widgets).toStrictEqual([
      { ...JSON.parse(hpText), id: 1 },
    ]);
    expect(wrapper.find('input[aria-label="Amount for Hit points"]').exists()).toBe(true);
  });

  it('shows plain messages next to the fields and adds nothing when the form is wrong', async () => {
    const wrapper = mount(App);
    await fill(wrapper, { name: ' ', max: 'lots', reset: 'long', start: '3' });
    const form = wrapper.get('form.new-counter');
    expect(form.get('#new-counter-name-error').text()).toBe('Name must not be empty.');
    expect(form.get('#new-counter-max-error').text()).toBe(
      'Max must be a whole number from 1 to 999.',
    );
    expect(form.get('input[name="max"]').attributes('aria-describedby')).toBe(
      'new-counter-max-error',
    );
    expect(widgets(wrapper)).toHaveLength(0);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    await fill(wrapper, { name: 'Ki', max: '3', start: '9' });
    expect(form.get('#new-counter-value-error').text()).toBe(
      'Starting value must be a whole number from 0 to max (3).',
    );
    expect(widgets(wrapper)).toHaveLength(0);
  });

  it('keeps the paste box under an Advanced heading', () => {
    const wrapper = mount(App);
    const headings = wrapper.findAll('main h2').map((h) => h.text());
    expect(headings).toContain('New counter');
    expect(headings).toContain('Advanced: paste a spec');
    expect(wrapper.find('textarea[aria-label="Widget spec"]').exists()).toBe(true);
  });
});
