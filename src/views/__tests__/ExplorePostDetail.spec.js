import { installLocalInteractionFixtures } from '../../../tests/localInteractionFixtures.js';
import { beforeEach, describe, expect, it } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createWebHistory } from 'vue-router';
import ExploreView from '../ExploreView.vue';
import ProfileView from '../ProfileView.vue';
import OotdDetailView from '../OotdDetailView.vue';
import { useAppStore } from '@/stores/app';
import { useSocialStore } from '@/stores/social';

const createTestRouter = () => createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/explore', name: 'Explore', component: ExploreView },
    { path: '/profile', name: 'Profile', component: ProfileView },
    { path: '/ootd/:id', name: 'OotdDetail', component: OotdDetailView }
  ]
});

describe('Explore shared post detail and follow contract', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    installLocalInteractionFixtures();
  });

  it('opens the shared post detail route from a post image and supports browser back', async () => {
    const router = createTestRouter();
    const appStore = useAppStore();
    await router.push('/explore');
    const wrapper = mount(ExploreView, { global: { plugins: [router] } });

    const firstPostId = appStore.ootdPosts[0].id;
    await wrapper.find('.ootd-photo').trigger('click');
    await flushPromises();

    expect(router.currentRoute.value.name).toBe('OotdDetail');
    expect(router.currentRoute.value.params.id).toBe(firstPostId);
    expect(router.currentRoute.value.query.from).toBe('explore');

    await router.go(-1);
    await flushPromises();
    expect(router.currentRoute.value.name).toBe('Explore');
  });

  it('routes the comment action through post detail instead of opening an inline-only modal', async () => {
    const router = createTestRouter();
    await router.push('/explore');
    const wrapper = mount(ExploreView, { global: { plugins: [router] } });

    await wrapper.find('.ootd-card').findAll('.ootd-action')[1].trigger('click');
    await flushPromises();

    expect(router.currentRoute.value.name).toBe('OotdDetail');
    expect(router.currentRoute.value.query.comment).toBe('1');
  });

  it('does not create local-only follow state when a guest clicks follow', async () => {
    const router = createTestRouter();
    const appStore = useAppStore();
    const socialStore = useSocialStore();
    appStore.ootdPosts[0].user_id = '11111111-1111-4111-8111-111111111111';
    await router.push('/explore');
    const exploreWrapper = mount(ExploreView, { global: { plugins: [router] } });
    const targetCard = exploreWrapper.find('.ootd-card');
    const followButton = targetCard.find('.follow-button');
    const username = targetCard.find('.user-link-text').text();

    expect(socialStore.isFollowing({ id: appStore.ootdPosts[0].user_id, username })).toBe(false);
    await followButton.trigger('click');
    expect(socialStore.isFollowing({ id: appStore.ootdPosts[0].user_id, username })).toBe(false);
    expect(followButton.text()).toContain('追蹤');
    expect(appStore.isLoginGateOpen).toBe(true);
    expect(appStore.loginGateReturnTo).toBe(`/profile?user=${encodeURIComponent(username)}`);
  });
});
