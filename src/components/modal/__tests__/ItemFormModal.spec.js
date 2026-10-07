import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import ItemFormModal from '../ItemFormModal.vue';
import { useAppStore } from '@/stores/app';
import { useClosetStore, CLOSET_DATA_MODE } from '@/stores/closet';
import { SERVICE_ERROR_CODE, ServiceError } from '@/services/serviceError';

describe('ItemFormModal remote write confirmation', () => {
  const itemId = '87654321-4321-4234-8234-123456789abc';

  const openRemoteEditForm = () => {
    const appStore = useAppStore();
    const closetStore = useClosetStore();
    appStore.items = [{
      id: itemId,
      owner_id: '12345678-1234-4234-8234-123456789abc',
      name: 'Remote shirt',
      category: 'Tops'
    }];
    closetStore.dataMode = CLOSET_DATA_MODE.REMOTE;
    appStore.editingItemId = itemId;
    appStore.isItemFormOpen = true;
    return { appStore, closetStore };
  };

  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it('keeps the remote edit form open when the database update fails', async () => {
    const { appStore, closetStore } = openRemoteEditForm();
    vi.spyOn(closetStore, 'updateItem').mockResolvedValue({
      ok: false,
      error: new ServiceError(SERVICE_ERROR_CODE.REMOTE_WRITE_FAILED)
    });
    const wrapper = mount(ItemFormModal);

    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(appStore.isItemFormOpen).toBe(true);
  });

  it('closes the remote edit form only after the database update succeeds', async () => {
    const { appStore, closetStore } = openRemoteEditForm();
    vi.spyOn(closetStore, 'updateItem').mockResolvedValue({ ok: true, data: appStore.items[0] });
    const wrapper = mount(ItemFormModal);

    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(appStore.isItemFormOpen).toBe(false);
  });

  it('prevents a duplicate submit while the first remote save is pending', async () => {
    const { closetStore } = openRemoteEditForm();
    let resolveSave;
    const pendingSave = new Promise((resolve) => { resolveSave = resolve; });
    const update = vi.spyOn(closetStore, 'updateItem').mockReturnValue(pendingSave);
    const wrapper = mount(ItemFormModal);

    await wrapper.find('form').trigger('submit');
    await wrapper.find('form').trigger('submit');
    expect(update).toHaveBeenCalledTimes(1);

    resolveSave({ ok: false, error: new ServiceError(SERVICE_ERROR_CODE.REMOTE_WRITE_FAILED) });
    await flushPromises();
  });

  it('shows the optional capture guide only on the first new-item visit', async () => {
    const appStore = useAppStore();
    appStore.editingItemId = null;
    appStore.isItemFormOpen = true;
    const wrapper = mount(ItemFormModal);

    expect(wrapper.find('.capture-guide').exists()).toBe(true);
    expect(wrapper.text()).toContain('不需要棚拍');

    await wrapper.find('.capture-guide-skip').trigger('click');
    expect(wrapper.find('.capture-guide').exists()).toBe(false);
    expect(localStorage.getItem('ootie:capture-guide-seen:v1')).toBe('true');

    appStore.isItemFormOpen = false;
    await wrapper.vm.$nextTick();
    appStore.isItemFormOpen = true;
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.capture-guide').exists()).toBe(false);
  });

  it('keeps camera and gallery actions connected to real file inputs', () => {
    const appStore = useAppStore();
    appStore.editingItemId = null;
    appStore.isItemFormOpen = true;
    const wrapper = mount(ItemFormModal);

    const fileInputs = wrapper.findAll('input[type="file"]');
    expect(fileInputs).toHaveLength(2);
    expect(fileInputs[0].attributes('capture')).toBeUndefined();
    expect(fileInputs[1].attributes('capture')).toBe('environment');
    expect(wrapper.findAll('.upload-choice-row button')).toHaveLength(2);
  });
});
