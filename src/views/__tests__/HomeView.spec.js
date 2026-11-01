import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '../HomeView.vue';
import { useAuthStore } from '@/stores/auth';
import { useAppStore } from '@/stores/app';
import { useSocialStore } from '@/stores/social';
import { useOotdStore } from '@/stores/ootd';
import { useSosStore } from '@/stores/sos';
import { IDENTITY_STATUS } from '@/services/identityResolver';
import * as api from '@/services/supabase';
import { setLocale } from '@/i18n';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'Home', component: HomeView },
    { path: '/closet', component: { template: '<div>Closet</div>' } },
    { path: '/shop', component: { template: '<div>Shop</div>' } },
    { path: '/sos', component: { template: '<div>SOS</div>' } },
    { path: '/explore', component: { template: '<div>Explore</div>' } },
    { path: '/ai', component: { template: '<div>AI</div>' } },
    { path: '/tryon', component: { template: '<div>Tryon</div>' } },
    { path: '/membership', component: { template: '<div>Membership</div>' } },
    { path: '/ootd/:id', name: 'OotdDetail', component: { template: '<div>Post</div>' } },
    { path: '/sos/:id', name: 'SosDetail', component: { template: '<div>SosDetail</div>' } },
    { path: '/legal/:document', component: { template: '<div>Policy</div>' } }
  ]
});

describe('HomeView guest/member presentation', () => {
  afterEach(() => setLocale('zh-TW'));

  beforeEach(async () => {
    setActivePinia(createPinia());
    localStorage.clear();
    setLocale('zh-TW');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await router.push('/');
    await router.isReady();
  });

  it('introduces all four experiences with anchors and working account entry points', async () => {
    const auth=useAuthStore();
    const opening=vi.spyOn(auth,'openAuthModal');
    const wrapper = mount(HomeView, { global: { plugins: [router] } });
    expect(wrapper.find('h1').text()).toContain('你的衣櫥，更多穿搭可能。');
    expect(wrapper.findAll('.brand-feature')).toHaveLength(4);
    expect(wrapper.find('.brand-journey').exists()).toBe(false);
    for (const link of wrapper.findAll('.brand-core-grid a')) {
      expect(wrapper.find(link.attributes('href')).exists()).toBe(true);
    }
    expect(wrapper.findAll('.trending-card')).toHaveLength(0);
    expect(wrapper.find('.magic-wardrobe').exists()).toBe(false);
    expect(wrapper.find('.weather-wardrobe').exists()).toBe(false);
    expect(wrapper.find('a[href="/closet?quick=add-item"]').exists()).toBe(false);
    expect(wrapper.find('.brand-hero-actions .brand-explore-text').exists()).toBe(true);
    await wrapper.find('.brand-enter').trigger('click');
    expect(opening).toHaveBeenLastCalledWith('login',null,'/');
    wrapper.unmount();
  });

  it('updates all public-home shopping copy when the language changes', async () => {
    setLocale('en');
    const wrapper = mount(HomeView, { global: { plugins: [router] } });
    const shopping = wrapper.find('.brand-feature-shopping');
    expect(shopping.find('.brand-feature-copy h3').text()).toBe('Keep your next finds in view.');
    expect(shopping.findAll('li > span:last-child').map(node => node.text())).toEqual([
      'Wishlist and product management',
      'Save in one tap with the browser companion or extension',
      'Track try-ons and store visits in your shopping activity'
    ]);

    setLocale('ja');
    await wrapper.vm.$nextTick();
    expect(shopping.findAll('li > span:last-child').map(node => node.text())).toEqual([
      'ほしいものリストと商品管理',
      'ブラウザーアシスタント／拡張機能からワンタップで保存',
      '試着やストア訪問を購買履歴で確認'
    ]);
    setLocale('es');
    await wrapper.vm.$nextTick();
    expect(shopping.findAll('li > span:last-child').map(node => node.text())).toEqual([
      'Lista de deseos y gestión de productos',
      'Guarda con un toque desde el asistente o la extensión del navegador',
      'Consulta las pruebas y visitas a tiendas en tu actividad de compras'
    ]);
    wrapper.unmount();
    setLocale('zh-TW');
  });

  it('switches to the utility dashboard for a resolved member', async () => {
    const auth = useAuthStore();
    const app = useAppStore();
    auth.session = { user: { id: '11111111-1111-4111-8111-111111111111' } };
    auth.user = auth.session.user;
    auth.profileIdentity = { status: IDENTITY_STATUS.PROFILE_READY, authUserId: auth.user.id, profileId: '22222222-2222-4222-8222-222222222222', profile: { id: '22222222-2222-4222-8222-222222222222' }, error: null };
    app.setMemberProfile({ id: auth.profileId, name: 'OOTIE Demo', username: '@ootie_demo' });
    const wrapper = mount(HomeView, { global: { plugins: [router] } });
    await flushPromises();
    expect(wrapper.text()).toContain('歡迎回來， OOTIE');
    expect(wrapper.find('a[href="/closet?quick=add-item"]').exists()).toBe(true);
    expect(wrapper.find('a[href="/membership"]').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('取得 AI 穿搭建議');
    expect(wrapper.find('.brand-home').exists()).toBe(false);
    expect(wrapper.find('.quick-actions').exists()).toBe(false);
    expect(wrapper.find('.weather-wardrobe').text()).toContain('先選擇所在的地區');
    expect(wrapper.find('.weather-wardrobe .outfit-empty').exists()).toBe(false);
    await wrapper.find('.outfit-location-prompt button').trigger('click');
    expect(wrapper.find('#home-weather-city').exists()).toBe(true);
    wrapper.unmount();
  });

  it('offers distinct authors to a new member and switches to followed posts after following', async () => {
    const auth = useAuthStore();
    const app = useAppStore();
    const social = useSocialStore();
    auth.session = { user: { id: 'member-auth' } };
    auth.user = auth.session.user;
    auth.profileIdentity = { status: IDENTITY_STATUS.PROFILE_READY, authUserId: auth.user.id, profileId: 'member-profile', profile: { id: 'member-profile' }, error: null };
    vi.spyOn(useOotdStore(), 'loadRemotePosts').mockResolvedValue();
    app.ootdPosts = ['member-profile', 'a', 'a', 'b', 'c', 'd'].map((author, index) => ({
      id: `discovery-${index}`, user_id: author, username: author,
      image: '/images/outfit.webp', caption: `Outfit ${index}`, avatar_url: '/images/avatar.webp'
    }));
    const follow = vi.spyOn(social, 'toggleFollow').mockImplementation(async target => {
      social.followingProfiles.push({ following_id: target.id, following: target });
      return true;
    });
    const wrapper = mount(HomeView, { global: { plugins: [router] } });
    await flushPromises();
    expect(wrapper.text()).toContain('發現穿搭');
    expect(wrapper.findAll('.following-author').map(author => author.text())).toEqual(['a', 'b', 'c']);
    expect(wrapper.findAll('.discovery-follow')).toHaveLength(3);
    const weather=wrapper.find('.weather-wardrobe').element;
    const feed=wrapper.find('.following-journal').element;
    expect(weather.compareDocumentPosition(feed) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await wrapper.find('.discovery-follow').trigger('click');
    await flushPromises();
    expect(follow).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }));
    expect(wrapper.text()).toContain('追蹤中的衣友動態');
    expect(wrapper.findAll('.following-card')).toHaveLength(2);
    expect(wrapper.find('.discovery-follow').exists()).toBe(false);
    app.ootdPosts = [];
    await flushPromises();
    expect(wrapper.find('.following-journal').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('追蹤中的衣友動態');
    expect(wrapper.text()).not.toContain('追蹤衣友後，就能在這裡看到他們的貼文。');
    wrapper.unmount();
  });

  it('displays followed SOS posts in dynamic feed and opens SOS detail on click', async () => {
    const auth = useAuthStore();
    const app = useAppStore();
    const social = useSocialStore();
    const sosStore = useSosStore();
    const sosPost = {
      id: 'sos-post-1',
      sender_id: 'followed-user',
      user_id: 'followed-user',
      username: '@followed_user',
      display_name: 'Followed Friend',
      image: '/images/sos-cover.webp',
      cover_image: '/images/sos-cover.webp',
      title: '週末野餐穿搭求救',
      status: 'OPEN',
      created_at: new Date().toISOString()
    };
    vi.spyOn(api, 'fetchSosPostsFromSupabase').mockResolvedValue([sosPost]);
    vi.spyOn(api, 'fetchSavedSosIds').mockResolvedValue(new Set());
    vi.spyOn(useOotdStore(), 'loadRemotePosts').mockResolvedValue();
    vi.spyOn(social, 'refresh').mockResolvedValue();
    auth.session = { user: { id: 'member-auth' } };
    auth.user = auth.session.user;
    auth.profileIdentity = { status: IDENTITY_STATUS.PROFILE_READY, authUserId: auth.user.id, profileId: 'member-profile', profile: { id: 'member-profile' }, error: null };
    app.ootdPosts = [];
    app.followingUsers = ['@followed_user'];
    social.followingProfiles = [{ following_id: 'followed-user', following: { id: 'followed-user', username: '@followed_user' } }];
    app.sosPosts = [sosPost];
    sosStore.sosPosts = [sosPost];

    const wrapper = mount(HomeView, { global: { plugins: [router] } });
    await flushPromises();

    expect(wrapper.text()).toContain('追蹤中的衣友動態');
    expect(wrapper.findAll('.following-card')).toHaveLength(1);
    expect(wrapper.text()).toContain('週末野餐穿搭求救');

    await wrapper.find('.following-open').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.name).toBe('SosDetail');
    expect(router.currentRoute.value.params.id).toBe('sos-post-1');
    wrapper.unmount();
  });
});
