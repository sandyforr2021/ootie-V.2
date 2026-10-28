import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '../HomeView.vue';
import { useAuthStore } from '@/stores/auth';
import { useAppStore } from '@/stores/app';
import { useSocialStore } from '@/stores/social';
import { useOotdStore } from '@/stores/ootd';
import { IDENTITY_STATUS } from '@/services/identityResolver';

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
    { path: '/ootd/:id', name: 'OotdDetail', component: { template: '<div>Post</div>' } }
  ]
});

describe('HomeView guest/member presentation', () => {
  beforeEach(async () => {
    setActivePinia(createPinia());
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await router.push('/');
    await router.isReady();
  });

  it('shows working entry points without invented community activity', () => {
    const wrapper = mount(HomeView, { global: { plugins: [router] } });
    expect(wrapper.text()).toContain('買之前，');
    expect(wrapper.text()).toContain('先穿進自己的生活。');
    expect(wrapper.text()).toContain('開始購物試穿');
    expect(wrapper.findAll('.trending-card')).toHaveLength(0);
    expect(wrapper.find('.hero-photo img').attributes('src')).toBe('/assets/ootie-home-hero-v2-1024.webp');
    expect(wrapper.find('.hero-photo img').attributes('fetchpriority')).toBe('high');
    expect(wrapper.find('a[href="/shop?tab=album"]').exists()).toBe(true);
    expect(wrapper.find('a[href="/shop?tab=community"]').exists()).toBe(true);
    expect(wrapper.find('a[href="/closet?quick=add-item"]').exists()).toBe(false);
    wrapper.unmount();
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
    await wrapper.find('.discovery-follow').trigger('click');
    await flushPromises();
    expect(follow).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }));
    expect(wrapper.text()).toContain('追蹤中的貼文');
    expect(wrapper.findAll('.following-card')).toHaveLength(2);
    expect(wrapper.find('.discovery-follow').exists()).toBe(false);
    app.ootdPosts = [];
    await flushPromises();
    expect(wrapper.find('.following-journal').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('追蹤中的貼文');
    expect(wrapper.text()).not.toContain('追蹤衣友後，就能在這裡看到他們的貼文。');
    wrapper.unmount();
  });
});
