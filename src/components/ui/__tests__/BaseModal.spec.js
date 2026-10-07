import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import BaseModal from '../BaseModal.vue';

describe('BaseModal', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('provides dialog semantics and closes on Escape', async () => {
    const wrapper = mount(BaseModal, {
      attachTo: document.body,
      props: { open: true, titleId: 'dialog-title' },
      slots: { default: '<h2 id="dialog-title">標題</h2><button>動作</button>' }
    });
    const dialog = wrapper.get('[role="dialog"]');
    expect(dialog.attributes('aria-modal')).toBe('true');
    expect(dialog.attributes('aria-labelledby')).toBe('dialog-title');
    await dialog.trigger('keydown', { key: 'Escape' });
    expect(wrapper.emitted('close')).toHaveLength(1);
  });

  it('traps Tab between the first and last controls', async () => {
    const wrapper = mount(BaseModal, {
      attachTo: document.body,
      props: { open: true, ariaLabel: '測試對話框' },
      slots: { default: '<button id="last-action">最後動作</button>' }
    });
    await wrapper.vm.$nextTick();
    const buttons = wrapper.findAll('button');
    buttons.at(-1).element.focus();
    await wrapper.get('[role="dialog"]').trigger('keydown', { key: 'Tab' });
    expect(document.activeElement).toBe(buttons[0].element);
  });

  it('restores focus after close', async () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();
    const wrapper = mount(BaseModal, {
      attachTo: document.body,
      props: { open: false, ariaLabel: '測試對話框' },
      slots: { default: '<button>內容</button>' }
    });
    await wrapper.setProps({ open: true });
    await wrapper.setProps({ open: false });
    await wrapper.vm.$nextTick();
    expect(document.activeElement).toBe(trigger);
  });
});
