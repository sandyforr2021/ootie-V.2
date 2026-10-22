import { installLocalInteractionFixtures } from '../../../tests/localInteractionFixtures.js';
import { beforeEach, describe, expect, it } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createWebHistory } from 'vue-router';
import SosView from '../SosView.vue';
import SosFormModal from '@/components/modal/SosFormModal.vue';
import SuggestionModal from '@/components/modal/SuggestionModal.vue';
import { useAppStore } from '@/stores/app';
import { useSosStore } from '@/stores/sos';

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
});
