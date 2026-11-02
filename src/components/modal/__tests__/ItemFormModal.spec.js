import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
const fixture = vi.hoisted(() => ({
  loadPrivateImage: vi.fn(),
  request: vi.fn(),
  prepareImage: vi.fn(),
  removeBackground: vi.fn()
}));
vi.mock('@/services/aiGateway', async importOriginal => {
  const original = await importOriginal();
  return { ...original, aiGateway: { ...original.aiGateway, loadPrivateImage: fixture.loadPrivateImage } };
});
vi.mock('@/services/commerce', async importOriginal => ({
  ...await importOriginal(),
  commerceClient: { request: fixture.request }
}));
vi.mock('@/services/clothingMedia', async importOriginal => ({
  ...await importOriginal(),
  prepareClothingImage: fixture.prepareImage
}));
vi.mock('@/services/clothingCutout', async importOriginal => ({
  ...await importOriginal(),
  removeClothingBackground: fixture.removeBackground
}));
vi.mock('@/services/colorDetection', async importOriginal => ({
  ...await importOriginal(),
  analyzeImageColor: vi.fn(async () => null)
}));
import ItemFormModal from '../ItemFormModal.vue';
import { useAppStore } from '@/stores/app';
import { useClosetStore, CLOSET_DATA_MODE } from '@/stores/closet';
import { useAuthStore } from '@/stores/auth';
import { SERVICE_ERROR_CODE, ServiceError } from '@/services/serviceError';
import { aiGateway } from '@/services/aiGateway';

describe('ItemFormModal remote write confirmation', () => {
  const itemId = '87654321-4321-4234-8234-123456789abc';
  let wrapper;

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
    fixture.loadPrivateImage.mockReset().mockResolvedValue('blob:private-product');
    fixture.request.mockReset().mockResolvedValue({ product: { state: 'purchased' } });
    fixture.prepareImage.mockReset().mockImplementation(async file => ({
      displayBlob: new Blob(['prepared'], { type: 'image/jpeg' }),
      width: 120,
      height: 160,
      originalBytes: file.size,
      warnings: []
    }));
    fixture.removeBackground.mockReset().mockResolvedValue(null);
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = null;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('initializes existing item values when first mounted after opening', () => {
    openRemoteEditForm();
    wrapper = mount(ItemFormModal);
    expect(wrapper.find('#name').element.value).toBe('Remote shirt');
    wrapper.unmount();
  });

  it('keeps the remote edit form open when the database update fails', async () => {
    const { appStore, closetStore } = openRemoteEditForm();
    vi.spyOn(closetStore, 'updateItem').mockResolvedValue({
      ok: false,
      error: new ServiceError(SERVICE_ERROR_CODE.REMOTE_WRITE_FAILED)
    });
    wrapper = mount(ItemFormModal);

    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(appStore.isItemFormOpen).toBe(true);
  });

  it('closes the remote edit form only after the database update succeeds', async () => {
    const { appStore, closetStore } = openRemoteEditForm();
    vi.spyOn(closetStore, 'updateItem').mockResolvedValue({ ok: true, data: appStore.items[0] });
    wrapper = mount(ItemFormModal);

    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(appStore.isItemFormOpen).toBe(false);
  });

  it('prevents a duplicate submit while the first remote save is pending', async () => {
    const { closetStore } = openRemoteEditForm();
    let resolveSave;
    const pendingSave = new Promise((resolve) => { resolveSave = resolve; });
    const update = vi.spyOn(closetStore, 'updateItem').mockReturnValue(pendingSave);
    wrapper = mount(ItemFormModal);

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
    wrapper = mount(ItemFormModal);

    expect(wrapper.find('.capture-guide').exists()).toBe(true);
    expect(wrapper.text()).toContain('整件入鏡');

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

  it('imports a wishlist product through the remote image and wardrobe flow', async () => {
    const appStore = useAppStore();
    const closetStore = useClosetStore();
    const authStore = useAuthStore();
    const productId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const profileId = '12345678-1234-4234-8234-123456789abc';
    authStore.session = { access_token: 'member-token' };
    authStore.profileIdentity = { status: 'PROFILE_READY', profileId, profile: { id: profileId } };
    closetStore.dataMode = CLOSET_DATA_MODE.REMOTE;
    appStore.wishlistProducts = [{ id: productId, title: 'Linen blouse', category: 'upper_body', color: '#b5d6f3', image_path: 'shop/member/blouse.jpg' }];
    appStore.itemFormSourceProduct = { ...appStore.wishlistProducts[0], ownerProfileId: profileId };
    appStore.isItemFormOpen = true;
    const addItem = vi.spyOn(closetStore, 'addItem').mockResolvedValue({ ok: true, data: { id: productId } });
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      blob: async () => new Blob(['private'], { type: 'image/jpeg' })
    })));
    const NativeURL = URL;
    class TestURL extends NativeURL {}
    TestURL.createObjectURL = vi.fn(() => 'blob:prepared-preview');
    TestURL.revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', TestURL);
    wrapper = mount(ItemFormModal, { global: { stubs: { GarmentCleanup: true } } });

    await flushPromises();
    expect(wrapper.find('#name').element.value).toBe('Linen blouse');
    expect(wrapper.find('#category').element.value).toBe('Tops');
    expect(aiGateway.loadPrivateImage).toHaveBeenCalledWith('member-token', 'shop/member/blouse.jpg');
    expect(fixture.prepareImage).toHaveBeenCalledTimes(1);
    expect(wrapper.find('.upload-preview').exists()).toBe(true);

    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(addItem).toHaveBeenCalledWith(expect.objectContaining({
      id: productId,
      name: 'Linen blouse',
      name_zh: 'Linen blouse',
      category: 'Tops',
      color_hex: '#b5d6f3',
      __preparedMedia: expect.any(Object)
    }));
    expect(fixture.request).toHaveBeenCalledWith(`products/${productId}/state`, 'member-token', { state: 'purchased' });
    expect(appStore.wishlistProducts).toHaveLength(0);
    expect(appStore.isItemFormOpen).toBe(false);
  });
});
