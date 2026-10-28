import { installLocalInteractionFixtures } from '../../../tests/localInteractionFixtures.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createWebHistory } from 'vue-router';
import SosView from '../SosView.vue';
import SosFormModal from '@/components/modal/SosFormModal.vue';
import SuggestionModal from '@/components/modal/SuggestionModal.vue';
import { useAppStore } from '@/stores/app';
import { useSosStore } from '@/stores/sos';
import { setLocale } from '@/i18n';
import { useAuthStore } from '@/stores/auth';
import { useClosetStore } from '@/stores/closet';
import * as ootdMedia from '@/services/ootdMedia';

const createRouterForSos = () => createRouter({
  history: createWebHistory(),
  routes: [{ path: '/sos', name: 'Sos', component: SosView }]
});

const makePost = (id, itemCount, senderId = 'profile-other') => ({
  id,
  sender_id: senderId,
  closet_owner_id: senderId,
  username: senderId === 'profile-other' ? '@ella' : '@hayley',
  initials: senderId === 'profile-other' ? 'EL' : 'HL',
  title: '測試求救',
  occasion: '約會',
  weather: '涼爽',
  when_label: '明天',
  vibes: ['Soft'],
  closet_item_ids: Array.from({ length: itemCount }, (_, index) => String(index + 1)),
  details: '測試用求救內容',
  status: 'OPEN',
  adopted_suggestion_id: null,
  liked_suggestion_ids: []
});

describe('SOS clothing preview and selection UX', () => {
  afterEach(() => { setLocale('zh-TW'); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    installLocalInteractionFixtures();
  });

  it('keeps wardrobe thumbnails out of the feed and opens the selected request', async () => {
    const router = createRouterForSos();
    const appStore = useAppStore();
    appStore.sosPosts = [makePost('sos-eight', 8)];
    useSosStore();
    await router.push('/sos');
    const wrapper = mount(SosView, { global: { plugins: [router] } });
    await flushPromises();
    expect(wrapper.find('.sos-card-clothing-preview').exists()).toBe(false);
    const detail = wrapper.findAll('button').find(button => button.text().includes('查看詳情'));
    await detail.trigger('click');
    expect(appStore.activeSosDetailId).toBe('sos-eight');
    expect(appStore.isSosDetailOpen).toBe(true);
  });

  it('requires public wardrobe visibility instead of individual-item publication', async () => {
    const appStore = useAppStore();
    const wrapper = mount(SosFormModal);
    appStore.isSosFormOpen = true;
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.sos-selection-grid').exists()).toBe(false);
    appStore.profile.public_closet=false;
    await wrapper.vm.$nextTick();
    expect(wrapper.find('button[type="submit"]').element.disabled).toBe(true);
    expect(wrapper.text()).toContain('請先開啟「公開衣櫥」功能，才能發布求救。');
    appStore.profile.public_closet=true;
    await wrapper.vm.$nextTick();
    expect(wrapper.find('button[type="submit"]').element.disabled).toBe(false);
    expect(wrapper.find('#sosWhen').exists()).toBe(false);
    wrapper.unmount();
  });

  it('renders only the SOS shared items in the suggestion picker', async () => {
    const appStore = useAppStore();
    const sosStore = useSosStore();
    appStore.activeSosId = 'sos-01';
    appStore.isSuggestionFormOpen = false;
    const wrapper = mount(SuggestionModal);
    appStore.isSuggestionFormOpen = true;
    await wrapper.vm.$nextTick();

    expect(sosStore.sosPosts.find((post) => post.id === 'sos-01').closet_item_ids).toHaveLength(5);
    expect(wrapper.findAll('.sos-selection-card')).toHaveLength(5);
    expect(wrapper.findAll('.sos-selection-card .product-image')).toHaveLength(5);
  });

  it('uses the other owner shared wardrobe even when the helper owns no matching pieces', async () => {
    const appStore = useAppStore();
    const sosStore = useSosStore();
    await flushPromises();
    appStore.items = [{ id: 'helper-private', name: 'Private trousers', photo: '/private.jpg' }];
    sosStore.sosPosts = [{ ...makePost('remote-request', 0), closet_item_ids: ['shared-top'] }];
    sosStore.publicClosetItems = [
      { id: 'shared-top', name: 'Shared lavender knit', photo: '/shared.jpg' },
      { id: 'unrelated', name: 'Unrelated request piece', photo: '/other.jpg' }
    ];
    appStore.activeSosId = 'remote-request';
    appStore.isSuggestionFormOpen = true;
    const wrapper = mount(SuggestionModal);
    expect(wrapper.findAll('.sos-selection-card')).toHaveLength(1);
    expect(wrapper.find('.product-image').attributes('src')).toBe('/shared.jpg');
    expect(wrapper.text()).not.toContain('Private trousers');
    expect(wrapper.text()).not.toContain('Unrelated request piece');
    wrapper.unmount();
  });

  it('switches form labels while preserving the draft and canonical stored options', async () => {
    const appStore = useAppStore();
    const wrapper = mount(SosFormModal);
    appStore.isSosFormOpen = true;
    await flushPromises();
    await wrapper.find('#sosTitle').setValue('A colorful weekend walk');
    await wrapper.find('#sosOccasion').setValue('戶外活動');
    for (const [language, heading, option] of [
      ['en', 'Ask for styling help', 'Outdoors'],
      ['ja', 'コーデを相談する', 'アウトドア'],
      ['es', 'Pedir consejos de estilo', 'Al aire libre'],
      ['zh-TW', '請衣友幫忙搭配', '戶外活動']
    ]) {
      setLocale(language);
      await wrapper.vm.$nextTick();
      expect(wrapper.find('h2').text()).toBe(heading);
      expect(wrapper.find('#sosTitle').element.value).toBe('A colorful weekend walk');
      expect(wrapper.find('#sosOccasion').element.value).toBe('戶外活動');
      expect(wrapper.find('option[value="戶外活動"]').text()).toBe(option);
    }
    wrapper.unmount();
  });

  it('waits for the member wardrobe before enabling publication on direct entry', async () => {
    const app = useAppStore();
    const auth = useAuthStore();
    auth.user = { id: 'auth-owner' };
    auth.profileIdentity = { status: 'PROFILE_READY', profileId: 'owner-profile', profile: { id: 'owner-profile' } };
    app.items = [];
    let finish;
    vi.spyOn(useClosetStore(), 'loadRemoteItems').mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const wrapper = mount(SosFormModal);
    app.isSosFormOpen = true;
    await wrapper.vm.$nextTick();
    expect(wrapper.find('fieldset').element.disabled).toBe(true);
    expect(wrapper.find('[role="status"]').exists()).toBe(true);
    app.items = [{ id: 'owner-top', name: 'Lavender knit', photo: '/knit.jpg' }];
    finish({ ok: true });
    await flushPromises();
    expect(wrapper.find('fieldset').element.disabled).toBe(false);
    expect(wrapper.find('.sos-selection-grid').exists()).toBe(false);
    expect(wrapper.find('[role="status"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('keeps publication blocked when the wardrobe request fails', async () => {
    const app = useAppStore();
    const auth = useAuthStore();
    auth.user = { id: 'auth-owner' };
    auth.profileIdentity = { status: 'PROFILE_READY', profileId: 'owner-profile', profile: { id: 'owner-profile' } };
    vi.spyOn(useClosetStore(), 'loadRemoteItems').mockResolvedValue({ ok: false });
    const wrapper = mount(SosFormModal);
    app.isSosFormOpen = true;
    await flushPromises();
    expect(wrapper.find('fieldset').element.disabled).toBe(true);
    expect(wrapper.find('[role="alert"]').text()).toContain('衣櫥無法載入');
    wrapper.unmount();
  });

  it('publishes a separate copy of a selected wardrobe image as the SOS cover', async () => {
    const app = useAppStore();
    const auth = useAuthStore();
    auth.user = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' };
    auth.profileIdentity = { status: 'PROFILE_READY', profileId: '11111111-1111-4111-8111-111111111111', profile: { id: '11111111-1111-4111-8111-111111111111' } };
    app.profile.public_closet = true;
    const item = { id: '33333333-3333-4333-8333-333333333333', owner_id: auth.profileId, name: 'Jacket', photo: 'blob:private-item' };
    vi.spyOn(useClosetStore(), 'loadRemoteItems').mockImplementation(async () => { app.items = [item]; return { ok: true }; });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(['image'], { type: 'image/jpeg' }) }));
    const upload = vi.spyOn(ootdMedia, 'uploadOotdImage').mockResolvedValue({ path: 'ootd/owner/sos.jpg', publicUrl: 'https://example.org/sos.jpg' });
    const publish = vi.spyOn(useSosStore(), 'createSosPost').mockResolvedValue(true);
    const wrapper = mount(SosFormModal, { global: { stubs: ['router-link'] } });
    app.isSosFormOpen = true;
    await flushPromises();
    await wrapper.find('#sosTitle').setValue('A day out');
    await wrapper.find('#sosDetails').setValue('Help me choose');
    await wrapper.find('#sosCoverMode').setValue('closet');
    await wrapper.find('select[aria-label]').setValue(item.id);
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(upload).toHaveBeenCalledOnce();
    expect(upload.mock.calls[0][0]).toBeInstanceOf(File);
    expect(publish).toHaveBeenCalledWith(expect.objectContaining({ cover_item_id: item.id, cover_url: 'https://example.org/sos.jpg' }));
    expect(app.isSosFormOpen).toBe(false);
    wrapper.unmount();
  });

  it('does not publish when a selected wardrobe photo cannot be read', async () => {
    const app = useAppStore();
    const auth = useAuthStore();
    auth.user = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' };
    auth.profileIdentity = { status: 'PROFILE_READY', profileId: '11111111-1111-4111-8111-111111111111', profile: { id: '11111111-1111-4111-8111-111111111111' } };
    app.profile.public_closet = true;
    const item = { id: '33333333-3333-4333-8333-333333333333', owner_id: auth.profileId, name: 'Jacket', photo: 'https://example.org/private.jpg' };
    vi.spyOn(useClosetStore(), 'loadRemoteItems').mockImplementation(async () => { app.items = [item]; return { ok: true }; });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('CORS')));
    const publish = vi.spyOn(useSosStore(), 'createSosPost').mockResolvedValue(true);
    const wrapper = mount(SosFormModal, { global: { stubs: ['router-link'] } });
    app.isSosFormOpen = true;
    await flushPromises();
    await wrapper.find('#sosTitle').setValue('A day out');
    await wrapper.find('#sosDetails').setValue('Help me choose');
    await wrapper.find('#sosCoverMode').setValue('closet');
    await wrapper.find('select[aria-label]').setValue(item.id);
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(publish).not.toHaveBeenCalled();
    expect(app.isSosFormOpen).toBe(true);
    wrapper.unmount();
  });

  it('opens a shared request after its remote data arrives without showing unrelated requests', async () => {
    const router = createRouterForSos();
    const app = useAppStore();
    const sos = useSosStore();
    sos.sosPosts = [];
    await router.push('/sos?sos=shared-request');
    const wrapper = mount(SosView, { global: { plugins: [router] } });
    await flushPromises();
    expect(app.isSosDetailOpen).toBe(false);
    sos.sosPosts = [makePost('unrelated-request', 1)];
    await wrapper.vm.$nextTick();
    expect(app.isSosDetailOpen).toBe(false);
    sos.sosPosts.push(makePost('shared-request', 3));
    await wrapper.vm.$nextTick();
    expect(app.activeSosDetailId).toBe('shared-request');
    expect(app.isSosDetailOpen).toBe(true);
    wrapper.unmount();
  });
});
