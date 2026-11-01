import { installLocalInteractionFixtures } from '../../../tests/localInteractionFixtures.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createWebHistory } from 'vue-router';
import SosDetailView from '../SosDetailView.vue';
import { useAppStore } from '@/stores/app';
import { useSosStore } from '@/stores/sos';
import { useAuthStore } from '@/stores/auth';

const createTestRouter = () => createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/sos', name: 'Sos', component: { template: '<div>SosList</div>' } },
    { path: '/sos/:id', name: 'SosDetail', component: SosDetailView },
    { path: '/profile/saved', component: { template: '<div>Saved</div>' } },
    { path: '/profile/help-history', component: { template: '<div>HelpHistory</div>' } }
  ]
});

const makePost = (id, senderId = 'profile-owner') => ({
  id,
  sender_id: senderId,
  closet_owner_id: senderId,
  username: '@hayley',
  display_name: 'Hayley',
  initials: 'HL',
  title: '週五派對穿搭',
  details: '希望能穿得亮眼一點',
  occasion: '聚餐',
  weather: '晴天',
  closet_item_ids: ['item-1', 'item-2'],
  status: 'OPEN',
  adopted_suggestion_id: null,
  liked_suggestion_ids: [],
  saved: false
});

describe('SosDetailView standalone page', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    installLocalInteractionFixtures();
  });

  it('renders standalone detail page with post information and items', async () => {
    const router = createTestRouter();
    const appStore = useAppStore();
    const sosStore = useSosStore();
    const post = makePost('sos-100');
    appStore.sosPosts = [post];
    sosStore.sosPosts = [post];

    await router.push('/sos/sos-100');
    const wrapper = mount(SosDetailView, { global: { plugins: [router] } });
    await flushPromises();

    expect(wrapper.text()).toContain('週五派對穿搭');
    expect(wrapper.text()).toContain('希望能穿得亮眼一點');
    expect(wrapper.text()).toContain('聚餐');
    expect(wrapper.text()).toContain('晴天');
    expect(wrapper.find('.sos-detail-gallery').exists()).toBe(true);
  });

  it('shows not found when post does not exist', async () => {
    const router = createTestRouter();
    const appStore = useAppStore();
    const sosStore = useSosStore();
    appStore.sosPosts = [];
    sosStore.sosPosts = [];
    vi.spyOn(sosStore, 'initFromSupabase').mockResolvedValue();

    await router.push('/sos/non-existent-id');
    const wrapper = mount(SosDetailView, { global: { plugins: [router] } });
    await flushPromises();

    expect(wrapper.text()).toContain('找不到這則穿搭求救');
    expect(wrapper.find('.return-btn').exists()).toBe(true);
  });

  it('differentiates actions for post owner vs non-owner responder', async () => {
    const router = createTestRouter();
    const appStore = useAppStore();
    const sosStore = useSosStore();
    const post = makePost('sos-owner-test', 'my-profile-id');
    appStore.profile.id = 'my-profile-id';
    appStore.sosPosts = [post];
    sosStore.sosPosts = [post];

    await router.push('/sos/sos-owner-test');
    let wrapper = mount(SosDetailView, { global: { plugins: [router] } });
    await flushPromises();

    // Owner sees "結束這次求救" and "刪除"
    expect(wrapper.text()).toContain('結束這次求救');
    expect(wrapper.text()).toContain('刪除');
    expect(wrapper.text()).not.toContain('提供穿搭建議');
    wrapper.unmount();

    // Non-owner responder
    appStore.profile.id = 'other-profile-id';
    wrapper = mount(SosDetailView, { global: { plugins: [router] } });
    await flushPromises();

    expect(wrapper.text()).toContain('提供穿搭建議');
    expect(wrapper.text()).not.toContain('結束這次求救');
    wrapper.unmount();
  });

  it('opens suggestion modal on clicking suggest button without modal overlap conflict', async () => {
    const router = createTestRouter();
    const appStore = useAppStore();
    const sosStore = useSosStore();
    const post = makePost('sos-suggest-test', 'other-author-id');
    appStore.profile.id = 'current-user-id';
    appStore.sosPosts = [post];
    sosStore.sosPosts = [post];

    await router.push('/sos/sos-suggest-test');
    const wrapper = mount(SosDetailView, { global: { plugins: [router] } });
    await flushPromises();

    const suggestBtn = wrapper.findAll('button').find(b => b.text().includes('提供穿搭建議'));
    expect(suggestBtn).toBeDefined();
    await suggestBtn.trigger('click');
    await flushPromises();

    expect(appStore.activeSosId).toBe('sos-suggest-test');
    expect(appStore.isSuggestionFormOpen).toBe(true);
    // Detail is a page, not relying on isSosDetailOpen
    expect(appStore.isSosDetailOpen).toBe(false);
  });
});
