import { installLocalInteractionFixtures } from '../../../../tests/localInteractionFixtures.js';
import { beforeEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createWebHistory } from 'vue-router';
import CommentModal from '../CommentModal.vue';
import { useAppStore } from '@/stores/app';

const createTestRouter = () => createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: { template: '<div />' } },
    { path: '/profile', name: 'Profile', component: { template: '<div />' } }
  ]
});

describe('Comment author profile navigation', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    installLocalInteractionFixtures();
  });

  it('makes other-user and self comment avatar/name links point to their own profiles', () => {
    const router = createTestRouter();
    const appStore = useAppStore();
    const post = appStore.ootdPosts.find((item) => item.id === 'post-01');
    post.commentList.push({ id: 'comment-self', user: appStore.profile.username, text: '自己的留言' });
    appStore.activeCommentPostId = post.id;
    appStore.isCommentOpen = true;

    const wrapper = mount(CommentModal, { global: { plugins: [router] } });
    const links = wrapper.findAll('.comment-author');

    expect(links.length).toBe(3);
    expect(links[0].find('.comment-avatar').exists()).toBe(true);
    expect(decodeURIComponent(links[0].attributes('href'))).toContain('user=@ella');
    expect(decodeURIComponent(links[1].attributes('href'))).toContain('user=@minji');
    expect(decodeURIComponent(links[2].attributes('href'))).toContain(`user=${appStore.profile.username}`);
  });
});
