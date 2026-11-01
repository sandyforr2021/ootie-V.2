import { installLocalInteractionFixtures } from '../../../tests/localInteractionFixtures.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createWebHistory } from 'vue-router';
import SosDetailView from '../SosDetailView.vue';
import { useAppStore } from '@/stores/app';
import { useSosStore } from '@/stores/sos';
import { useAuthStore } from '@/stores/auth';
import * as clothingRepository from '@/services/clothingRepository';
import * as sosApi from '@/services/supabase';

const createTestRouter = () => createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/sos', name: 'Sos', component: { template: '<div>SosList</div>' } },
    { path: '/sos/:id', name: 'SosDetail', component: SosDetailView },
    { path: '/profile/saved', component: { template: '<div>Saved</div>' } },
    { path: '/profile/help-history', component: { template: '<div>HelpHistory</div>' } }
  ]
});

const makePost = (id, senderId = '11111111-1111-4111-8111-111111111111') => ({
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
  public_closet: true,
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
    vi.spyOn(clothingRepository, 'getPublicItemsByOwnerId').mockResolvedValue([]);
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

  it('loads the author’s current full public wardrobe instead of the post item ID snapshot', async () => {
    const router = createTestRouter();
    const sosStore = useSosStore();
    const post = { ...makePost('sos-current-wardrobe'), closet_item_ids: ['old-snapshot-id'] };
    const currentItems = [
      { id: 'new-item-1', name: 'Recently added shirt', photo: '/shirt.webp' },
      { id: 'new-item-2', name: 'Recently added skirt', photo: '/skirt.webp' }
    ];
    const getWardrobe = vi.spyOn(clothingRepository, 'getPublicItemsByOwnerId').mockResolvedValue(currentItems);
    sosStore.sosPosts = [post];

    await router.push('/sos/sos-current-wardrobe');
    const wrapper = mount(SosDetailView, { global: { plugins: [router] } });
    await flushPromises();

    expect(getWardrobe).toHaveBeenCalledWith(post.sender_id, undefined, { defer: true });
    expect(wrapper.findAll('.sos-detail-gallery-item')).toHaveLength(2);
    expect(wrapper.find('.sos-detail-gallery').text()).toContain('2');
    wrapper.unmount();
  });

  it('loads the current wardrobe immediately after creating a public SOS post', async () => {
    const router = createTestRouter();
    const appStore = useAppStore();
    const authStore = useAuthStore();
    const sosStore = useSosStore();
    const profileId = '11111111-1111-4111-8111-111111111111';
    const postId = '22222222-2222-4222-8222-222222222222';
    const currentItems = [{ id: 'new-current-item', name: 'Recently added item', photo: '/new-item.webp' }];

    authStore.session = { user: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' } };
    authStore.user = authStore.session.user;
    authStore.profileIdentity = { status: 'PROFILE_READY', profileId, profile: { id: profileId } };
    appStore.profile = { ...appStore.profile, id: profileId, public_closet: true };
    vi.spyOn(sosApi, 'insertSosPostToSupabase').mockResolvedValue({ id: postId, user_id: profileId });
    const getWardrobe = vi.spyOn(clothingRepository, 'getPublicItemsByOwnerId').mockResolvedValue(currentItems);

    expect(await sosStore.createSosPost({
      title: 'SOS',
      details: 'Help me choose',
      closet_item_ids: []
    })).toBe(true);

    await router.push(`/sos/${postId}`);
    const wrapper = mount(SosDetailView, { global: { plugins: [router] } });
    await flushPromises();

    expect(sosStore.sosPosts[0].public_closet).toBe(true);
    expect(getWardrobe).toHaveBeenCalledWith(profileId, undefined, { defer: true });
    expect(wrapper.findAll('.sos-detail-gallery-item')).toHaveLength(1);
    wrapper.unmount();
  });

  it('does not load a wardrobe when the author public closet is disabled', async () => {
    const router = createTestRouter();
    const sosStore = useSosStore();
    const post = { ...makePost('sos-private-closet'), public_closet: false };
    const getWardrobe = vi.spyOn(clothingRepository, 'getPublicItemsByOwnerId');
    sosStore.sosPosts = [post];

    await router.push('/sos/sos-private-closet');
    const wrapper = mount(SosDetailView, { global: { plugins: [router] } });
    await flushPromises();

    expect(getWardrobe).not.toHaveBeenCalled();
    expect(wrapper.findAll('.sos-detail-gallery-item')).toHaveLength(0);
    wrapper.unmount();
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
