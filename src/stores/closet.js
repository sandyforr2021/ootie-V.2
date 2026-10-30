import { categoryFamily } from '@/services/commerce';
import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import { useAppStore } from './app';
import { useAuthStore } from './auth';
import {
  DISUSED_DAYS_THRESHOLD,
  DISUSED_WEAR_COUNT_THRESHOLD,
  getColorFamilyForPrimaryColor,
  colorHexValues,
  labels
} from '@/constants';
import {
  ASYNC_STATUS,
  SYNC_STATUS,
  createAsyncState,
  loadingState,
  successState,
  failedState,
  syncingState
} from '@/contracts/asyncState';
import {
  getCurrentUserItems,
  createClothingItem,
  updateClothingItem,
  deleteClothingItem
} from '@/services/clothingRepository';
import {
  uploadClothingMedia,
  cleanupUploadedClothingMedia,
  removeReplacedDerivative,
  createPrivateClothingPhotoUrl,
  cleanupDeletedItemMedia,
  getAuthenticatedMediaUserId,
  releasePrivateClothingPhotoUrls
} from '@/services/clothingMediaRepository';
import {
  SERVICE_ERROR_CODE,
  ServiceError,
  normalizeServiceError
} from '@/services/serviceError';
import { canAddGuestItem } from '@/services/guestAccess';

export const CLOSET_DATA_MODE = Object.freeze({
  LOCAL: 'LOCAL',
  GUEST: 'GUEST',
  REMOTE: 'REMOTE',
  BLOCKED: 'BLOCKED'
});

const isUuid = (str) =>
  typeof str === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

export const useClosetStore = defineStore('closet', () => {
  const appStore = useAppStore();

  const activeCategory = ref('All');
  const favoritesOnly = ref(false);
  const searchQuery = ref('');
  const colorFamilyFilter = ref('');
  const colorFilter = ref('');
  const seasonFilter = ref('');
  const styleFilter = ref('');
  const remoteState = ref(createAsyncState());
  const mutationState = ref(createAsyncState());
  const dataMode = ref(CLOSET_DATA_MODE.LOCAL);
  let activeRemoteProfileId = null;
  let activeRemoteRead = null;
  let remoteReadVersion = 0;
  const invalidateRemoteRead = () => { remoteReadVersion++; activeRemoteProfileId = null; activeRemoteRead = null; };
  const authStore = useAuthStore();
  watch(() => authStore.session?.user?.id || null, () => {
    invalidateRemoteRead();
    if (appStore.isRemoteItemsActive) appStore.items = [];
    releasePrivateClothingPhotoUrls();
  }, { flush: 'sync' });

  const useLocalItems = () => {
    releasePrivateClothingPhotoUrls();
    appStore.restoreLocalItems();
    dataMode.value = CLOSET_DATA_MODE.LOCAL;
    invalidateRemoteRead();
    remoteState.value = createAsyncState();
  };

  const useGuestItems = () => {
    releasePrivateClothingPhotoUrls();
    appStore.loadGuestItems();
    dataMode.value = CLOSET_DATA_MODE.GUEST;
    invalidateRemoteRead();
    remoteState.value = createAsyncState();
  };

  const setAwaitingProfile = () => {
    dataMode.value = CLOSET_DATA_MODE.BLOCKED;
    remoteState.value = loadingState(remoteState.value);
  };

  const blockRemoteRead = (error) => {
    releasePrivateClothingPhotoUrls();
    const normalized = normalizeServiceError(error);
    dataMode.value = CLOSET_DATA_MODE.BLOCKED;
    invalidateRemoteRead();
    remoteState.value = failedState(normalized, {
      remote: true,
      syncStatus: SYNC_STATUS.REMOTE_FAILED,
      denied: normalized.code === 'PERMISSION_DENIED'
    });
  };

  const blockedMutation = (code = SERVICE_ERROR_CODE.PROFILE_NOT_READY) => {
    const error = new ServiceError(code);
    mutationState.value = failedState(error, {
      remote: dataMode.value === CLOSET_DATA_MODE.REMOTE,
      denied: error.code === SERVICE_ERROR_CODE.PERMISSION_DENIED
    });
    appStore.showToast(error.userMessage, { type: 'warning' });
    return { ok: false, error };
  };

  const canApplyLocalMutation = () => {
    return [CLOSET_DATA_MODE.LOCAL, CLOSET_DATA_MODE.GUEST].includes(dataMode.value);
  };

  const canAddItem = () => {
    if (dataMode.value !== CLOSET_DATA_MODE.GUEST) return true;
    return canAddGuestItem(appStore.items);
  };

  const guestQuotaFailure = () => {
    const error = new ServiceError(SERVICE_ERROR_CODE.GUEST_CLOSET_LIMIT);
    mutationState.value = failedState(error, { syncStatus: SYNC_STATUS.LOCAL_ONLY });
    appStore.showToast(error.userMessage, { type: 'warning', syncStatus: SYNC_STATUS.LOCAL_ONLY });
    return { ok: false, error };
  };

  const localPersistenceFailure = () => {
    const error = new ServiceError(SERVICE_ERROR_CODE.LOCAL_PERSISTENCE_FAILED);
    mutationState.value = failedState(error, { syncStatus: SYNC_STATUS.LOCAL_ONLY });
    appStore.showToast(error.userMessage, { type: 'error', syncStatus: SYNC_STATUS.LOCAL_ONLY });
    return { ok: false, error };
  };

  const localMutationUnavailable = () => {
    if (dataMode.value === CLOSET_DATA_MODE.REMOTE) {
      appStore.showToast('遠端衣櫥不會以本機方式修改資料。', {
        type: 'warning'
      });
      return {
        ok: false,
        error: new ServiceError(SERVICE_ERROR_CODE.VALIDATION_ERROR, {
          userMessage: '遠端衣櫥不會以本機方式修改資料。'
        })
      };
    }
    return blockedMutation();
  };

  const getRemoteProfileId = () => {
    const ready = [ASYNC_STATUS.SUCCESS, ASYNC_STATUS.EMPTY].includes(remoteState.value.status);
    if (dataMode.value !== CLOSET_DATA_MODE.REMOTE || !ready || !isUuid(activeRemoteProfileId)) {
      return null;
    }
    return activeRemoteProfileId;
  };

  const beginRemoteMutation = () => {
    mutationState.value = syncingState(null);
  };

  const finishRemoteMutation = (data) => {
    mutationState.value = successState(data, { syncStatus: SYNC_STATUS.SYNCED });
  };

  const failRemoteMutation = (error) => {
    const normalized = normalizeServiceError(error, SERVICE_ERROR_CODE.REMOTE_WRITE_FAILED);
    mutationState.value = failedState(normalized, {
      remote: true,
      denied: normalized.code === SERVICE_ERROR_CODE.PERMISSION_DENIED
    });
    appStore.showToast(normalized.userMessage, {
      type: 'error',
      syncStatus: SYNC_STATUS.REMOTE_FAILED
    });
    return { ok: false, error: normalized };
  };

  const getOwnedRemoteItem = (profileId, itemId) => {
    if (!isUuid(itemId)) {
      return { item: null, error: new ServiceError(SERVICE_ERROR_CODE.VALIDATION_ERROR) };
    }
    const item = appStore.items.find((entry) => entry.id === itemId && entry.owner_id === profileId);
    return item
      ? { item, error: null }
      : { item: null, error: new ServiceError(SERVICE_ERROR_CODE.NOT_FOUND) };
  };

  const normalizeFilterValue = (value) => {
    return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
  };

  const matchesFilterValue = (itemValue, selectedValue) => {
    if (!selectedValue) return true;
    const itemKey = normalizeFilterValue(itemValue);
    const selectedKey = normalizeFilterValue(selectedValue);
    if (itemKey === selectedKey) return true;
    return normalizeFilterValue(labels[itemValue]) === selectedKey || normalizeFilterValue(labels[selectedValue]) === itemKey;
  };

  const calculateCostPerWear = (item) => {
    const price = Number(item?.price);
    const wearCount = Number(item?.wear_count || 0);
    if (!Number.isFinite(price) || price <= 0 || wearCount <= 0) return null;
    return Math.round(price / wearCount);
  };

  const getDaysSinceLastWorn = (lastWorn) => {
    if (!lastWorn) return null;
    const wornDate = new Date(lastWorn);
    if (Number.isNaN(wornDate.getTime())) return null;
    return Math.max(0, Math.floor((Date.now() - wornDate.getTime()) / 86400000));
  };

  const isDisusedItem = (item) => {
    if (item.hidden === true || item.hidden === 'true') return false;
    const wearCount = Number(item.wear_count || 0);
    const daysSinceLastWorn = getDaysSinceLastWorn(item.last_worn);
    return (
      (daysSinceLastWorn !== null && daysSinceLastWorn > DISUSED_DAYS_THRESHOLD) ||
      wearCount < DISUSED_WEAR_COUNT_THRESHOLD ||
      (!item.last_worn && wearCount === 0)
    );
  };

  const disusedItems = computed(() => {
    return appStore.items
      .filter(isDisusedItem)
      .sort((a, b) => {
        const aDays = getDaysSinceLastWorn(a.last_worn);
        const bDays = getDaysSinceLastWorn(b.last_worn);
        if (aDays === null && bDays !== null) return -1;
        if (aDays !== null && bDays === null) return 1;
        return (bDays || 0) - (aDays || 0);
      });
  });

  const filteredItems = computed(() => {
    const query = normalizeFilterValue(searchQuery.value);
    const color = colorFilter.value;
    const colorFamily = colorFamilyFilter.value;
    const season = seasonFilter.value;
    const style = styleFilter.value;
    const cat = activeCategory.value;

    return appStore.items.filter((item) => {
      if (item.hidden === true || item.hidden === 'true') return false;
      const searchable = normalizeFilterValue(`${item.name} ${item.name_zh || ''} ${item.brand || ''} ${item.category}`);
      return (
        (!favoritesOnly.value || item.favorite) &&
        (!query || searchable.includes(query)) &&
        (cat === 'All' || matchesFilterValue(item.category, cat) || (cat !== 'Bags' && cat !== 'Accessories' && categoryFamily(item.category) === categoryFamily(cat))) &&
        matchesFilterValue(item.secondary_color, colorFamily) &&
        matchesFilterValue(item.primary_color, color) &&
        matchesFilterValue(item.season, season) &&
        matchesFilterValue(item.style, style)
      );
    });
  });

  const toggleFavorite = (id) => {
    if (dataMode.value === CLOSET_DATA_MODE.REMOTE) {
      const item = appStore.items.find(entry => entry.id === id);
      return item ? updateItem(id, { favorite: !item.favorite }) : blockedMutation(SERVICE_ERROR_CODE.NOT_FOUND);
    }
    if (!canApplyLocalMutation()) return localMutationUnavailable();
    const item = appStore.items.find((entry) => entry.id === id);
    if (item) {
      const nextItems = appStore.items.map((entry) => entry.id === id
        ? { ...entry, favorite: !entry.favorite }
        : entry);
      if (dataMode.value === CLOSET_DATA_MODE.GUEST && !appStore.persistGuestItems(nextItems)) {
        return localPersistenceFailure();
      }
      if (dataMode.value !== CLOSET_DATA_MODE.GUEST) item.favorite = !item.favorite;
      const nextItem = nextItems.find((entry) => entry.id === id);
      appStore.showToast(nextItem.favorite ? '已在此裝置加入收藏' : '已在此裝置取消收藏', {
        type: 'info',
        syncStatus: 'LOCAL_ONLY'
      });
      return { ok: true, data: nextItem };
    }
    return { ok: false, error: new ServiceError(SERVICE_ERROR_CODE.NOT_FOUND) };
  };

  const markItemForClearance = async (id) => {
    if (dataMode.value === CLOSET_DATA_MODE.REMOTE) {
      const item = appStore.items.find(entry => entry.id === id);
      if (!item) return blockedMutation(SERVICE_ERROR_CODE.NOT_FOUND);
      if (String(item.notes || '').includes('[待出清]')) return { ok: true, data: item };
      return updateItem(id, { notes: `${item.notes ? `${item.notes.trim()} ` : ''}[待出清]` });
    }
    if (!canApplyLocalMutation()) return localMutationUnavailable();
    const item = appStore.items.find((entry) => entry.id === id);
    if (!item || String(item.notes || '').includes('[待出清]')) {
      return { ok: false, error: new ServiceError(SERVICE_ERROR_CODE.NOT_FOUND) };
    }
    const nextNotes = `${item.notes ? `${item.notes.trim()} ` : ''}[待出清]`;
    const nextItems = appStore.items.map((entry) => entry.id === id ? { ...entry, notes: nextNotes } : entry);
    if (dataMode.value === CLOSET_DATA_MODE.GUEST && !appStore.persistGuestItems(nextItems)) {
      return localPersistenceFailure();
    }
    if (dataMode.value !== CLOSET_DATA_MODE.GUEST) item.notes = nextNotes;
    appStore.showToast('已在此裝置標記為待出清', {
      type: 'info',
      syncStatus: 'LOCAL_ONLY'
    });
    return { ok: true, data: nextItems.find((entry) => entry.id === id) || item };
  };

  const addItem = async (itemData) => {
    if (dataMode.value === CLOSET_DATA_MODE.REMOTE) {
      const profileId = getRemoteProfileId();
      if (!profileId) return blockedMutation();
      beginRemoteMutation();
      let uploadedMedia = null;
      try {
        const preparedMedia = itemData.__preparedMedia;
        const itemId = preparedMedia
          ? (isUuid(itemData.id) ? itemData.id : crypto.randomUUID())
          : null;
        const payload = { ...itemData };
        delete payload.__preparedMedia;
        delete payload.__mediaOptions;
        if (preparedMedia) {
          itemData.__mediaOptions?.onStage?.('uploading');
          uploadedMedia = await uploadClothingMedia(itemId, preparedMedia, itemData.__mediaOptions);
          Object.assign(payload, uploadedMedia.databaseFields);
        }
        itemData.__mediaOptions?.onStage?.('saving');
        const createdRow = preparedMedia
          ? await createClothingItem(profileId, payload, undefined, itemId)
          : await createClothingItem(profileId, payload);
        const photo = createdRow.photo_display_path
          ? await createPrivateClothingPhotoUrl(createdRow.photo_display_path)
          : createdRow.photo;
        const created = { ...createdRow, photo: photo || createdRow.photo };
        appStore.items.unshift(created);
        finishRemoteMutation(created);
        appStore.showToast('單品已同步到遠端衣櫥', { type: 'success', syncStatus: SYNC_STATUS.SYNCED });
        return { ok: true, data: created };
      } catch (error) {
        if (uploadedMedia) {
          try { await cleanupUploadedClothingMedia(uploadedMedia); } catch { /* orphan audit remains available */ }
        }
        return failRemoteMutation(error);
      }
    }
    if (!canApplyLocalMutation()) return localMutationUnavailable();
    if (dataMode.value === CLOSET_DATA_MODE.GUEST && !canAddItem()) return guestQuotaFailure();
    const primaryColor = itemData.primary_color || '白色';
    const secondaryColor = itemData.secondary_color || getColorFamilyForPrimaryColor(primaryColor) || '無彩色系';
    const colorHex = colorHexValues[primaryColor] || itemData.color_hex || '#D8D2C8';
    const rawPrice = itemData.price !== undefined && itemData.price !== null && itemData.price !== '' ? Number(itemData.price) : null;
    const ownerId = isUuid(appStore.profile?.id) ? appStore.profile.id : null;
    const itemId = isUuid(itemData.id) ? itemData.id : crypto.randomUUID();

    const newItem = {
      ...itemData,
      id: itemId,
      owner_id: ownerId,
      name: itemData.name || itemData.name_zh || '未命名單品',
      name_zh: itemData.name_zh || itemData.name || '未命名單品',
      brand: itemData.brand || '',
      category: itemData.category || 'Tops',
      shape: itemData.shape || '',
      primary_color: primaryColor,
      secondary_color: secondaryColor,
      color_hex: colorHex,
      style: itemData.style || 'Casual',
      season: itemData.season || 'All year',
      price: rawPrice,
      wear_count: Number(itemData.wear_count || 0),
      last_worn: itemData.last_worn || '',
      purchase_date: itemData.purchase_date || null,
      favorite: itemData.favorite || false,
      hidden: false,
      notes: itemData.notes || '',
      created_at: new Date().toISOString(),
      photo: itemData.photo || 'https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?auto=format&fit=crop&w=800&q=85'
    };

    if (dataMode.value === CLOSET_DATA_MODE.GUEST) {
      if (!appStore.persistGuestItems([newItem, ...appStore.items])) return localPersistenceFailure();
    } else {
      appStore.items.unshift(newItem);
    }
    appStore.showToast('單品已保存在此裝置', { type: 'warning', syncStatus: 'LOCAL_ONLY' });
    return { ok: true, data: newItem };
  };

  const updateItem = async (id, itemData) => {
    if (dataMode.value === CLOSET_DATA_MODE.REMOTE) {
      const profileId = getRemoteProfileId();
      if (!profileId) return blockedMutation();
      const { item, error } = getOwnedRemoteItem(profileId, id);
      if (!item) return failRemoteMutation(error);
      beginRemoteMutation();
      let uploadedMedia = null;
      try {
        const preparedMedia = itemData.__preparedMedia;
        const payload = { ...itemData };
        delete payload.__preparedMedia;
        delete payload.__mediaOptions;
        if (preparedMedia) {
          itemData.__mediaOptions?.onStage?.('uploading');
          uploadedMedia = await uploadClothingMedia(id, preparedMedia, itemData.__mediaOptions);
          Object.assign(payload, uploadedMedia.databaseFields);
        }
        itemData.__mediaOptions?.onStage?.('saving');
        const updatedRow = await updateClothingItem(profileId, id, payload);
        const photo = updatedRow.photo_display_path
          ? await createPrivateClothingPhotoUrl(updatedRow.photo_display_path)
          : updatedRow.photo;
        const updated = { ...updatedRow, photo: photo || updatedRow.photo };
        appStore.items = appStore.items.map((entry) => entry.id === id ? updated : entry);
        if (uploadedMedia && item.photo_display_path && item.photo_display_path !== uploadedMedia.displayPath) {
          try { await removeReplacedDerivative(item.photo_display_path); } catch { /* safe orphan audit covers this */ }
        }
        finishRemoteMutation(updated);
        appStore.showToast('衣櫥變更已同步到遠端', { type: 'success', syncStatus: SYNC_STATUS.SYNCED });
        return { ok: true, data: updated };
      } catch (remoteError) {
        if (uploadedMedia) {
          try { await cleanupUploadedClothingMedia(uploadedMedia); } catch { /* orphan audit remains available */ }
        }
        return failRemoteMutation(remoteError);
      }
    }
    if (!canApplyLocalMutation()) return localMutationUnavailable();
    const target = appStore.items.find((item) => item.id === id);
    if (target) {
      const primaryColor = itemData.primary_color || target.primary_color;
      const secondaryColor = itemData.secondary_color || getColorFamilyForPrimaryColor(primaryColor) || target.secondary_color;
      const colorHex = colorHexValues[primaryColor] || itemData.color_hex || target.color_hex;
      const rawPrice = itemData.price === undefined ? target.price : itemData.price !== null && itemData.price !== '' ? Number(itemData.price) : null;

      const changes = {
        ...itemData,
        primary_color: primaryColor,
        secondary_color: secondaryColor,
        color_hex: colorHex,
        price: rawPrice
      };
      if (dataMode.value === CLOSET_DATA_MODE.GUEST) {
        const nextItems = appStore.items.map((item) => item.id === id ? { ...item, ...changes } : item);
        if (!appStore.persistGuestItems(nextItems)) return localPersistenceFailure();
      } else {
        Object.assign(target, changes);
      }

      appStore.showToast('衣櫥變更已保存在此裝置', { type: 'warning', syncStatus: 'LOCAL_ONLY' });
      return { ok: true, data: target };
    }
    return { ok: false, error: new ServiceError(SERVICE_ERROR_CODE.NOT_FOUND) };
  };

  const deleteItem = async (id) => {
    if (dataMode.value === CLOSET_DATA_MODE.REMOTE) {
      const profileId = getRemoteProfileId();
      if (!profileId) return blockedMutation();
      const { item, error } = getOwnedRemoteItem(profileId, id);
      if (!item) return failRemoteMutation(error);
      if (!confirm(`確定要將「${item.name_zh || item.name}」從衣櫥刪除嗎？`)) {
        return { ok: false, cancelled: true, error: null };
      }
      beginRemoteMutation();
      try {
        const mediaUserId = item.photo_display_path ? await getAuthenticatedMediaUserId() : null;
        await deleteClothingItem(profileId, id);
        appStore.items = appStore.items.filter((entry) => entry.id !== id);
        appStore.isDetailOpen = false;
        if (mediaUserId) {
          try { await cleanupDeletedItemMedia(mediaUserId, id); } catch { /* DB deletion wins; audit tool reports leftovers */ }
        }
        finishRemoteMutation({ id });
        appStore.showToast('單品已從遠端衣櫥移除', { type: 'success', syncStatus: SYNC_STATUS.SYNCED });
        return { ok: true, data: { id } };
      } catch (remoteError) {
        return failRemoteMutation(remoteError);
      }
    }
    if (!canApplyLocalMutation()) return localMutationUnavailable();
    const target = appStore.items.find((item) => item.id === id);
    if (!target) return { ok: false, error: new ServiceError(SERVICE_ERROR_CODE.NOT_FOUND) };
    if (confirm(`確定要將「${target.name_zh || target.name}」從衣櫥刪除嗎？`)) {
      const nextItems = appStore.items.filter((item) => item.id !== id);
      if (dataMode.value === CLOSET_DATA_MODE.GUEST) {
        if (!appStore.persistGuestItems(nextItems)) return localPersistenceFailure();
      } else {
        appStore.items = nextItems;
      }
      appStore.isDetailOpen = false;
      appStore.showToast('單品已從此裝置移除', {
        type: 'info',
        syncStatus: 'LOCAL_ONLY'
      });
      return { ok: true, data: { id } };
    }
    return { ok: false, cancelled: true, error: null };
  };

  const loadRemoteItems = async (profileId) => {
    if (!isUuid(profileId)) {
      dataMode.value = CLOSET_DATA_MODE.BLOCKED;
      remoteState.value = failedState(new Error('無效的個人檔案識別碼。'), {
        syncStatus: SYNC_STATUS.REMOTE_FAILED
      });
      return { ok: false, error: remoteState.value.error };
    }

    if (activeRemoteProfileId === profileId) {
      if (activeRemoteRead) return activeRemoteRead;
      if ([ASYNC_STATUS.SUCCESS, ASYNC_STATUS.EMPTY].includes(remoteState.value.status)) {
        return { ok: true, data: remoteState.value.data || [] };
      }
    }

    appStore.beginRemoteItems();
    dataMode.value = CLOSET_DATA_MODE.REMOTE;
    activeRemoteProfileId = profileId;
    const requestVersion = ++remoteReadVersion;

    remoteState.value = loadingState(remoteState.value);
    const request = (async () => {
      try {
        const items = await getCurrentUserItems(profileId,undefined,{defer:true});
        if (requestVersion !== remoteReadVersion || activeRemoteProfileId !== profileId) return { ok: false, stale: true };
        appStore.items = items;
        // Auth hydration can briefly emit PROFILE_LOADING after this request
        // begins. A verified successful owner-scoped response is authoritative.
        dataMode.value = CLOSET_DATA_MODE.REMOTE;
        remoteState.value = successState(items, { syncStatus: SYNC_STATUS.SYNCED });
        return { ok: true, data: items };
      } catch (err) {
        if (requestVersion !== remoteReadVersion || activeRemoteProfileId !== profileId) return { ok: false, stale: true };
        const normalized = normalizeServiceError(err);
        remoteState.value = failedState(normalized, {
          remote: true,
          syncStatus: SYNC_STATUS.REMOTE_FAILED,
          denied: normalized.code === 'PERMISSION_DENIED'
        });
        // Do not silently fallback to mock success.
        appStore.showToast(normalized.userMessage || '遠端衣櫥載入失敗', {
          type: 'error',
          syncStatus: SYNC_STATUS.REMOTE_FAILED
        });
        return { ok: false, error: normalized };
      } finally {
        if (activeRemoteRead === request) activeRemoteRead = null;
      }
    })();
    activeRemoteRead = request;
    return request;
  };

  const clearFilters = () => {
    activeCategory.value = 'All';
    favoritesOnly.value = false;
    searchQuery.value = '';
    colorFamilyFilter.value = '';
    colorFilter.value = '';
    seasonFilter.value = '';
    styleFilter.value = '';
  };

  return {
    activeCategory,
    favoritesOnly,
    searchQuery,
    colorFamilyFilter,
    colorFilter,
    seasonFilter,
    styleFilter,
    filteredItems,
    disusedItems,
    dataMode,
    isGuestMode: computed(() => dataMode.value === CLOSET_DATA_MODE.GUEST),
    remoteState,
    mutationState,
    getDaysSinceLastWorn,
    isDisusedItem,
    calculateCostPerWear,
    markItemForClearance,
    toggleFavorite,
    addItem,
    updateItem,
    deleteItem,
    useLocalItems,
    useGuestItems,
    canAddItem,
    setAwaitingProfile,
    blockRemoteRead,
    loadRemoteItems,
    clearFilters
  };
});

