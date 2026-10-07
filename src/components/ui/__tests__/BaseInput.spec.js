import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import BaseInput from '../BaseInput.vue';

describe('BaseInput', () => {
  it('associates labels and errors with the input', () => {
    const wrapper = mount(BaseInput, {
      props: { id: 'email', label: 'Email', error: '格式錯誤', modelValue: '' }
    });
    expect(wrapper.get('label').attributes('for')).toBe('email');
    expect(wrapper.get('input').attributes('aria-invalid')).toBe('true');
    expect(wrapper.get('input').attributes('aria-describedby')).toContain('email-error');
  });
});
