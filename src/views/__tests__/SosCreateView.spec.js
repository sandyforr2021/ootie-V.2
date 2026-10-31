import { installLocalInteractionFixtures } from '../../../tests/localInteractionFixtures.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createWebHistory } from 'vue-router';
import SosCreateView from '../SosCreateView.vue';
import SosView from '../SosView.vue';
import { useAppStore } from '@/stores/app';
import { useSosStore } from '@/stores/sos';
import { useAuthStore } from '@/stores/auth';
import { useClosetStore } from '@/stores/closet';
import * as ootdMedia from '@/services/ootdMedia';

const createTestRouter = () => createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/sos', name: 'Sos', component: SosView },
    { path: '/sos/create', name: 'SosCreate', component: SosCreateView },
    { path: '/closet', name: 'Closet', component: { template: '<div>Closet</div>' } }
  ]
});

describe('SosCreateView standalone page UX', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    installLocalInteractionFixtures();
    vi.spyOn(useClosetStore(), 'loadRemoteItems').mockResolvedValue({ ok: true });
  });

  it('renders the standalone SOS create page and checks public wardrobe constraint', async () => {
    const router = createTestRouter();
    const appStore = useAppStore();
    const authStore = useAuthStore();
    authStore.user = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' };
    authStore.profileIdentity = { status: 'PROFILE_READY', profileId: '11111111-1111-4111-8111-111111111111', profile: { id: '11111111-1111-4111-8111-111111111111' } };

    appStore.profile.public_closet = false;
    await router.push('/sos/create');
    const wrapper = mount(SosCreateView, { global: { plugins: [router] } });
    await flushPromises();

    expect(wrapper.text()).toContain('請衣友幫忙搭配');
    expect(wrapper.text()).toContain('請先開啟「公開衣櫥」功能，才能發布求救。');
    expect(wrapper.find('button[type="submit"]').element.disabled).toBe(true);

    appStore.profile.public_closet = true;
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain('目前已公開衣櫥，衣友可以從你的衣櫥提供搭配建議。');
    expect(wrapper.find('button[type="submit"]').element.disabled).toBe(false);
  });

  it('allows computer image upload and preview', async () => {
    const router = createTestRouter();
    const appStore = useAppStore();
    const authStore = useAuthStore();
    authStore.user = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' };
    authStore.profileIdentity = { status: 'PROFILE_READY', profileId: '11111111-1111-4111-8111-111111111111', profile: { id: '11111111-1111-4111-8111-111111111111' } };
    appStore.profile.public_closet = true;

    await router.push('/sos/create');
    const wrapper = mount(SosCreateView, { global: { plugins: [router] } });
    await flushPromises();

    const file = new File(['mock'], 'outfit.jpg', { type: 'image/jpeg' });
    const fileInput = wrapper.find('.upload-btn input[type="file"]');
    Object.defineProperty(fileInput.element, 'files', { value: [file] });
    await fileInput.trigger('change');
    await flushPromises();

    expect(wrapper.text()).toContain('outfit.jpg');
    expect(wrapper.text()).toContain('已上傳本機圖片');
    expect(wrapper.find('.sos-cover-preview-card').exists()).toBe(true);
  });

  it('allows selecting an image from wardrobe and replaces selection on choosing another', async () => {
    const router = createTestRouter();
    const appStore = useAppStore();
    const authStore = useAuthStore();
    authStore.user = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' };
    authStore.profileIdentity = { status: 'PROFILE_READY', profileId: '11111111-1111-4111-8111-111111111111', profile: { id: '11111111-1111-4111-8111-111111111111' } };
    appStore.profile.public_closet = true;

    const item1 = { id: 'item-1', owner_id: authStore.profileId, name: 'White Shirt', hidden: false, photo: 'https://example.com/item1.jpg' };
    const item2 = { id: 'item-2', owner_id: authStore.profileId, name: 'Blue Jeans', hidden: false, photo: 'https://example.com/item2.jpg' };
    const hiddenItem = { id: 'item-hidden', owner_id: authStore.profileId, name: 'Secret Dress', hidden: true, photo: 'https://example.com/hidden.jpg' };
    appStore.items = [item1, item2, hiddenItem];

    await router.push('/sos/create');
    const wrapper = mount(SosCreateView, { global: { plugins: [router] } });
    await flushPromises();

    await wrapper.find('.closet-btn').trigger('click');
    expect(wrapper.find('.sos-closet-drawer').exists()).toBe(true);

    const cardTexts = wrapper.findAll('.sos-selection-card').map(c => c.text());
    expect(cardTexts).toContain('White Shirt');
    expect(cardTexts).toContain('Blue Jeans');
    expect(cardTexts).not.toContain('Secret Dress');

    const cards = wrapper.findAll('.sos-selection-card');
    await cards[0].trigger('click');
    await flushPromises();

    expect(wrapper.find('.sos-cover-preview-card').text()).toContain('White Shirt');

    await wrapper.find('.sos-cover-preview-card button.secondary').trigger('click');
    const cardsAgain = wrapper.findAll('.sos-selection-card');
    await cardsAgain[1].trigger('click');
    await flushPromises();

    expect(wrapper.find('.sos-cover-preview-card').text()).toContain('Blue Jeans');
    expect(wrapper.findAll('.sos-cover-preview-card')).toHaveLength(1);
  });

  it('publishes without an image and redirects to /sos', async () => {
    const router = createTestRouter();
    const appStore = useAppStore();
    const authStore = useAuthStore();
    const sosStore = useSosStore();
    authStore.user = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' };
    authStore.profileIdentity = { status: 'PROFILE_READY', profileId: '11111111-1111-4111-8111-111111111111', profile: { id: '11111111-1111-4111-8111-111111111111' } };
    appStore.profile.public_closet = true;

    const item = { id: 'item-1', owner_id: authStore.profileId, name: 'Shirt', hidden: false, photo: 'https://example.com/shirt.jpg' };
    appStore.items = [item];

    const createSosSpy = vi.spyOn(sosStore, 'createSosPost').mockResolvedValue(true);

    await router.push('/sos/create');
    const wrapper = mount(SosCreateView, { global: { plugins: [router] } });
    await flushPromises();

    await wrapper.find('#sosTitle').setValue('明天約會穿什麼？');
    await wrapper.find('#sosDetails').setValue('想穿得俐落一點');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(createSosSpy).toHaveBeenCalledWith(expect.objectContaining({
      title: '明天約會穿什麼？',
      details: '想穿得俐落一點',
      cover_url: null,
      cover_path: null,
      cover_item_id: null,
      closet_item_ids: ['item-1']
    }));

    expect(sosStore.activeTab).toBe('sent');
    expect(router.currentRoute.value.path).toBe('/sos');
  });

  it('publishes with uploaded image successfully', async () => {
    const router = createTestRouter();
    const appStore = useAppStore();
    const authStore = useAuthStore();
    const sosStore = useSosStore();
    authStore.user = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' };
    authStore.profileIdentity = { status: 'PROFILE_READY', profileId: '11111111-1111-4111-8111-111111111111', profile: { id: '11111111-1111-4111-8111-111111111111' } };
    appStore.profile.public_closet = true;

    const item = { id: 'item-1', owner_id: authStore.profileId, name: 'Shirt', hidden: false, photo: 'https://example.com/shirt.jpg' };
    appStore.items = [item];

    vi.spyOn(ootdMedia, 'uploadOotdImage').mockResolvedValue({ path: 'ootd/test/img.jpg', publicUrl: 'https://example.com/img.jpg' });
    const createSosSpy = vi.spyOn(sosStore, 'createSosPost').mockResolvedValue(true);

    await router.push('/sos/create');
    const wrapper = mount(SosCreateView, { global: { plugins: [router] } });
    await flushPromises();

    await wrapper.find('#sosTitle').setValue('週末求救');
    await wrapper.find('#sosDetails').setValue('需要休閒風格');

    const file = new File(['mock'], 'outfit.jpg', { type: 'image/jpeg' });
    const fileInput = wrapper.find('.upload-btn input[type="file"]');
    Object.defineProperty(fileInput.element, 'files', { value: [file] });
    await fileInput.trigger('change');
    await flushPromises();

    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(createSosSpy).toHaveBeenCalledWith(expect.objectContaining({
      title: '週末求救',
      details: '需要休閒風格',
      cover_url: 'https://example.com/img.jpg',
      cover_path: 'ootd/test/img.jpg'
    }));
  });
});
