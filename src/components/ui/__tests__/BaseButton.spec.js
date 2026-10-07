import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import BaseButton from '../BaseButton.vue';

describe('BaseButton', () => {
  it('disables interaction and exposes busy state while loading', () => {
    const wrapper = mount(BaseButton, {
      props: { loading: true, ariaLabel: '儲存變更' },
      slots: { default: '儲存' }
    });
    const button = wrapper.get('button');
    expect(button.attributes('disabled')).toBeDefined();
    expect(button.attributes('aria-busy')).toBe('true');
    expect(button.attributes('aria-label')).toBe('儲存變更');
  });
});
