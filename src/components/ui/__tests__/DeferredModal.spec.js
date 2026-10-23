import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, onMounted, reactive } from 'vue';
import DeferredModal from '../DeferredModal.vue';

const wrappers = [];
afterEach(() => wrappers.splice(0).forEach(wrapper => wrapper.unmount()));

function modalFixture(initiallyOpen = false) {
  const state = reactive({ open: initiallyOpen });
  const mounted = vi.fn();
  const modal = defineComponent({
    setup() {
      onMounted(mounted);
      return () => state.open ? h('div', { role: 'dialog' }, 'Ready') : null;
    }
  });
  const loader = vi.fn(async () => modal);
  const wrapper = mount(DeferredModal, { props: { active: state.open, loader } });
  wrappers.push(wrapper);
  const setOpen = async (open) => {
    state.open = open;
    await wrapper.setProps({ active: open });
    await flushPromises();
  };
  return { state, mounted, modal, loader, wrapper, setOpen };
}

describe('deferred modal loading', () => {
  it('downloads nothing while closed and preserves the instance across reopening', async () => {
    const { wrapper, loader, mounted, setOpen } = modalFixture();
    await flushPromises();
    expect(loader).not.toHaveBeenCalled();

    await setOpen(true);
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true);
    await setOpen(false);
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    await setOpen(true);
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true);
    expect(loader).toHaveBeenCalledTimes(1);
    expect(mounted).toHaveBeenCalledTimes(1);
  });

  it('opens when the visibility flag was set before the component mounted', async () => {
    const { wrapper, mounted } = modalFixture(true);
    await flushPromises();
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true);
    expect(mounted).toHaveBeenCalledTimes(1);
  });

  it('does not reopen a modal that was closed while its download was pending', async () => {
    let finishDownload;
    const state = reactive({ open: false });
    const loader = vi.fn(() => new Promise(resolve => { finishDownload = resolve; }));
    const wrapper = mount(DeferredModal, { props: { active: false, loader } });
    wrappers.push(wrapper);
    state.open = true;
    await wrapper.setProps({ active: true });
    state.open = false;
    await wrapper.setProps({ active: false });
    finishDownload(defineComponent({ setup: () => () => state.open ? h('div', { role: 'dialog' }) : null }));
    await flushPromises();
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
  });
});
