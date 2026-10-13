import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import inventedText from '../spells/fixtures/invented-spells.json?raw';
import { SPELLS_BACKUP_KEY, SPELLS_KEY } from '../spells/store';
import noticeText from '../../NOTICE?raw';
import SpellView from './SpellView.vue';

// Tests use invented spells only: the bundled SRD data is swapped for the fixture spells.
vi.mock('../spells/data/srd-spells.json', async () => ({
  default: JSON.parse((await import('../spells/fixtures/invented-spells.json?raw')).default),
}));

const invented = JSON.parse(inventedText);
const privateSpell = {
  ...invented[0],
  name: 'Quiet Kettle',
  text: 'Invented for lanternbook tests. A kettle stops whistling.',
  classes: [],
};

beforeEach(() => {
  localStorage.clear();
});

async function open(): Promise<VueWrapper> {
  const wrapper = mount(SpellView);
  await vi.dynamicImportSettled();
  await flushPromises();
  return wrapper;
}

const names = (wrapper: VueWrapper) => wrapper.findAll('.spell-card h2').map((h) => h.text());
const count = (wrapper: VueWrapper) => wrapper.get('.result-count').text();

async function pasteSpell(wrapper: VueWrapper, text: string) {
  await wrapper.get('textarea[aria-label="Spell spec"]').setValue(text);
  await wrapper.get('button.add-spell').trigger('click');
}

describe('SpellView', () => {
  it('lists every bundled spell by level, then name, once the data has loaded', async () => {
    const wrapper = await open();
    expect(names(wrapper)).toStrictEqual([
      'Lantern Hum',
      'Ash Whistle',
      'Pebble Count',
      "Won't Stay Lit",
      'Moth Ladder',
    ]);
    expect(count(wrapper)).toBe('5 spells');
  });

  it('shows a card with the header fields, classes and text', async () => {
    const wrapper = await open();
    const card = wrapper.findAll('.spell-card')[2]!;
    expect(card.get('h2').text()).toBe('Pebble Count');
    expect(card.get('.spell-type').text()).toBe('1st-level divination (ritual)');
    expect(card.get('.casting-time').text()).toBe('10 minutes');
    expect(card.get('.range').text()).toBe('Self');
    expect(card.get('.components').text()).toBe('V, S, M (a pebble)');
    expect(card.get('.duration').text()).toBe('Instantaneous');
    expect(card.get('.classes').text()).toBe('Druid');
    expect(card.get('.spell-text').text()).toContain('A second paragraph keeps its line break.');
    expect(wrapper.findAll('.spell-card')[0]!.get('.spell-type').text()).toBe('Illusion cantrip');
  });

  it('filters by name, level, school and class together', async () => {
    const wrapper = await open();
    await wrapper.get('input[type="search"]').setValue('la');
    expect(names(wrapper)).toStrictEqual(['Lantern Hum', 'Moth Ladder']);
    await wrapper.get('select[aria-label="Level"]').setValue('9');
    expect(names(wrapper)).toStrictEqual(['Moth Ladder']);
    await wrapper.get('select[aria-label="Level"]').setValue('');
    await wrapper.get('input[type="search"]').setValue('');
    await wrapper.get('select[aria-label="School"]').setValue('conjuration');
    expect(names(wrapper)).toStrictEqual(['Moth Ladder']);
    await wrapper.get('select[aria-label="School"]').setValue('');
    await wrapper.get('select[aria-label="Class"]').setValue('wizard');
    expect(names(wrapper)).toStrictEqual(['Lantern Hum', "Won't Stay Lit"]);
    expect(count(wrapper)).toBe('2 spells');
  });

  it('says when nothing matches', async () => {
    const wrapper = await open();
    await wrapper.get('input[type="search"]').setValue('zzz');
    expect(names(wrapper)).toStrictEqual([]);
    expect(count(wrapper)).toBe('No spells match.');
  });

  it('adds a pasted private spell, tagged private and saved only in browser storage', async () => {
    const wrapper = await open();
    await pasteSpell(wrapper, JSON.stringify(privateSpell));
    const card = wrapper.findAll('.spell-card').find((c) => c.get('h2').text() === 'Quiet Kettle')!;
    expect(card.get('.private-tag').text()).toBe('Private');
    expect(wrapper.findAll('.private-tag')).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem(SPELLS_KEY)!).spells).toStrictEqual([privateSpell]);
    expect(
      (wrapper.get('textarea[aria-label="Spell spec"]').element as HTMLTextAreaElement).value,
    ).toBe('');
  });

  it('shows readable errors for a bad pasted spell and keeps the text', async () => {
    const wrapper = await open();
    const bad = JSON.stringify({ ...privateSpell, level: 10 });
    await pasteSpell(wrapper, bad);
    expect(wrapper.get('[role="alert"]').text()).toContain(
      'level must be a whole number from 0 (cantrip) to 9.',
    );
    expect(localStorage.getItem(SPELLS_KEY)).toBeNull();
    expect(
      (wrapper.get('textarea[aria-label="Spell spec"]').element as HTMLTextAreaElement).value,
    ).toBe(bad);
  });

  it('removes a private spell', async () => {
    const wrapper = await open();
    await pasteSpell(wrapper, JSON.stringify(privateSpell));
    await wrapper.get('button[aria-label="Remove private spell Quiet Kettle"]').trigger('click');
    expect(names(wrapper)).not.toContain('Quiet Kettle');
    expect(JSON.parse(localStorage.getItem(SPELLS_KEY)!).spells).toStrictEqual([]);
  });

  it('adds a private class list to the class filter, and removes it', async () => {
    const wrapper = await open();
    await wrapper.get('input[aria-label="Class name"]').setValue('Artificer');
    await wrapper.get('textarea[aria-label="Spell names"]').setValue('moth ladder\nAsh Whistle');
    await wrapper.get('button.save-class-list').trigger('click');
    const options = wrapper
      .get('select[aria-label="Class"]')
      .findAll('option')
      .map((o) => o.text());
    expect(options).toContain('Artificer (private list)');
    await wrapper.get('select[aria-label="Class"]').setValue('Artificer');
    expect(names(wrapper)).toStrictEqual(['Ash Whistle', 'Moth Ladder']);
    expect(JSON.parse(localStorage.getItem(SPELLS_KEY)!).classLists).toStrictEqual({
      Artificer: ['moth ladder', 'Ash Whistle'],
    });
    await wrapper.get('button[aria-label="Remove class list Artificer"]').trigger('click');
    expect(JSON.parse(localStorage.getItem(SPELLS_KEY)!).classLists).toStrictEqual({});
  });

  it('renders pasted text as text, never as HTML', async () => {
    const wrapper = await open();
    const name = '<img src=x onerror="alert(1)">';
    await pasteSpell(wrapper, JSON.stringify({ ...privateSpell, name, text: '<b>bold</b>' }));
    expect(wrapper.find('.spell-card img').exists()).toBe(false);
    expect(wrapper.find('.spell-card b').exists()).toBe(false);
    expect(names(wrapper)).toContain(name);
  });

  it('starts with a notice and a backup instead of crashing when private data is corrupt', async () => {
    localStorage.setItem(SPELLS_KEY, '{"spells": [');
    const wrapper = await open();
    expect(wrapper.get('[role="status"]').text()).toContain(
      "Saved private spells couldn't be read",
    );
    expect(localStorage.getItem(SPELLS_BACKUP_KEY)).toBe('{"spells": [');
    expect(names(wrapper)).toHaveLength(5);
  });

  it('shows the SRD 5.1 attribution statement in its footer, as the SRD asks', async () => {
    const wrapper = await open();
    expect(wrapper.get('footer.attribution').text()).toBe(
      'This work includes material taken from the System Reference Document 5.1 (“SRD 5.1”) by Wizards of the Coast LLC and available at https://dnd.wizards.com/resources/systems-reference-document. The SRD 5.1 is licensed under the Creative Commons Attribution 4.0 International License available at https://creativecommons.org/licenses/by/4.0/legalcode.',
    );
  });

  it('uses the same attribution statement as NOTICE, apart from the quote marks', async () => {
    const wrapper = await open();
    const statement = noticeText.split('\n\n')[0]!.replace(/\s+/g, ' ').trim();
    const shown = wrapper.get('footer.attribution').text().replace(/[“”]/g, '"');
    expect(shown).toBe(statement);
  });

  it('makes a class the SRD does not cover filterable from a pasted list, and reports unmatched names', async () => {
    const wrapper = await open();
    await pasteSpell(wrapper, JSON.stringify(privateSpell));
    await wrapper.get('input[aria-label="Class name"]').setValue('Artificer');
    await wrapper
      .get('textarea[aria-label="Spell names"]')
      .setValue('moth ladder\nQuiet Kettle\nNot A Spell\nAsh Whistle\nAlso Missing');
    await wrapper.get('button.save-class-list').trigger('click');

    await wrapper.get('select[aria-label="Class"]').setValue('Artificer');
    expect(names(wrapper)).toStrictEqual(['Quiet Kettle', 'Ash Whistle', 'Moth Ladder']);
    expect(wrapper.get('.class-list-unmatched').text()).toBe(
      'Not found in the SRD or your private spells: Not A Spell, Also Missing',
    );
  });

  it('starts with no private spells or class lists, and a notice, when private data is corrupt', async () => {
    localStorage.setItem(SPELLS_KEY, '{"version": 1, "spells": [], "classLists": {"Artificer": [');
    const wrapper = await open();
    expect(wrapper.get('[role="status"]').text()).toContain(
      "Saved private spells couldn't be read",
    );
    const options = wrapper
      .get('select[aria-label="Class"]')
      .findAll('option')
      .map((o) => o.text());
    expect(options.some((o) => o.includes('private list'))).toBe(false);
    expect(wrapper.findAll('.private-tag')).toHaveLength(0);
    expect(localStorage.getItem(SPELLS_BACKUP_KEY)).toContain('Artificer');
  });
});
