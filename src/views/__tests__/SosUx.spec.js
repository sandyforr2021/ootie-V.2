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
  afterEach(() => setLocale('zh-TW'));
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    installLocalInteractionFixtures();
  });

  it('shows all public items up to five without a more button', async () => {
    const router = createRouterForSos();
    const appStore = useAppStore();
    appStore.sosPosts = [makePost('sos-five', 5)];
    useSosStore();
    await router.push('/sos');

    const wrapper = mount(SosView, { global: { plugins: [router] } });
    await flushPromises();

    expect(wrapper.findAll('.sos-card-clothing-thumb')).toHaveLength(5);
    expect(wrapper.find('.sos-card-clothing-more').exists()).toBe(false);
  });

  it('shows five items and routes plus-three-more into the suggestion flow', async () => {
    const router = createRouterForSos();
    const appStore = useAppStore();
    appStore.sosPosts = [makePost('sos-eight', 8)];
    useSosStore();
    await router.push('/sos');

    const wrapper = mount(SosView, { global: { plugins: [router] } });
    await flushPromises();

    const moreButton = wrapper.find('.sos-card-clothing-more');
    expect(wrapper.findAll('.sos-card-clothing-thumb')).toHaveLength(5);
    expect(moreButton.text()).toContain('＋3 更多');

    await moreButton.trigger('click');
    expect(appStore.activeSosId).toBe('sos-eight');
    expect(appStore.isSuggestionFormOpen).toBe(true);
  });

  it('keeps the self-SOS guard when more is clicked from sent posts', async () => {
    const router = createRouterForSos();
    const appStore = useAppStore();
    appStore.sosPosts = [makePost('sos-self', 8, appStore.profile.id)];
    const sosStore = useSosStore();
    sosStore.activeTab = 'sent';
    await router.push('/sos');

    const wrapper = mount(SosView, { global: { plugins: [router] } });
    await flushPromises();
    await wrapper.find('.sos-card-clothing-more').trigger('click');

    expect(appStore.isSuggestionFormOpen).toBe(false);
    expect(appStore.toastMessage).toContain('不能為自己的求救');
  });

  it('renders the SOS publish picker as an image selection grid', async () => {
    const appStore = useAppStore();
    const wrapper = mount(SosFormModal);
    appStore.isSosFormOpen = true;
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.sos-selection-grid').exists()).toBe(true);
    expect(wrapper.findAll('.sos-selection-card')).toHaveLength(8);
    expect(wrapper.findAll('.sos-selection-card.selected')).toHaveLength(8);
    expect(wrapper.findAll('.sos-selection-card .product-image')).toHaveLength(8);
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
    expect(wrapper.findAll('.sos-selection-card.selected')).toHaveLength(1);
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
