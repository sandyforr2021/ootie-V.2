import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { supabase } from '@/services/supabase';
import { getServiceErrorMessage, normalizeServiceError } from '@/services/serviceError';
import { createIdentityResolver, IDENTITY_STATUS } from '@/services/identityResolver';
import { bootstrapOAuthProfile, loadProfileByAuthUserId, getPrivateProfile, updatePublicProfile, upsertPrivateProfile } from '@/services/profileRepository';
import { validatePublicProfileInput, validatePrivateProfileInput } from '@/services/profileContract';
import { uploadAvatar, removeAvatar } from '@/services/avatarService';
import { signInWithProvider, consumeOAuthReturnTo } from '@/services/authProvider';
import { useAppStore } from '@/stores/app';
import { releasePrivateClothingPhotoUrls, releaseSharedClothingPhotoUrls } from '@/services/clothingMediaRepository';

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null);
  const session = ref(null);
  const isAuthModalOpen = ref(false);
  const authMode = ref('login'); // 'login' | 'register'
  const pendingAction = ref(null);
  const oauthReturnTo = ref('/');
  const loading = ref(false);
  const initialized = ref(false);
  const errorMsg = ref('');
  const accountPrivate = ref(null);
  const accountPrivateLoading = ref(false);
  const accountPrivateError = ref('');
  const profileIdentity = ref({
    status: IDENTITY_STATUS.UNAUTHENTICATED,
    authUserId: null,
    profileId: null,
    profile: null,
    error: null
  });
  let profileLoader = loadProfileByAuthUserId;
  let profileResolutionVersion = 0;
  let authStateChangeTimer = null;
  let authStateEventVersion = 0;

  const resolveProfileIdentity = async (currentSession = session.value) => {
    const resolutionVersion = ++profileResolutionVersion;
    const isCurrentResolution = () => resolutionVersion === profileResolutionVersion;
    const resolver = createIdentityResolver({
      loadProfileByAuthUserId: profileLoader,
      onStateChange: (state) => {
        if (isCurrentResolution()) profileIdentity.value = state;
      }
    });
    let resolved = await resolver.resolve(currentSession);
    if (!isCurrentResolution()) return profileIdentity.value;
    const newGoogleProfile = resolved.status === IDENTITY_STATUS.PROFILE_READY
      && !resolved.profile?.username?.trim()
      && currentSession?.user?.app_metadata?.provider === 'google';
    if ((resolved.status === IDENTITY_STATUS.PROFILE_MISSING || newGoogleProfile) && currentSession?.user) {
      try {
        await bootstrapOAuthProfile(currentSession);
        if (!isCurrentResolution()) return profileIdentity.value;
        resolved = await resolver.resolve(currentSession);
      } catch (error) {
        if (!isCurrentResolution()) return profileIdentity.value;
        profileIdentity.value = {
          status: IDENTITY_STATUS.PROFILE_QUERY_ERROR,
          authUserId: currentSession.user.id,
          profileId: null,
          profile: null,
          error: normalizeServiceError(error)
        };
        return profileIdentity.value;
      }
    }
    if (!isCurrentResolution()) return profileIdentity.value;
    if (resolved.status === IDENTITY_STATUS.PROFILE_READY && resolved.profile) {
      useAppStore().setMemberProfile(resolved.profile);
    } else if (!currentSession) {
      useAppStore().clearMemberProfile();
      accountPrivate.value = null;
    }
    return resolved;
  };

  // Supabase adapter is default; can be overridden in tests or special lifecycle phases.
  const setProfileIdentityLoader = (loader) => {
    profileLoader = typeof loader === 'function' ? loader : loadProfileByAuthUserId;
  };

  const isLoggedIn = computed(() => !!user.value);
  const isGuest = computed(() => !session.value);
  const profileId = computed(() => profileIdentity.value.profileId);
  const profile = computed(() => profileIdentity.value.profile);
  const isProfileReady = computed(() => profileIdentity.value.status === IDENTITY_STATUS.PROFILE_READY);
  const isProfileMissing = computed(() => profileIdentity.value.status === IDENTITY_STATUS.PROFILE_MISSING);
  const isMember = computed(() => isLoggedIn.value && isProfileReady.value);

  const offerGuestImport = () => {
    if (!isMember.value || !profileId.value) return;
    useAppStore().prepareGuestImport(profileId.value);
  };

  // Initialize only from the real Supabase session. Runtime mock identity is forbidden.
  const initAuth = async () => {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      session.value = data?.session || null;
      user.value = data?.session?.user || null;
      await resolveProfileIdentity(session.value);
      offerGuestImport();

      supabase.auth.onAuthStateChange((_event, currentSession) => {
        if (user.value?.id !== currentSession?.user?.id) releaseSharedClothingPhotoUrls();
        // Supabase awaits this callback while holding its auth lock. Start
        // profile requests in a later task so other SDK calls can complete.
        profileResolutionVersion += 1;
        const eventVersion = ++authStateEventVersion;
        session.value = currentSession;
        user.value = currentSession?.user || null;
        if (authStateChangeTimer !== null) clearTimeout(authStateChangeTimer);
        authStateChangeTimer = setTimeout(() => {
          authStateChangeTimer = null;
          void resolveProfileIdentity(currentSession)
            .then(() => {
              if (eventVersion === authStateEventVersion) offerGuestImport();
            })
            .catch((error) => {
              if (eventVersion === authStateEventVersion) errorMsg.value = getServiceErrorMessage(error);
            });
        }, 0);
      });
    } catch (err) {
      errorMsg.value = getServiceErrorMessage(err);
      user.value = null;
      session.value = null;
      profileIdentity.value = {
        status: IDENTITY_STATUS.PROFILE_QUERY_ERROR,
        authUserId: null,
        profileId: null,
        profile: null,
        error: err
      };
    } finally {
      initialized.value = true;
    }
  };

  const openAuthModal = (mode = 'login', onAuthenticatedCallback = null, returnTo = '/') => {
    authMode.value = mode;
    errorMsg.value = '';
    pendingAction.value = onAuthenticatedCallback;
    oauthReturnTo.value = returnTo || '/';
    isAuthModalOpen.value = true;
  };

  const closeAuthModal = () => {
    isAuthModalOpen.value = false;
    errorMsg.value = '';
    pendingAction.value = null;
  };

  /**
   * Guest-First Guard: Executes callback if logged in, otherwise opens Auth Modal.
   */
  const requireAuth = (callback) => {
    if (isLoggedIn.value) {
      if (typeof callback === 'function') callback();
      return true;
    } else {
      openAuthModal('login', callback);
      return false;
    }
  };

  const login = async (email, password) => {
    loading.value = true;
    errorMsg.value = '';
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        errorMsg.value = getServiceErrorMessage(error);
        return false;
      }

      user.value = data.user;
      session.value = data.session;
      await resolveProfileIdentity(data.session);

      // Execute pending action if any
      if (pendingAction.value && typeof pendingAction.value === 'function') {
        const action = pendingAction.value;
        pendingAction.value = null;
        action();
      }

      closeAuthModal();
      offerGuestImport();
      return true;
    } catch (err) {
      errorMsg.value = getServiceErrorMessage(err);
      return false;
    } finally {
      loading.value = false;
    }
  };

  const signInWithProviderAction = async (provider, returnTo = oauthReturnTo.value || '/') => {
    loading.value = true;
    errorMsg.value = '';
    oauthReturnTo.value = returnTo || '/';
    try {
      await signInWithProvider(provider, oauthReturnTo.value);
      return true;
    } catch (err) {
      errorMsg.value = normalizeServiceError(err).userMessage;
      return false;
    } finally {
      loading.value = false;
    }
  };

  const loadPrivateAccount = async () => {
    if (!isMember.value || !profileId.value) return null;
    accountPrivateLoading.value = true;
    accountPrivateError.value = '';
    try {
      accountPrivate.value = await getPrivateProfile(profileId.value);
      return accountPrivate.value;
    } catch (err) {
      accountPrivateError.value = getServiceErrorMessage(err);
      return null;
    } finally {
      accountPrivateLoading.value = false;
    }
  };

  const saveProfileAccount = async ({ display_name, username, slogan, full_name, birth_date, phone }, avatarFile = null) => {
    if (!isMember.value || !profileId.value) {
      errorMsg.value = getServiceErrorMessage({ code: 'AUTH_REQUIRED' });
      return false;
    }
    loading.value = true;
    errorMsg.value = '';
    try {
      const publicData = validatePublicProfileInput({ display_name, username, slogan }, { currentProfile: profile.value });
      const privateData = validatePrivateProfileInput({ full_name, birth_date, phone });
      const oldAvatarPath = profile.value?.avatar_storage_path;
      const uploadedAvatar = avatarFile ? await uploadAvatar(avatarFile, user.value?.id) : null;
      const updatedPublic = await updatePublicProfile(profileId.value, {
        ...publicData,
        ...(uploadedAvatar ? { avatar_url: uploadedAvatar.publicUrl, avatar_storage_path: uploadedAvatar.path } : {})
      });
      const updatedPrivate = await upsertPrivateProfile(profileId.value, privateData);
      accountPrivate.value = updatedPrivate;
      const currentPublic = { ...useAppStore().profile, ...(profile.value || {}) };
      const nextPublic = { ...currentPublic, ...publicData, ...(updatedPublic || {}) };
      useAppStore().setMemberProfile(nextPublic);
      profileIdentity.value = { ...profileIdentity.value, profile: { ...profileIdentity.value.profile, ...nextPublic } };
      if (uploadedAvatar && oldAvatarPath && oldAvatarPath !== uploadedAvatar.path) {
        try { await removeAvatar(oldAvatarPath); } catch (e) { /* cleanup is non-blocking */ }
      }
      return true;
    } catch (err) {
      errorMsg.value = normalizeServiceError(err).userMessage;
      return false;
    } finally {
      loading.value = false;
    }
  };

  const register = async (email, password, fullName = '') => {
    loading.value = true;
    errorMsg.value = '';
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: typeof window !== 'undefined' ? `${window.location.origin}/` : undefined,
          data: {
            full_name: fullName
          }
        }
      });

      if (error) {
        errorMsg.value = getServiceErrorMessage(error);
        return false;
      }

      if (data.user && data.session) {
        user.value = data.user;
        session.value = data.session;
        await resolveProfileIdentity(data.session);
      } else if (data.user) {
        user.value = null;
        session.value = null;
        errorMsg.value = '註冊完成，請先驗證電子郵件後再登入。';
        return false;
      }

      if (pendingAction.value && typeof pendingAction.value === 'function') {
        const action = pendingAction.value;
        pendingAction.value = null;
        action();
      }

      closeAuthModal();
      offerGuestImport();
      return true;
    } catch (err) {
      errorMsg.value = getServiceErrorMessage(err);
      return false;
    } finally {
      loading.value = false;
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      releasePrivateClothingPhotoUrls();
      releaseSharedClothingPhotoUrls();
      user.value = null;
      session.value = null;
      await resolveProfileIdentity(null);
    }
  };

  const requestPasswordReset = async () => {
    const email = user.value?.email;
    if (!email) {
      errorMsg.value = '目前帳號沒有可用的電子郵件。';
      return false;
    }
    loading.value = true;
    errorMsg.value = '';
    try {
      const redirectTo = `${window.location.origin}/settings?recovery=1`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;
      return true;
    } catch (err) {
      errorMsg.value = normalizeServiceError(err).userMessage;
      return false;
    } finally {
      loading.value = false;
    }
  };

  const updatePassword = async (password, currentPassword = '') => {
    const nextPassword = String(password || '');
    if (nextPassword.length < 8) {
      errorMsg.value = '新密碼至少需要 8 個字元。';
      return false;
    }
    loading.value = true;
    errorMsg.value = '';
    try {
      const attributes = { password: nextPassword };
      if (currentPassword) attributes.currentPassword = currentPassword;
      const { error } = await supabase.auth.updateUser(attributes);
      if (error) throw error;
      return true;
    } catch (err) {
      errorMsg.value = normalizeServiceError(err).userMessage;
      return false;
    } finally {
      loading.value = false;
    }
  };

  return {
    user,
    session,
    isLoggedIn,
    isGuest,
    profileId,
    profile,
    isProfileReady,
    isProfileMissing,
    isMember,
    isAuthModalOpen,
    authMode,
    loading,
    initialized,
    errorMsg,
    accountPrivate,
    accountPrivateLoading,
    accountPrivateError,
    oauthReturnTo,
    profileIdentity,
    setProfileIdentityLoader,
    resolveProfileIdentity,
    initAuth,
    openAuthModal,
    closeAuthModal,
    requireAuth,
    login,
    register,
    signInWithProvider: signInWithProviderAction,
    loadPrivateAccount,
    saveProfileAccount,
    requestPasswordReset,
    updatePassword,
    consumeOAuthReturnTo,
    logout
  };
});
