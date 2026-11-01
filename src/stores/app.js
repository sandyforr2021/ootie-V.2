import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import {
  STORAGE_KEY,
  defaultItems,
  defaultProfile,
  defaultOotdPosts,
  defaultNotifications,
  defaultSosPosts,
  defaultFollowingUsers
} from '@/constants';
import { genuineContent } from '@/services/contentAuthenticity';
import { createClothingItem } from '@/services/clothingRepository';
import {
  GUEST_CLOSET_STORAGE_KEY,
  readGuestCloset,
  writeGuestCloset
} from '@/services/guestAccess';

export const useAppStore = defineStore('app', () => {
  // Load state from localStorage or use defaults (including migration from legacy qingnian keys)
  const loadState = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const state = raw ? JSON.parse(raw) : {};

      // Migrate from legacy/qingnian standalone notification storage if present
      const qingnianNotifs = localStorage.getItem('ootie-notifications-v1');
      if (qingnianNotifs && (!state || !state.notifications)) {
        try {
          const parsed = JSON.parse(qingnianNotifs);
          if (Array.isArray(parsed) && parsed.length > 0) {
            state.notifications = parsed;
          }
        } catch (e) {
          /* ignore */
        }
      }

      return Object.keys(state).length > 0 ? state : null;
    } catch (e) {
      return null;
    }
  };

  const saved = loadState();

  const normalizeUsername = (raw) => {
    if (!raw) return '';
    const trimmed = String(raw).trim();
    return trimmed.startsWith('@') ? trimmed.toLowerCase() : `@${trimmed.toLowerCase()}`;
  };

  const items = ref(genuineContent(saved?.items || []).filter(item => !defaultItems.some(fixture => fixture.id === item.id && fixture.photo === item.photo)));
  const wishlistProducts = ref([]);
  const cloneItems = (source) => JSON.parse(JSON.stringify(source || []));
  const localItemsSnapshot = ref(cloneItems(items.value));
  const isRemoteItemsActive = ref(false);
  const isGuestItemsActive = ref(false);
  const profile = ref(saved?.profile?.user_id && saved.profile.user_id !== defaultProfile.user_id ? saved.profile : { id: '', name: '', username: '', initials: '', avatar_url: '', bio: '', hearts: 0, helped: 0, likes: 0, public_closet: false });
  const ootdPosts = ref(genuineContent(saved?.ootdPosts || []));
  const notifications = ref(genuineContent(saved?.notifications || []));
  const sosPosts = ref(genuineContent(saved?.sosPosts || []));
  const outfitSuggestions = ref(genuineContent(saved?.outfitSuggestions || []));
  const customBrands = ref(
    saved && Array.isArray(saved.customBrands)
      ? saved.customBrands.map((brand) => String(brand || '').trim().replace(/\s+/g, ' ')).filter(Boolean)
      : []
  );

  const addCustomBrand = (rawBrand) => {
    const normalizedBrand = String(rawBrand || '').trim().replace(/\s+/g, ' ');
    if (!normalizedBrand) return { added: false, brand: '' };
    const existingBrand = customBrands.value.find(
      (brand) => brand.toLowerCase() === normalizedBrand.toLowerCase()
    );
    if (existingBrand) return { added: false, brand: existingBrand };
    customBrands.value.push(normalizedBrand);
    return { added: true, brand: normalizedBrand };
  };

  // Following users state
  const initialFollowing = saved && Array.isArray(saved.followingUsers)
    ? saved.followingUsers
    : [];
  const followingUsers = ref(initialFollowing.map(normalizeUsername).filter((u) => u !== normalizeUsername(profile.value.username)));

  // Sidebar collapsed state
  const isSidebarCollapsed = ref(localStorage.getItem('ootie-sidebar-collapsed') === 'true');
  const toggleSidebar = () => {
    isSidebarCollapsed.value = !isSidebarCollapsed.value;
    try {
      localStorage.setItem('ootie-sidebar-collapsed', String(isSidebarCollapsed.value));
    } catch (e) {
      /* ignore */
    }
  };

  const isFollowingUser = (rawUsername) => {
    const user = normalizeUsername(rawUsername);
    if (!user || user === normalizeUsername(profile.value.username)) return false;
    return followingUsers.value.includes(user);
  };

  const setFollowingUser = (rawUsername, shouldFollow) => {
    const user = normalizeUsername(rawUsername);
    if (!user || user === normalizeUsername(profile.value.username)) return false;
    if (shouldFollow) {
      if (!followingUsers.value.includes(user)) {
        followingUsers.value.push(user);
      }
    } else {
      followingUsers.value = followingUsers.value.filter((u) => u !== user);
    }
    // Sync following state across posts
    ootdPosts.value.forEach((post) => {
      if (normalizeUsername(post.username) === user) {
        post.following = shouldFollow;
      }
    });
    return shouldFollow;
  };

  const setMemberProfile = (remoteProfile = {}) => {
    const current = remoteProfile.id && remoteProfile.id === profile.value?.id ? profile.value : {};
    profile.value = {
      ...current,
      ...remoteProfile,
      name: remoteProfile.display_name || remoteProfile.name || current.name || '',
      bio: remoteProfile.slogan || remoteProfile.bio || current.bio || '',
      username: remoteProfile.username || current.username || '',
      avatar_url: remoteProfile.avatar_url ?? current.avatar_url ?? '',
      initials: remoteProfile.initials || current.initials || '',
      id: remoteProfile.id || current.id,
      user_id: remoteProfile.user_id || current.user_id
    };
  };

  const clearMemberProfile = () => {
    profile.value = { id: '', user_id: '', name: '', username: '', initials: '', avatar_url: '', bio: '', hearts: 0, helped: 0, likes: 0, public_closet: false };
  };

  // Toast state
  const toastMessage = ref('');
  const toastVisible = ref(false);
  const toastType = ref('info');
  const toastSyncStatus = ref(null);
  let toastTimer = null;

  const showToast = (message, options = {}) => {
    const normalizedOptions = typeof options === 'string' ? { type: options } : options;
    toastMessage.value = message;
    toastType.value = ['success', 'error', 'warning', 'info'].includes(normalizedOptions.type)
      ? normalizedOptions.type
      : 'info';
    toastSyncStatus.value = normalizedOptions.syncStatus || null;
    toastVisible.value = true;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastVisible.value = false;
    }, 2200);
  };

  // Modals visibility state
  const isItemFormOpen = ref(false);
  const editingItemId = ref(null);
  const isDetailOpen = ref(false);
  const selectedItemId = ref(null);

  const isOotdFormOpen = ref(false);
  const ootdDraftItemIds = ref([]);
  const isSosFormOpen = ref(false);
  const sosTargetItemId = ref(null);
  const isSuggestionFormOpen = ref(false);
  const activeSosId = ref(null);
  const isSosDetailOpen = ref(false);
  const activeSosDetailId = ref(null);
  const isSosCloseConfirmOpen = ref(false);
  const sosToCloseId = ref(null);

  const isProfileEditOpen = ref(false);
  const isCommentOpen = ref(false);
  const activeCommentPostId = ref(null);
  const highlightedCommentId = ref(null);
  const isNotificationOpen = ref(false);

  // Guest access state. Guest clothing is intentionally isolated from the
  // legacy app snapshot and from the authenticated remote closet.
  const isLoginGateOpen = ref(false);
  const loginGateReason = ref('AUTH_REQUIRED');
  const loginGateReturnTo = ref('/');
  const isGuestImportOpen = ref(false);
  const guestImportItems = ref([]);
  const guestImportProfileId = ref(null);
  const guestImportLoading = ref(false);
  const guestImportError = ref('');

  // Persistence watcher
  const saveState = () => {
    try {
      if (!isRemoteItemsActive.value) {
        localItemsSnapshot.value = cloneItems(items.value);
      }
      if (isGuestItemsActive.value) {
        writeGuestCloset(items.value);
      }
      const persistedItems = isRemoteItemsActive.value || isGuestItemsActive.value
        ? localItemsSnapshot.value
        : items.value;
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        items: isGuestItemsActive.value ? [] : persistedItems,
        profile: profile.value,
        ootdPosts: ootdPosts.value,
        notifications: notifications.value,
        sosPosts: sosPosts.value,
        outfitSuggestions: outfitSuggestions.value,
        followingUsers: followingUsers.value,
        customBrands: customBrands.value
      }));
    } catch (e) {
      /* ignore */
    }
  };

  // Remote closet data is display-only in BATCH-02.5. Keep the local/demo
  // snapshot separate so a remote account's clothing cannot become local data.
  const beginRemoteItems = () => {
    if (!isRemoteItemsActive.value) {
      localItemsSnapshot.value = cloneItems(items.value);
      isRemoteItemsActive.value = true;
      isGuestItemsActive.value = false;
    }
  };

  const restoreLocalItems = () => {
    if (isRemoteItemsActive.value) {
      isRemoteItemsActive.value = false;
      items.value = cloneItems(localItemsSnapshot.value);
    }
  };

  const loadGuestItems = () => {
    const guestItems = readGuestCloset();
    isRemoteItemsActive.value = false;
    isGuestItemsActive.value = true;
    localItemsSnapshot.value = cloneItems(guestItems);
    items.value = cloneItems(guestItems);
    return items.value;
  };

  const persistGuestItems = (nextItems) => {
    if (!isGuestItemsActive.value) return false;
    const normalized = cloneItems(nextItems);
    if (!writeGuestCloset(normalized)) return false;
    localItemsSnapshot.value = cloneItems(normalized);
    items.value = normalized;
    return true;
  };

  const openLoginGate = (reason = 'AUTH_REQUIRED', returnTo = '/') => {
    loginGateReason.value = reason;
    loginGateReturnTo.value = returnTo || '/';
    isLoginGateOpen.value = true;
  };

  const closeLoginGate = () => {
    isLoginGateOpen.value = false;
  };

  const prepareGuestImport = (profileId) => {
    const pending = readGuestCloset();
    if (!pending.length || !profileId) return false;
    guestImportItems.value = cloneItems(pending);
    guestImportProfileId.value = profileId;
    guestImportError.value = '';
    isGuestImportOpen.value = true;
    return true;
  };

  const dismissGuestImport = () => {
    isGuestImportOpen.value = false;
    guestImportError.value = '';
  };

  const importGuestItems = async () => {
    if (!guestImportProfileId.value || !guestImportItems.value.length) {
      dismissGuestImport();
      return { ok: true, imported: [] };
    }

    guestImportLoading.value = true;
    guestImportError.value = '';
    const imported = [];
    const failures = [];
    try {
      for (const item of guestImportItems.value) {
        try {
          await createClothingItem(guestImportProfileId.value, item);
          imported.push(item.id);
        } catch (error) {
          failures.push(error);
        }
      }

      // Remove only rows whose remote create was confirmed. Failed rows stay
      // local so the user can retry them without losing the source copy.
      if (failures.length) {
        const remaining = guestImportItems.value.filter((item) => !imported.includes(item.id));
        if (writeGuestCloset(remaining)) {
          guestImportItems.value = cloneItems(remaining);
        }
        guestImportError.value = '部分衣物尚未匯入，失敗的試用衣物仍保留在此裝置。';
        return { ok: false, imported, failures };
      }

      if (!writeGuestCloset([])) {
        guestImportError.value = '匯入完成，但試用衣物清理失敗，原資料仍保留。';
        return { ok: false, imported, failures: [] };
      }

      guestImportItems.value = [];
      isGuestImportOpen.value = false;
      showToast(`已將 ${imported.length} 件試用衣物加入會員衣櫥`, { type: 'success' });
      return { ok: true, imported };
    } finally {
      guestImportLoading.value = false;
    }
  };

  watch(
    [items, profile, ootdPosts, notifications, sosPosts, outfitSuggestions, followingUsers, customBrands],
    () => {
      saveState();
    },
    { deep: true }
  );

  const addNotification = (text, target = 'profile', options = {}) => {
    notifications.value.unshift({
      id: `notification-${Date.now()}`,
      text,
      time: '剛剛',
      read: false,
      target,
      type: options.type || 'system',
      postId: options.postId,
      commentId: options.commentId,
      sosId: options.sosId,
      userId: options.userId
    });
  };

  return {
    items,
    wishlistProducts,
    isRemoteItemsActive,
    isGuestItemsActive,
    beginRemoteItems,
    restoreLocalItems,
    loadGuestItems,
    persistGuestItems,
    guestClosetStorageKey: GUEST_CLOSET_STORAGE_KEY,
    profile,
    ootdPosts,
    notifications,
    sosPosts,
    outfitSuggestions,
    followingUsers,
    customBrands,
    isSidebarCollapsed,
    toggleSidebar,
    normalizeUsername,
    isFollowingUser,
    setFollowingUser,
    addCustomBrand,
    setMemberProfile,
    clearMemberProfile,
    toastMessage,
    toastVisible,
    toastType,
    toastSyncStatus,
    showToast,
    // Modals
    isItemFormOpen,
    editingItemId,
    isDetailOpen,
    selectedItemId,
    isOotdFormOpen,
    ootdDraftItemIds,
    isSosFormOpen,
    sosTargetItemId,
    isSuggestionFormOpen,
    activeSosId,
    isSosDetailOpen,
    activeSosDetailId,
    isSosCloseConfirmOpen,
    sosToCloseId,
    isProfileEditOpen,
    isCommentOpen,
    activeCommentPostId,
    highlightedCommentId,
    isNotificationOpen,
    isLoginGateOpen,
    loginGateReason,
    loginGateReturnTo,
    openLoginGate,
    closeLoginGate,
    isGuestImportOpen,
    guestImportItems,
    guestImportLoading,
    guestImportError,
    prepareGuestImport,
    dismissGuestImport,
    importGuestItems,
    addNotification
  };
});

