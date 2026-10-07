import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import ItemFormModal from '../ItemFormModal.vue';
import { useAppStore } from '@/stores/app';
import { useClosetStore } from '@/stores/closet';
import * as colorDetection from '@/services/colorDetection';
import * as clothingMedia from '@/services/clothingMedia';

describe('ItemForm brand and image intelligence foundations', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setActivePinia(createPinia());
    localStorage.clear();
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:ootie-preview');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  });

  const mockPreparedMedia = () => vi.spyOn(clothingMedia, 'prepareClothingImage').mockResolvedValue({
    originalFile: new File(['image'], 'shirt.png', { type: 'image/png' }),
    displayBlob: new Blob(['display'], { type: 'image/webp' }),
    originalMimeType: 'image/png',
    displayMimeType: 'image/webp',
    originalBytes: 5,
    displayBytes: 7,
    width: 1200,
    height: 1600,
    warnings: [],
    level: 'PASS'
  });

  const openForm = async () => {
    const appStore = useAppStore();
    const wrapper = mount(ItemFormModal);
    appStore.isItemFormOpen = true;
    await wrapper.vm.$nextTick();
    return { appStore, wrapper };
  };

  it('adds a normalized custom brand and exposes it as a shortcut', async () => {
    const { appStore, wrapper } = await openForm();

    await wrapper.find('.favorite-brand-add').trigger('click');
    await wrapper.find('#customBrandName').setValue('  BEAMS  ');
    await wrapper.find('.custom-brand-row .secondary').trigger('click');

    expect(appStore.customBrands).toEqual(['BEAMS']);
    expect(wrapper.findAll('.favorite-brand-option').some((button) => button.text() === 'BEAMS')).toBe(true);
    expect(wrapper.find('#brand').element.value).toBe('BEAMS');
  });

  it('does not add the same custom brand twice and persists it locally', async () => {
    const { appStore, wrapper } = await openForm();

    const addBrand = async (value) => {
      await wrapper.find('.favorite-brand-add').trigger('click');
      await wrapper.find('#customBrandName').setValue(value);
      await wrapper.find('.custom-brand-row .secondary').trigger('click');
    };

    await addBrand('BEAMS');
    await addBrand(' beams ');
    await flushPromises();

    expect(appStore.customBrands).toEqual(['BEAMS']);
    const saved = JSON.parse(localStorage.getItem('weary-app-state-v1'));
    expect(saved.customBrands).toEqual(['BEAMS']);

    setActivePinia(createPinia());
    expect(useAppStore().customBrands).toEqual(['BEAMS']);
  });

  it('applies a local color suggestion while keeping the form editable', async () => {
    vi.spyOn(colorDetection, 'analyzeImageColor').mockResolvedValue({
      primaryColor: '丹寧藍',
      colorFamily: '藍綠冷色系'
    });
    mockPreparedMedia();
    const { appStore, wrapper } = await openForm();
    const photoInput = wrapper.find('#photoFile');
    const file = new File(['image'], 'blue-shirt.png', { type: 'image/png' });
    Object.defineProperty(photoInput.element, 'files', { value: [file] });
    await photoInput.trigger('change');
    await flushPromises();

    expect(wrapper.find('#primary_color').element.value).toBe('丹寧藍');
    expect(wrapper.find('#secondary_color').element.value).toBe('藍綠冷色系');
    expect(wrapper.text()).toContain('圖片主色建議：丹寧藍');
    expect(wrapper.text()).not.toContain('自動去背尚未配置，目前使用原圖。');

    await wrapper.find('#primary_color').setValue('黑色');
    expect(wrapper.find('#primary_color').element.value).toBe('黑色');
    expect(appStore.isItemFormOpen).toBe(true);
  });

  it('keeps the processed local image available and allows submission when color analysis fails', async () => {
    vi.spyOn(colorDetection, 'analyzeImageColor').mockResolvedValue(null);
    mockPreparedMedia();
    vi.spyOn(clothingMedia, 'blobToDataUrl').mockResolvedValue('data:image/webp;base64,processed');
    const { appStore, wrapper } = await openForm();
    const closetStore = useClosetStore();
    vi.spyOn(closetStore, 'addItem').mockResolvedValue({ ok: true, data: {} });
    await wrapper.find('#name').setValue('測試衣物');
    const photoInput = wrapper.find('#photoFile');
    const file = new File(['image'], 'broken-analysis.png', { type: 'image/png' });
    Object.defineProperty(photoInput.element, 'files', { value: [file] });
    await photoInput.trigger('change');
    await flushPromises();
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(closetStore.addItem).toHaveBeenCalledWith(expect.objectContaining({
      photo: 'data:image/webp;base64,processed'
    }));
    expect(appStore.isItemFormOpen).toBe(false);
  });
});
