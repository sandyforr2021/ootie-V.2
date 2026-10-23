import { installLocalInteractionFixtures } from '../../../tests/localInteractionFixtures.js';
import { describe, expect, it, beforeEach } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createWebHistory } from 'vue-router';
import ProfileView from '../ProfileView.vue';
import OotdDetailView from '../OotdDetailView.vue';
import { useAppStore } from '@/stores/app';

const createTestRouter = () => createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/explore', name: 'Explore', component: { template: '<div />' } },
    { path: '/profile', component: ProfileView },
    { path: '/ootd/:id', component: OotdDetailView }
  ]
});

const decodeHref = (wrapper) => decodeURIComponent(wrapper.attributes('href'));

describe('OOTD author profile context routing', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    installLocalInteractionFixtures();
  });

  it('routes viewer A from another user B post to user B profile', async () => {
    const router = createTestRouter();
    const appStore = useAppStore();
    appStore.ootdPosts.unshift({
      id: 'post-sandy-a',
      username: '@sandy',
      user_id: 'profile-sandy',
      initials: 'SD',
      image: 'https://example.com/sandy-a.jpg',
      caption: 'Sandy 的穿搭',
      wearing: [],
      hashtags: [],
      created_at: '2026-09-26T10:00:00.000Z'
    });

    await router.push('/ootd/post-sandy-a?user=%40sandy');
    const wrapper = mount(OotdDetailView, { global: { plugins: [router] } });
    await flushPromises();

    expect(decodeHref(wrapper.find('.text-link'))).toContain('/profile?user=@sandy');
    expect(decodeHref(wrapper.find('a.secondary'))).toContain('/profile?user=@sandy');
  });

  it('preserves user B context from profile B into the post detail route', async () => {
    const router = createTestRouter();
    const appStore = useAppStore();
    appStore.ootdPosts.unshift({
      id: 'post-sandy-b',
      username: '@sandy',
      user_id: 'profile-sandy',
      initials: 'SD',
      image: 'https://example.com/sandy-b.jpg',
      caption: 'Sandy 的第二篇穿搭',
      wearing: [],
      hashtags: [],
      created_at: '2026-09-26T10:00:00.000Z'
    });

    await router.push('/profile?user=%40sandy');
    const wrapper = mount(ProfileView, { global: { plugins: [router] } });
    await flushPromises();

    expect(decodeHref(wrapper.find('.ootd-card-link'))).toContain('/ootd/post-sandy-b?user=@sandy');
  });

  it('routes the viewer own post to the viewer profile', async () => {
    const router = createTestRouter();
    const appStore = useAppStore();
    const username = appStore.profile.username;
    appStore.ootdPosts.unshift({
      id: 'post-self-context',
      username,
      user_id: appStore.profile.user_id,
      initials: appStore.profile.initials,
      image: 'https://example.com/self.jpg',
      caption: '自己的穿搭',
      wearing: [],
      hashtags: [],
      created_at: '2026-09-26T10:00:00.000Z'
    });

    await router.push('/ootd/post-self-context');
    const wrapper = mount(OotdDetailView, { global: { plugins: [router] } });
    await flushPromises();

    expect(decodeHref(wrapper.find('.text-link'))).toContain(`/profile?user=${username}`);
    expect(decodeHref(wrapper.find('a.secondary'))).toContain(`/profile?user=${username}`);
  });

  it('shows comments inline without a second dialog when Explore requests them', async () => {
    const router = createTestRouter();
    const appStore = useAppStore();
    const post = appStore.ootdPosts[0];

    await router.push(`/ootd/${post.id}?user=${encodeURIComponent(post.username)}&from=explore&comment=1`);
    const wrapper=mount(OotdDetailView, { global: { plugins: [router] } });
    await flushPromises();

    expect(appStore.isCommentOpen).toBe(false);
    expect(wrapper.find(`#post-comments-${post.id}`).exists()).toBe(true);
  });
});
