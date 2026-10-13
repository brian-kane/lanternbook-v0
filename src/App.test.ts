import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import counterText from './widgets/fixtures/counter.json?raw';
import checklistText from './widgets/fixtures/checklist.json?raw';
import { STORAGE_KEY } from './board/storage';
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
    expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe('');
  });

  it('shows readable errors for a bad spec, adds nothing and keeps the text', async () => {
    const wrapper = mount(App);
    const bad = counterText.replace('"counter"', '"timer"');
    await add(wrapper, bad);
    expect(wrapper.get('[role="alert"]').text()).toContain(
      'kind must be "counter" or "checklist", not "timer".',
    );
    expect(wrapper.findAll('.widget')).toHaveLength(0);
    expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe(bad);
  });

  it('undoes the last add or rest in one tap, including the steps and ticks since', async () => {
    const wrapper = mount(App);
    await add(wrapper, counterText);
    await add(wrapper, checklistText);
    const value = () => wrapper.get('.counter-value').text();
    const ticked = () =>
      wrapper.findAll<HTMLInputElement>('input[type="checkbox"]').map((c) => c.element.checked);

    await button(wrapper, 'Decrease Lantern oil flasks').trigger('click');
    await button(wrapper, 'Decrease Lantern oil flasks').trigger('click');
    await wrapper.findAll('input[type="checkbox"]')[0]!.setValue(true);
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
