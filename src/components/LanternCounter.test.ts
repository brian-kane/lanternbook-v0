import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import LanternCounter from './LanternCounter.vue';

describe('LanternCounter', () => {
  it('starts at zero and counts each click', async () => {
    const wrapper = mount(LanternCounter);
    expect(wrapper.text()).toBe('Lanterns lit: 0');

    await wrapper.get('button').trigger('click');
    await wrapper.get('button').trigger('click');

    expect(wrapper.text()).toBe('Lanterns lit: 2');
  });
});
