import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createWebHistory } from 'vue-router';

const ootdMedia = vi.hoisted(() => ({
  validateOotdImage: vi.fn((file) => file),
  uploadOotdImage: vi.fn().mockRejectedValue(Object.assign(new Error('storage unavailable'), {
    userMessage: 'OOTD 圖片儲存空間尚未啟用，暫時無法發布。'
  })),
  removeOotdImage: vi.fn()
}));
vi.mock('@/services/ootdMedia', () => ootdMedia);
vi.mock('@/services/clothingRepository', () => ({ getCurrentUserItems: vi.fn().mockResolvedValue([]) }));

import ProfileView from '../ProfileView.vue';
import ProfileEditModal from '@/components/modal/ProfileEditModal.vue';
import OotdFormModal from '@/components/modal/OotdFormModal.vue';
import OotdDetailView from '../OotdDetailView.vue';
import { useAppStore } from '@/stores/app';
import { useAuthStore } from '@/stores/auth';
import { useOotdStore } from '@/stores/ootd';
import { IDENTITY_STATUS } from '@/services/identityResolver';

enableAutoUnmount(afterEach);

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/explore', component: { template: '<div />' } },
    { path: '/profile', component: ProfileView },
    { path: '/ootd/:id', component: OotdDetailView }
  ]
});

describe('Profile & OOTD Integration Tests (legacy/sinsin features)', () => {
  let pinia;
  beforeEach(async () => {
    ootdMedia.validateOotdImage.mockImplementation((file) => file);
    ootdMedia.uploadOotdImage.mockRejectedValue(Object.assign(new Error('storage unavailable'), {
      userMessage: 'OOTD 圖片儲存空間尚未啟用，暫時無法發布。'
    }));
    ootdMedia.removeOotdImage.mockResolvedValue(true);
    pinia = createPinia();
    setActivePinia(pinia);
    localStorage.clear();

    const appStore = useAppStore();
    const authStore = useAuthStore();
    authStore.session = { user: { id: '11111111-1111-4111-8111-111111111111' } };
    authStore.user = authStore.session.user;
    authStore.profileIdentity = {
      status: IDENTITY_STATUS.PROFILE_READY,
      authUserId: authStore.user.id,
      profileId: '22222222-2222-4222-8222-222222222222',
      profile: { id: '22222222-2222-4222-8222-222222222222' },
      error: null
    };
    // Add an initial user post for @hayley
    appStore.ootdPosts.unshift({
      id: 'post-hayley-1',
      username: '@hayley',
      user_id: 'user-01',
      initials: 'HL',
      image: 'https://images.unsplash.com/photo-1483985988355-763728e1935b',
      caption: 'Hayley 的首篇穿搭測試',
      wearing: ['經典襯衫', '牛仔褲'],
      hashtags: ['#hayley', '#ootd'],
      likes: 12,
      comments: 3,
      created_at: '2026-09-25T10:00:00.000Z'
    });

    await router.push('/profile');
  });

  it('1. Profile Information & Avatar Upload/Crop Integration', async () => {
    const appStore = useAppStore();

    const viewWrapper = mount(ProfileView, {
      global: { plugins: [pinia, router] }
    });
    const modalWrapper = mount(ProfileEditModal, { global: { plugins: [pinia, router] } });

    // Initial state check: no avatar image, shows initials
    expect(viewWrapper.find('.profile-avatar').text()).toBe('HL');
    expect(viewWrapper.find('.profile-avatar img').exists()).toBe(false);

    // Click "編輯資料" button
    await viewWrapper.find('.profile-actions button.secondary').trigger('click');
    expect(appStore.isProfileEditOpen).toBe(true);

    // Update form fields in ProfileEditModal
    const nameInput = modalWrapper.find('#editProfileName');
    await nameInput.setValue('Hayley Lin Updated');

    const usernameInput = modalWrapper.find('#editProfileUsername');
    await usernameInput.setValue('hayley_new');

    const bioInput = modalWrapper.find('#editProfileBio');
    await bioInput.setValue('新的個人簡介與穿搭靈感。');

    // Simulate avatar file selection
    const avatarInput = modalWrapper.find('#avatarUploadFile');
    const dummyFile = new File(['dummy content'], 'avatar.png', { type: 'image/png' });
    Object.defineProperty(avatarInput.element, 'files', {
      value: [dummyFile]
    });

    // Mock FileReader behavior for testing
    const originalFileReader = window.FileReader;
    window.FileReader = class MockFileReader {
      readAsDataURL() {
        this.onload({ target: { result: 'data:image/jpeg;base64,mockcroppedavatar' } });
      }
    };

    await avatarInput.trigger('change');
    await modalWrapper.vm.$nextTick();

    // Check crop controls are displayed
    expect(modalWrapper.find('.avatar-crop-controls').exists()).toBe(true);

    // Submit form
    await modalWrapper.find('form').trigger('submit.prevent');
    await viewWrapper.vm.$nextTick();

    // Restore FileReader
    window.FileReader = originalFileReader;

    // Verify Profile Store state
    expect(useAuthStore().errorMsg).toBe('');

    // Verify View updates with image avatar
    expect(modalWrapper.find('.avatar-preview').exists()).toBe(true);
  });

  it('2. Public Closet Toggle Integration', async () => {
    const appStore = useAppStore();
    const wrapper = mount(ProfileView, {
      global: { plugins: [pinia, router] }
    });

    const initialStatus = appStore.profile.public_closet;
    const switchBtn = wrapper.find('.switch');

    await switchBtn.trigger('click');
    expect(appStore.profile.public_closet).toBe(!initialStatus);
    expect(appStore.toastMessage).toBe(appStore.profile.public_closet ? '衣櫥已在此裝置設為公開' : '衣櫥已在此裝置設為私人');
    expect(appStore.toastSyncStatus).toBe('LOCAL_ONLY');

    await switchBtn.trigger('click');
    expect(appStore.profile.public_closet).toBe(initialStatus);
  });

  it('3. OOTD publish failure keeps the draft open and does not create a local-only post', async () => {
    const appStore = useAppStore();
    const ootdStore = useOotdStore();

    const viewWrapper = mount(ProfileView, {
      global: { plugins: [pinia, router] }
    });
    const formModalWrapper = mount(OotdFormModal, { global: { plugins: [pinia, router] } });

    // Initial user posts count
    const initialUserPostsCount = viewWrapper.findAll('.ootd-card').length;
    expect(initialUserPostsCount).toBeGreaterThan(0);

    // 3a. Create new OOTD post
    await viewWrapper.find('.profile-actions button.primary').trigger('click');
    expect(appStore.isOotdFormOpen).toBe(true);
    expect(ootdStore.editingPostId).toBeNull();

    // Fill in OOTD form
    const photoInput = formModalWrapper.find('#ootdPhotoFile');
    const photoFile = new File(['photo'], 'ootd.jpg', { type: 'image/jpeg' });
    Object.defineProperty(photoInput.element, 'files', { value: [photoFile] });

    const originalFileReader = window.FileReader;
    window.FileReader = class MockFileReader {
      readAsDataURL() {
        this.onload({ target: { result: 'data:image/jpeg;base64,mockootdphoto' } });
      }
    };

    await photoInput.trigger('change');
    await formModalWrapper.vm.$nextTick();

    await formModalWrapper.find('#ootdCaption').setValue('整合測試新發布 OOTD');
    await formModalWrapper.find('#ootdHashtags').setValue('#integration #test');

    await formModalWrapper.find('form').trigger('submit.prevent');
    await flushPromises();
    await viewWrapper.vm.$nextTick();

    window.FileReader = originalFileReader;

    // Formal publishing is remote-first. With Storage unavailable in this
    // integration fixture, no local-only post may be created and the draft
    // remains open for retry.
    const newCards = viewWrapper.findAll('.ootd-card');
    expect(appStore.isOotdFormOpen).toBe(true);
    expect(newCards.length).toBe(initialUserPostsCount);
    expect(formModalWrapper.find('#ootdCaption').element.value).toBe('整合測試新發布 OOTD');
    expect(formModalWrapper.text()).toContain('OOTD 圖片儲存空間尚未啟用，暫時無法發布。');
  });

  it('4. OOTD Share Link Integration', async () => {
    const ootdStore = useOotdStore();
    const shareSpy = vi.spyOn(ootdStore, 'sharePost');

    const wrapper = mount(ProfileView, {
      global: { plugins: [pinia, router] }
    });

    const firstCard = wrapper.find('.ootd-card');
    expect(firstCard.exists()).toBe(true);

    const firstCardActions = firstCard.findAll('.ootd-action');
    const shareBtn = firstCardActions.find((b) => b.text() === '分享');

    await shareBtn.trigger('click');
    expect(shareSpy).toHaveBeenCalled();
  });

  it('5. OOTD Single Detail Page Route Integration', async () => {
    const appStore = useAppStore();
    const testPost = appStore.ootdPosts[0];

    await router.push(`/ootd/${testPost.id}`);
    await router.isReady();

    const wrapper = mount(OotdDetailView, {
      global: {
        plugins: [router]
      }
    });

    await flushPromises();

    expect(wrapper.text()).toContain('OOTD STORY');
    expect(wrapper.text()).toContain(testPost.caption);
    expect(wrapper.find('.ootd-photo').attributes('src')).toBe(testPost.image);
  });

});
