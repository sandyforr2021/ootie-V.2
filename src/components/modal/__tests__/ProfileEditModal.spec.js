import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { reactive } from 'vue';
import ProfileEditModal from '../ProfileEditModal.vue';
import { validatePublicProfileInput } from '@/services/profileContract';

const stores = vi.hoisted(() => ({ auth: null, app: null }));
vi.mock('@/stores/auth', () => ({ useAuthStore: () => stores.auth }));
vi.mock('@/stores/app', () => ({ useAppStore: () => stores.app }));

describe('Profile editor remote persistence', () => {
  beforeEach(() => {
    stores.auth = reactive({ profile: {
      name: 'Old legacy name', display_name: 'Current nickname', username: '@member',
      display_name_changed_at: new Date().toISOString(), avatar_url: 'https://example.test/avatar.webp'
    }, user: { email: 'member@example.test' }, loading: false, accountPrivateLoading: false,
    accountPrivateError: '', errorMsg: '', loadPrivateAccount: vi.fn().mockResolvedValue({ full_name: 'Member' }),
    saveProfileAccount: vi.fn().mockResolvedValue(false) });
    stores.app = reactive({ isProfileEditOpen: true, profile: {}, setMemberProfile: vi.fn(), showToast: vi.fn() });
  });

  it('keeps the current nickname when saving an avatar during the name cooldown', async () => {
    const wrapper = mount(ProfileEditModal);
    await flushPromises();
    expect(wrapper.get('#editProfileName').element.value).toBe('Current nickname');
    stores.auth.saveProfileAccount.mockImplementation(async input => {
      validatePublicProfileInput(input, { currentProfile: stores.auth.profile });
      return true;
    });
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(stores.app.isProfileEditOpen).toBe(false);
    wrapper.unmount();
  });

  it('retains an avatar selected while private account data is loading', async () => {
    let finishLoading;
    stores.auth.loadPrivateAccount.mockReturnValue(new Promise(resolve => { finishLoading = resolve; }));
    vi.stubGlobal('FileReader', class {
      readAsDataURL() { this.onload({ target: { result: 'data:image/webp;base64,YXZhdGFy' } }); }
    });
    const wrapper = mount(ProfileEditModal);
    const file = new File(['avatar'], 'avatar.webp', { type: 'image/webp' });
    Object.defineProperty(wrapper.get('#avatarUploadFile').element, 'files', { value: [file] });
    await wrapper.get('#avatarUploadFile').trigger('change');
    finishLoading({ full_name: 'Member' });
    await flushPromises();
    await wrapper.get('form').trigger('submit');
    expect(stores.auth.saveProfileAccount).toHaveBeenCalledWith(expect.any(Object), file);
    expect(wrapper.get('.avatar-preview').attributes('src')).toContain('data:image/webp');
    wrapper.unmount();
    vi.unstubAllGlobals();
  });

  it('blocks saving until private data is loaded, including a failed read', async () => {
    let finishLoading;
    stores.auth.loadPrivateAccount.mockReturnValue(new Promise(resolve => { finishLoading = resolve; }));
    const wrapper = mount(ProfileEditModal);
    await wrapper.get('form').trigger('submit');
    expect(stores.auth.saveProfileAccount).not.toHaveBeenCalled();
    stores.auth.accountPrivateError = '讀取失敗，請重新開啟後再試。';
    finishLoading(null);
    await flushPromises();
    await wrapper.get('form').trigger('submit');
    expect(stores.auth.saveProfileAccount).not.toHaveBeenCalled();
    expect(wrapper.get('[role="alert"]').text()).toContain('讀取失敗');
    wrapper.unmount();
  });
});
