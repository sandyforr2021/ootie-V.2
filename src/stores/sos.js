import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import { useAppStore } from './app';
import { useAuthStore } from './auth';
import { createSavedOutfit, deleteSavedOutfit } from '@/services/socialMetrics';
import { getPublicItemsByIds } from '@/services/clothingRepository';
import {
  fetchSosPostsFromSupabase,
  insertSosPostToSupabase,
  updateSosStatusInSupabase,
  updateAdoptedSuggestionInSupabase,
  fetchOutfitSuggestionsFromSupabase,
  insertOutfitSuggestionToSupabase
} from '@/services/supabase';

export const useSosStore = defineStore('sos', () => {
  const appStore = useAppStore();

  const activeTab = ref('received'); // 'received' (衣友求救板) | 'sent' (我發出的求救)
  const searchQuery = ref('');

  const sosPosts = ref(appStore.sosPosts || []);
  const outfitSuggestions = ref(appStore.outfitSuggestions || []);
  const publicClosetItems = ref([]);

  // Update appStore on change
  watch(
    sosPosts,
    (val) => {
      appStore.sosPosts = val;
    },
    { deep: true }
  );


  // Sync with Supabase on mount/init
  const initFromSupabase = async () => {
    try {
      const remotePosts = await fetchSosPostsFromSupabase();
      if (remotePosts && remotePosts.length) {
        sosPosts.value = remotePosts.map((p) => ({
          id: p.id,
          sender_id: p.user_id || p.sender_id,
          closet_owner_id: p.closet_owner_id || p.user_id,
          username: p.ootie_profiles?.username || p.username || '@衣友',
          initials: p.ootie_profiles?.initials || p.initials || '衣友',
          avatar_url: p.ootie_profiles?.avatar_url || '',
          title: p.title || '穿搭求救',
          occasion: p.occasion || '未設定',
          weather: p.weather || '未設定',
          when_label: p.when_label || '未設定',
          vibes: Array.isArray(p.vibes) ? p.vibes : [],
          closet_item_ids: Array.isArray(p.closet_item_ids) ? p.closet_item_ids : [],
          details: p.details || '',
          status: p.status === 'CLOSED' ? 'CLOSED' : 'OPEN',
          adopted_suggestion_id: p.picked_suggestion_id || p.adopted_suggestion_id || null,
          liked_suggestion_ids: Array.isArray(p.liked_suggestion_ids) ? p.liked_suggestion_ids : [],
          created_at: p.created_at || new Date().toISOString()
        }));
        const referencedIds = remotePosts.flatMap((post) => Array.isArray(post.closet_item_ids) ? post.closet_item_ids : []);
        publicClosetItems.value = await getPublicItemsByIds(referencedIds);
      }

      const remoteSuggestions = await fetchOutfitSuggestionsFromSupabase();
      if (remoteSuggestions && remoteSuggestions.length) {
        outfitSuggestions.value = remoteSuggestions.map((s) => ({
          id: s.id,
          sos_id: s.sos_id,
          responder_id: s.user_id || s.responder_id,
          username: s.ootie_profiles?.username || '@衣友',
          initials: s.ootie_profiles?.initials || '衣友',
          item_ids: Array.isArray(s.item_ids) ? s.item_ids : [],
          message: s.message || '',
          hearts: s.hearts || 0,
          created_at: s.created_at || new Date().toISOString()
        }));
      }
    } catch (e) {
      console.warn('Supabase SOS sync skipped or failed:', e);
    }
  };

  // Run initial sync asynchronously
  initFromSupabase();

  // Tab filtering & Search filtering
  const receivedSosPosts = computed(() => {
    // Other people's OPEN posts
    return sosPosts.value.filter((p) => p.sender_id !== appStore.profile.id && p.status === 'OPEN');
  });

  const sentSosPosts = computed(() => {
    // Current user's own sent SOS posts (both OPEN and CLOSED)
    return sosPosts.value.filter((p) => p.sender_id === appStore.profile.id);
  });

  const filteredSosPosts = computed(() => {
    const targetList = activeTab.value === 'received' ? receivedSosPosts.value : sentSosPosts.value;
    const query = searchQuery.value.toLowerCase().trim();
    if (!query) return targetList;
    return targetList.filter((post) => {
      const searchable = `${post.username} ${post.title} ${post.occasion} ${post.weather} ${post.vibes.join(' ')} ${post.details}`.toLowerCase();
      return searchable.includes(query);
    });
  });

  // Helpers
  const getSuggestionsForSos = (sosId) => {
    return outfitSuggestions.value.filter((s) => s.sos_id === sosId);
  };

  const getHelperCountForSos = (sosId) => {
    const sugs = getSuggestionsForSos(sosId);
    const responders = new Set(sugs.map((s) => s.responder_id || s.user_id));
    return responders.size;
  };

  const getPublicItemsForSos = (postOrIds) => {
    const ids = Array.isArray(postOrIds) ? postOrIds : postOrIds?.closet_item_ids;
    if (!Array.isArray(ids)) return [];
    const idSet = new Set(ids.map(String));
    const merged = [...publicClosetItems.value, ...appStore.items];
    return [...new Map(merged.filter((item) => idSet.has(String(item.id))).map((item) => [String(item.id), item])).values()];
  };

  const toggleSave = async (sosId) => {
    const targetSos = sosPosts.value.find((post) => String(post.id) === String(sosId));
    if (!targetSos) return false;
    const authStore = useAuthStore();
    if (authStore.isMember && authStore.profileId) {
      try {
        if (targetSos.saved) {
          await deleteSavedOutfit(authStore.profileId, { target_type: 'SOS', target_id: sosId });
        } else {
          await createSavedOutfit(authStore.profileId, { target_type: 'SOS', target_id: sosId });
        }
        targetSos.saved = !targetSos.saved;
        appStore.showToast(targetSos.saved ? '已收藏這筆衣友求救' : '已取消收藏', {
          type: 'success', syncStatus: 'SYNCED'
        });
        return true;
      } catch (error) {
        appStore.showToast(error?.userMessage || '收藏尚未同步到伺服器。', {
          type: 'error', syncStatus: 'REMOTE_FAILED'
        });
        return false;
      }
    }

    targetSos.saved = !targetSos.saved;
    appStore.showToast(targetSos.saved ? '已在此裝置收藏這筆衣友求救' : '已取消此裝置收藏', {
      type: 'info', syncStatus: 'LOCAL_ONLY'
    });
    return true;
  };

  // Actions
  const createSosPost = async ({ title, occasion, weather, when_label, vibes, details, closet_item_ids }) => {
    const requestedItemIds = Array.isArray(closet_item_ids)
      ? closet_item_ids
      : appStore.items.map((item) => item.id);
    const ownedItemIds = new Set(
      appStore.items
        .filter((item) => String(item.owner_id) === String(appStore.profile.id))
        .map((item) => String(item.id))
    );
    const finalItemIds = [...new Set(requestedItemIds.map((id) => String(id)))]
      .filter((id) => ownedItemIds.has(id));
    if (!finalItemIds.length) {
      appStore.showToast('請至少選擇 1 件要公開給衣友的衣物。');
      return false;
    }

    const newPost = {
      id: `sos-${Date.now()}`,
      sender_id: appStore.profile.id,
      closet_owner_id: appStore.profile.id,
      username: appStore.profile.username,
      initials: appStore.profile.initials,
      title: (title || '').trim(),
      occasion,
      weather,
      when_label,
      vibes: vibes || [],
      closet_item_ids: finalItemIds,
      details: (details || '').trim(),
      status: 'OPEN',
      adopted_suggestion_id: null,
      liked_suggestion_ids: [],
      created_at: new Date().toISOString()
    };

    sosPosts.value.unshift(newPost);
    const remotePost = await insertSosPostToSupabase(newPost);
    const synced = Boolean(remotePost);
    appStore.showToast(
      synced ? '穿搭求救已發布並同步' : '求救已保存在此裝置，但遠端發布失敗',
      { type: synced ? 'success' : 'warning', syncStatus: synced ? 'SYNCED' : 'REMOTE_FAILED' }
    );
    return true;
  };

  const submitSuggestion = async ({ sosId, selectedIds, message }) => {
    const targetSos = sosPosts.value.find((p) => p.id === sosId);
    if (!targetSos) return false;

    // Self-suggestion guard
    if (targetSos.sender_id === appStore.profile.id) {
      appStore.showToast('你不能為自己的求救貼文提交搭配建議。');
      return false;
    }

    if (targetSos.status !== 'OPEN') {
      appStore.showToast('這筆求救已結束，無法提交搭配建議。');
      return false;
    }

    const sharedIds = Array.isArray(targetSos.closet_item_ids)
      ? targetSos.closet_item_ids.map((id) => String(id))
      : [];
    const sharedIdSet = new Set(sharedIds);
    const availableIdSet = new Set(getPublicItemsForSos(sharedIds).map((item) => String(item.id)));
    const validSelectedIds = [...new Set((Array.isArray(selectedIds) ? selectedIds : []).map((id) => String(id)))]
      .filter((id) => sharedIdSet.has(id) && availableIdSet.has(id));
    if (!validSelectedIds.length || validSelectedIds.length !== (Array.isArray(selectedIds) ? selectedIds.length : 0)) {
      appStore.showToast('只能使用這筆求救公開的衣物。');
      return false;
    }

    // Single active suggestion per responder rule
    const existingIdx = outfitSuggestions.value.findIndex(
      (s) => s.sos_id === sosId && (s.responder_id === appStore.profile.id || s.user_id === appStore.profile.id)
    );
    const newSug = {
      id: existingIdx >= 0 ? outfitSuggestions.value[existingIdx].id : `suggestion-${Date.now()}`,
      sos_id: sosId,
      responder_id: appStore.profile.id,
      user_id: appStore.profile.id,
      item_ids: validSelectedIds,
      message: (message || '').trim(),
      hearts: 0,
      created_at: new Date().toISOString()
    };


    if (existingIdx >= 0) {
      outfitSuggestions.value[existingIdx] = newSug;
    } else {
      outfitSuggestions.value.unshift(newSug);
    }

    appStore.profile.helped += 1;
    const remoteSuggestion = await insertOutfitSuggestionToSupabase(newSug);
    const synced = Boolean(remoteSuggestion);
    if (synced) appStore.addNotification('你的 SOS 穿搭建議已送出。', 'sos');
    appStore.showToast(
      synced ? '穿搭建議已送出並同步' : '建議已保存在此裝置，但遠端送出失敗',
      { type: synced ? 'success' : 'warning', syncStatus: synced ? 'SYNCED' : 'REMOTE_FAILED' }
    );
    return true;
  };

  const adoptSuggestion = async ({ sosId, suggestionId }) => {
    const targetSos = sosPosts.value.find((p) => p.id === sosId);
    if (!targetSos) return;

    // Adopt sets adopted_suggestion_id, but keeps SOS status as OPEN!
    targetSos.adopted_suggestion_id = targetSos.adopted_suggestion_id === suggestionId ? null : suggestionId;
    const synced = await updateAdoptedSuggestionInSupabase(sosId, targetSos.adopted_suggestion_id);
    appStore.showToast(
      synced
        ? (targetSos.adopted_suggestion_id ? '採納狀態已同步' : '取消採納已同步')
        : '採納狀態已保存在此裝置，但遠端同步失敗',
      { type: synced ? 'success' : 'warning', syncStatus: synced ? 'SYNCED' : 'REMOTE_FAILED' }
    );
  };

  const toggleLikeSuggestion = async ({ sosId, suggestionId }) => {
    const targetSos = sosPosts.value.find((p) => p.id === sosId);
    if (!targetSos) return;

    if (!Array.isArray(targetSos.liked_suggestion_ids)) {
      targetSos.liked_suggestion_ids = [];
    }

    const idx = targetSos.liked_suggestion_ids.indexOf(suggestionId);
    if (idx >= 0) {
      targetSos.liked_suggestion_ids.splice(idx, 1);
    } else {
      targetSos.liked_suggestion_ids.push(suggestionId);
    }
  };

  const closeSosPost = async (sosId) => {
    const targetSos = sosPosts.value.find((p) => p.id === sosId);
    if (!targetSos) return;

    targetSos.status = 'CLOSED';
    const synced = await updateSosStatusInSupabase(sosId, 'CLOSED');
    appStore.showToast(
      synced ? '該筆穿搭求救已結束並同步' : '求救已在此裝置結束，但遠端同步失敗',
      { type: synced ? 'success' : 'warning', syncStatus: synced ? 'SYNCED' : 'REMOTE_FAILED' }
    );
  };

  return {
    activeTab,
    searchQuery,
    sosPosts,
    outfitSuggestions,
    publicClosetItems,
    receivedSosPosts,
    sentSosPosts,
    filteredSosPosts,
    getSuggestionsForSos,
    getHelperCountForSos,
    getPublicItemsForSos,
    toggleSave,
    createSosPost,
    submitSuggestion,
    adoptSuggestion,
    toggleLikeSuggestion,
    closeSosPost
  };
});
