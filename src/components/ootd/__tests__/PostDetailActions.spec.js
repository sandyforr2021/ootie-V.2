import { beforeEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import PostDetailContent from '../PostDetailContent.vue';
import { useAppStore } from '@/stores/app';
import { useAuthStore } from '@/stores/auth';
import { IDENTITY_STATUS } from '@/services/identityResolver';

const profileId = '22222222-2222-4222-8222-222222222222';
const itemId = '33333333-3333-4333-8333-333333333333';
const router = createRouter({
  history: createMemoryHistory(),
  routes: [{ path: '/profile', component: { template: '<div />' } }]
});

const mountDetail = (post) => mount(PostDetailContent, {
  props: { post, authorProfileRoute: { path: '/profile', query: { user: post.username } } },
  global: { plugins: [router] }
});

describe('shared Post Detail actions', () => {
  beforeEach(async () => {
    setActivePinia(createPinia());
    localStorage.clear();
    await router.push('/profile');
    const authStore = useAuthStore();
    authStore.session = { user: { id: '11111111-1111-4111-8111-111111111111' } };
    authStore.user = authStore.session.user;
    authStore.profileIdentity = {
      status: IDENTITY_STATUS.PROFILE_READY,
      authUserId: authStore.user.id,
      profileId,
      profile: { id: profileId, username: '@owner' },
      error: null
    };
    const appStore = useAppStore();
    appStore.setMemberProfile({ id: profileId, username: '@owner', initials: 'OW' });
    appStore.items = [{ id: itemId, name_zh: '白色經典襯衫', photo: '/shirt.jpg' }];
  });

  it('shows delete only to the post owner', () => {
    const own = mountDetail({ id: 'p1', user_id: profileId, username: '@owner', image: '/look.jpg', wearing: [], item_ids: [] });
    expect(own.find('.ootd-delete-action').exists()).toBe(true);

    const other = mountDetail({ id: 'p2', user_id: '99999999-9999-4999-8999-999999999999', username: '@other', image: '/look.jpg', wearing: [], item_ids: [] });
    expect(other.find('.ootd-delete-action').exists()).toBe(false);
  });

  it('renders tagged clothing with the shared product-image contract', () => {
    const wrapper = mountDetail({
      id: 'p1', user_id: profileId, username: '@owner', image: '/look.jpg',
      wearing: ['白色經典襯衫'], item_ids: [itemId]
    });
    expect(wrapper.text()).toContain('本套使用單品');
    expect(wrapper.text()).toContain('白色經典襯衫');
    expect(wrapper.find('.ootd-tagged-item .product-image').attributes('src')).toBe('/shirt.jpg');
  });
});
