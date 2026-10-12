import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import App from './App.vue';

describe('App', () => {
  it('shows the app name and the lantern counter', () => {
    const wrapper = mount(App);
    expect(wrapper.get('h1').text()).toBe('lanternbook');
    expect(wrapper.get('button').text()).toBe('Lanterns lit: 0');
  });
});
