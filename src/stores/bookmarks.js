import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import { BOOKMARKS_STORAGE_KEY, defaultBookmarks } from '@/constants';
import {
  fetchBookmarksFromSupabase,
  insertBookmarkToSupabase,
  updateBookmarkInSupabase,
  deleteBookmarkFromSupabase,
  deleteBatchBookmarksFromSupabase,
  uploadBookmarkImageToStorage
} from '@/services/supabase';

export const useBookmarksStore = defineStore('bookmarks', () => {
  const isUuid = (value) =>
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

  const loadInitialBookmarks = () => {
    try {
      const raw = localStorage.getItem(BOOKMARKS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      const appState = localStorage.getItem('weary-app-state-v1');
      if (appState) {
        const parsed = JSON.parse(appState);
        if (parsed && Array.isArray(parsed.bookmarks) && parsed.bookmarks.length > 0) {
          return parsed.bookmarks;
        }
      }
    } catch (e) {
      console.warn('Failed to load bookmarks from storage:', e);
    }
    return JSON.parse(JSON.stringify(defaultBookmarks));
  };

  const bookmarks = ref(loadInitialBookmarks());
  const isManagerMode = ref(false);
  const selectedBookmarkIds = ref([]);
  const isFormModalOpen = ref(false);
  const formMode = ref('create'); // 'create' | 'edit'
  const editingBookmarkId = ref(null);
  const isDetailModalOpen = ref(false);
  const activeDetailBookmarkId = ref(null);
  const isExtensionGuideOpen = ref(false);
  const lastMutationSyncStatus = ref(null);

  // Computed
  const activeDetailBookmark = computed(() => {
    return bookmarks.value.find((b) => b.id === activeDetailBookmarkId.value) || null;
  });

  const sortedBookmarks = computed(() => {
    return [...bookmarks.value].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  });

  // Watcher to save to LocalStorage
  const saveToLocalStorage = () => {
    try {
      localStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(bookmarks.value));
    } catch (e) {
      console.warn('Failed to save bookmarks to localStorage:', e);
    }
  };

  watch(bookmarks, () => saveToLocalStorage(), { deep: true });

  // Helpers
  const isValidHttpUrl = (value) => {
    if (!value || typeof value !== 'string') return false;
    try {
      const parsed = new URL(value.trim());
      return ['http:', 'https:'].includes(parsed.protocol);
    } catch (error) {
      return false;
    }
  };

  const getSourceDomain = (url) => {
    if (!url || typeof url !== 'string') return '';
    try {
      let testUrl = url.trim();
      if (!/^https?:\/\//i.test(testUrl)) testUrl = 'https://' + testUrl;
      return new URL(testUrl).hostname.replace(/^www\./i, '');
    } catch (error) {
      return '';
    }
  };

  const formatPrice = (price, currency = 'TWD') => {
    if (!price || !String(price).trim()) return '價格未提供';
    const rawNum = String(price).replace(/[^0-9.]/g, '');
    if (!rawNum) return String(price).trim();
    const formattedNum = Number(rawNum).toLocaleString();
    const cur = (currency || 'TWD').toUpperCase();
    if (cur === 'TWD') return `NT$ ${formattedNum}`;
    if (cur === 'USD') return `$ ${formattedNum}`;
    if (cur === 'EUR') return `€ ${formattedNum}`;
    if (cur === 'JPY') return `¥ ${formattedNum}`;
    return `${cur} ${formattedNum}`;
  };

  const findDuplicateBookmark = (url, variant, color, size, excludeId = null) => {
    const normUrl = (url || '').trim().toLowerCase();
    const normVariant = (variant || '').trim().toLowerCase();
    const normColor = (color || '').trim().toLowerCase();
    const normSize = (size || '').trim().toLowerCase();

    if (!normUrl) return null;

    return bookmarks.value.find((item) => {
      if (excludeId && item.id === excludeId) return false;
      const itemUrl = (item.product_url || '').trim().toLowerCase();
      const itemVariant = (item.variant_name || '').trim().toLowerCase();
      const itemColor = (item.color || '').trim().toLowerCase();
      const itemSize = (item.size || '').trim().toLowerCase();
      return itemUrl === normUrl && itemVariant === normVariant && itemColor === normColor && itemSize === normSize;
    });
  };

  // Actions
  const fetchRemoteBookmarks = async (userId) => {
    const remoteData = await fetchBookmarksFromSupabase(userId);
    if (remoteData && Array.isArray(remoteData) && remoteData.length > 0) {
      bookmarks.value = remoteData.map((item) => ({
        ...item,
        price: item.price || '',
        brand: item.brand || '',
        color: item.color || '',
        variant_name: item.variant_name || '',
        size: item.size || '',
        notes: item.notes || '',
        image_url: item.image_url || '',
        image_storage_path: item.image_storage_path || ''
      }));
      saveToLocalStorage();
    }
  };

  const toggleSelectBookmark = (id) => {
    if (selectedBookmarkIds.value.includes(id)) {
      selectedBookmarkIds.value = selectedBookmarkIds.value.filter((item) => item !== id);
    } else {
      selectedBookmarkIds.value.push(id);
    }
  };

  const toggleManagerMode = () => {
    isManagerMode.value = !isManagerMode.value;
    if (!isManagerMode.value) {
      selectedBookmarkIds.value = [];
    }
  };

  const openDetailModal = (id) => {
    activeDetailBookmarkId.value = id;
    isDetailModalOpen.value = true;
  };

  const closeDetailModal = () => {
    isDetailModalOpen.value = false;
    activeDetailBookmarkId.value = null;
  };

  const openCreateForm = (prefillData = null) => {
    formMode.value = 'create';
    editingBookmarkId.value = null;
    isFormModalOpen.value = true;
    return prefillData;
  };

  const openEditForm = (id) => {
    const target = bookmarks.value.find((b) => b.id === id);
    if (!target) return null;
    formMode.value = 'edit';
    editingBookmarkId.value = id;
    isDetailModalOpen.value = false;
    isFormModalOpen.value = true;
    return target;
  };

  const closeFormModal = () => {
    isFormModalOpen.value = false;
    editingBookmarkId.value = null;
    formMode.value = 'create';
  };

  const addBookmark = async (bookmarkPayload, fileUpload = null) => {
    let imageUrl = bookmarkPayload.image_url || '';
    let imageStoragePath = '';

    let remoteFailed = false;
    if (fileUpload) {
      const uploadRes = await uploadBookmarkImageToStorage(fileUpload, bookmarkPayload.owner_id);
      if (uploadRes?.publicUrl) {
        imageUrl = uploadRes.publicUrl;
        imageStoragePath = uploadRes.storagePath;
      } else {
        remoteFailed = true;
      }
    }

    const domain = bookmarkPayload.product_url ? getSourceDomain(bookmarkPayload.product_url) : '';
    const defaultBrand = domain ? domain.split('.')[0].replace(/\b\w/g, (c) => c.toUpperCase()) : '';

    const newBookmark = {
      id: `bookmark-${Date.now()}`,
      owner_id: bookmarkPayload.owner_id || null,
      product_url: bookmarkPayload.product_url || '',
      title: bookmarkPayload.title,
      image_url: imageUrl,
      image_storage_path: imageStoragePath,
      brand: bookmarkPayload.brand || defaultBrand,
      price: String(bookmarkPayload.price || '').replace(/[^0-9.]/g, ''),
      currency: bookmarkPayload.currency || 'TWD',
      variant_name: bookmarkPayload.variant_name || '',
      color: bookmarkPayload.color || '',
      size: bookmarkPayload.size || '',
      source_domain: domain,
      notes: bookmarkPayload.notes || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    bookmarks.value.unshift(newBookmark);
    saveToLocalStorage();

    if (!isUuid(newBookmark.owner_id)) {
      lastMutationSyncStatus.value = 'LOCAL_ONLY';
      return newBookmark;
    }

    // Async sync to Supabase
    const created = await insertBookmarkToSupabase(newBookmark, newBookmark.owner_id);
    if (created && created.id) {
      newBookmark.id = created.id;
      saveToLocalStorage();
    } else {
      remoteFailed = true;
    }
    lastMutationSyncStatus.value = remoteFailed ? 'REMOTE_FAILED' : 'SYNCED';

    return newBookmark;
  };

  const updateBookmark = async (id, bookmarkPayload, fileUpload = null) => {
    const index = bookmarks.value.findIndex((b) => b.id === id);
    if (index === -1) return null;

    let imageUrl = bookmarkPayload.image_url || bookmarks.value[index].image_url || '';
    let imageStoragePath = bookmarks.value[index].image_storage_path || '';

    let remoteFailed = false;
    if (fileUpload) {
      const uploadRes = await uploadBookmarkImageToStorage(fileUpload, bookmarkPayload.owner_id || bookmarks.value[index].owner_id);
      if (uploadRes?.publicUrl) {
        imageUrl = uploadRes.publicUrl;
        imageStoragePath = uploadRes.storagePath;
      } else {
        remoteFailed = true;
      }
    }

    const domain = bookmarkPayload.product_url ? getSourceDomain(bookmarkPayload.product_url) : (bookmarks.value[index].source_domain || '');
    const defaultBrand = domain ? domain.split('.')[0].replace(/\b\w/g, (c) => c.toUpperCase()) : '';

    const updated = {
      ...bookmarks.value[index],
      product_url: bookmarkPayload.product_url || '',
      title: bookmarkPayload.title,
      image_url: imageUrl,
      image_storage_path: imageStoragePath,
      brand: bookmarkPayload.brand || defaultBrand || bookmarks.value[index].brand,
      price: String(bookmarkPayload.price || '').replace(/[^0-9.]/g, ''),
      currency: bookmarkPayload.currency || 'TWD',
      variant_name: bookmarkPayload.variant_name || '',
      color: bookmarkPayload.color || '',
      size: bookmarkPayload.size || '',
      source_domain: domain,
      notes: bookmarkPayload.notes || '',
      updated_at: new Date().toISOString()
    };

    bookmarks.value[index] = updated;
    saveToLocalStorage();

    if (!isUuid(updated.owner_id) || !isUuid(id)) {
      lastMutationSyncStatus.value = 'LOCAL_ONLY';
      return updated;
    }

    // Async sync to Supabase
    const remoteUpdated = await updateBookmarkInSupabase(id, updated);
    if (!remoteUpdated) remoteFailed = true;
    lastMutationSyncStatus.value = remoteFailed ? 'REMOTE_FAILED' : 'SYNCED';

    return updated;
  };

  const deleteBookmark = async (id) => {
    bookmarks.value = bookmarks.value.filter((b) => b.id !== id);
    selectedBookmarkIds.value = selectedBookmarkIds.value.filter((item) => item !== id);
    if (activeDetailBookmarkId.value === id) {
      closeDetailModal();
    }
    saveToLocalStorage();

    if (!isUuid(id)) {
      lastMutationSyncStatus.value = 'LOCAL_ONLY';
      return;
    }

    const synced = await deleteBookmarkFromSupabase(id);
    lastMutationSyncStatus.value = synced ? 'SYNCED' : 'REMOTE_FAILED';
  };

  const deleteSelectedBookmarks = async () => {
    if (!selectedBookmarkIds.value.length) return 0;
    const idsToDelete = [...selectedBookmarkIds.value];
    bookmarks.value = bookmarks.value.filter((b) => !idsToDelete.includes(b.id));
    selectedBookmarkIds.value = [];
    isManagerMode.value = false;
    saveToLocalStorage();

    if (!idsToDelete.every((id) => isUuid(id))) {
      lastMutationSyncStatus.value = 'LOCAL_ONLY';
      return idsToDelete.length;
    }

    const synced = await deleteBatchBookmarksFromSupabase(idsToDelete);
    lastMutationSyncStatus.value = synced ? 'SYNCED' : 'REMOTE_FAILED';
    return idsToDelete.length;
  };

  return {
    bookmarks,
    sortedBookmarks,
    isManagerMode,
    selectedBookmarkIds,
    isFormModalOpen,
    formMode,
    editingBookmarkId,
    isDetailModalOpen,
    activeDetailBookmarkId,
    activeDetailBookmark,
    isExtensionGuideOpen,
    lastMutationSyncStatus,
    // Methods
    isValidHttpUrl,
    getSourceDomain,
    formatPrice,
    findDuplicateBookmark,
    fetchRemoteBookmarks,
    toggleSelectBookmark,
    toggleManagerMode,
    openDetailModal,
    closeDetailModal,
    openCreateForm,
    openEditForm,
    closeFormModal,
    addBookmark,
    updateBookmark,
    deleteBookmark,
    deleteSelectedBookmarks
  };
});
