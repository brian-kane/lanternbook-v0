import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { defineComponent, h, nextTick } from 'vue';
import counterText from '../widgets/fixtures/counter.json?raw';
import WidgetFrame from './WidgetFrame.vue';

const good = { ...JSON.parse(counterText), id: 1 };

function board(widgets: unknown[]) {
  return mount(
    defineComponent({
      render: () => widgets.map((widget) => h(WidgetFrame, { widget: widget as never })),
    }),
  );
}

describe('WidgetFrame', () => {
  it.each([
    [
      'data that breaks rendering',
      { id: 2, version: 1, kind: 'checklist', name: 'Broken', items: null },
    ],
    ['an unknown kind', { id: 2, version: 1, kind: 'timer', name: 'Odd' }],
  ])('shows a placeholder for %s and still renders its neighbours', async (_, bad) => {
    const wrapper = board([good, bad, { ...good, id: 3 }]);
    await nextTick();
    const frames = wrapper.findAll('.widget');
    expect(frames).toHaveLength(3);
    expect(frames[0]!.get('.counter-value').text()).toBe('3 / 3');
    expect(frames[1]!.text()).toContain("This widget couldn't be shown.");
    expect(frames[2]!.get('.counter-value').text()).toBe('3 / 3');
  });
});
