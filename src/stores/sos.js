import { t } from '@/i18n';
import { genuineContent } from '@/services/contentAuthenticity';
import { isStyleCrew } from '@/services/styleCrew';
import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import { useAppStore } from './app';
import { useAuthStore } from './auth';
import { createSavedOutfit, deleteSavedOutfit } from '@/services/socialMetrics';
import { getPublicItemsByIds } from '@/services/clothingRepository';
import { removeOotdImage } from '@/services/ootdMedia';
import {
  fetchSosPostsFromSupabase,
  insertSosPostToSupabase,
  deleteSosPostFromSupabase,
  updateSosStatusInSupabase,
  updateAdoptedSuggestionInSupabase,
  fetchOutfitSuggestionsFromSupabase,
  insertOutfitSuggestionToSupabase,
  updateLikedSuggestionsInSupabase,
  fetchSavedSosIds
} from '@/services/supabase';

const isUuid = (str) =>
  typeof str === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

export const useSosStore = defineStore('sos', () => {
  const appStore = useAppStore();
  const authStore = useAuthStore();
  const pending = ref(new Set());
  let loadVersion = 0;
  const requireMember = () => {
    if (authStore.isMember && authStore.profileId) return authStore.profileId;
    appStore.openLoginGate('AUTH_REQUIRED', '/sos');
    return null;
  };
  const persist = async (key, write, apply, message) => {
    const profileId = requireMember();
    if (!profileId || pending.value.has(key)) return false;
    pending.value.add(key);
    try {
      const result = await write();
      if (!result) throw new Error('REMOTE_WRITE_FAILED');
      if (profileId !== authStore.profileId) return false;
      apply(result);
      appStore.showToast(t(message), { type: 'success', syncStatus: 'SYNCED' });
      return true;
    } catch {
      appStore.showToast(t('尚未儲存成功，請稍後再試。'), { type: 'error', syncStatus: 'REMOTE_FAILED' });
      return false;
    } finally { pending.value.delete(key); }
  };

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


  watch(outfitSuggestions, val => { appStore.outfitSuggestions = val; }, { deep: true });

  // A new account must never inherit the previous account's saved state.
  const initFromSupabase = async () => {
    const version = ++loadVersion;
    publicClosetItems.value = [];
    const profileId = authStore.isMember ? authStore.profileId : null;
    try {
      const remotePosts = genuineContent(await fetchSosPostsFromSupabase());
      if (version !== loadVersion) return;
      const savedIds = await fetchSavedSosIds(profileId);
      if (version !== loadVersion) return;
      if (Array.isArray(remotePosts)) {
        sosPosts.value = remotePosts.map((p) => ({
          id: p.id,
          saved: savedIds.has(p.id),
          sender_id: p.user_id || p.sender_id,
          user_id: p.user_id || p.sender_id,
          closet_owner_id: p.closet_owner_id || p.user_id,
          username: p.ootie_profiles?.username || p.username || '@衣友',
          display_name: p.ootie_profiles?.display_name || p.ootie_profiles?.username || '',
          curated: isStyleCrew(p.ootie_profiles),
          initials: p.ootie_profiles?.initials || p.initials || '衣友',
          avatar_url: p.ootie_profiles?.avatar_url || '',
          title: p.title || '穿搭求救',
          occasion: p.occasion || '未設定',
          weather: p.weather || '未設定',
          when_label: p.when_label || '未設定',
          vibes: Array.isArray(p.vibes) ? p.vibes : [],
          closet_item_ids: Array.isArray(p.closet_item_ids) ? p.closet_item_ids : [],
          cover_url: p.cover_url || p.cover_image || p.image || '',
          cover_path: p.cover_path || '',
          image: p.cover_url || p.cover_image || p.image || p.cover_path || '',
          cover_item_id: p.cover_item_id || '',
          details: p.details || '',
          status: p.status === 'CLOSED' ? 'CLOSED' : 'OPEN',
          adopted_suggestion_id: p.picked_suggestion_id || p.adopted_suggestion_id || null,
          liked_suggestion_ids: Array.isArray(p.liked_suggestion_ids) ? p.liked_suggestion_ids : [],
          created_at: p.created_at || new Date().toISOString()
        }));
        const referencedIds = remotePosts.flatMap((post) => Array.isArray(post.closet_item_ids) ? post.closet_item_ids : []);
        const items = await getPublicItemsByIds(referencedIds,undefined,{defer:true});
        if (version !== loadVersion) return;
        publicClosetItems.value = items;
      }

      const remoteSuggestions = genuineContent(await fetchOutfitSuggestionsFromSupabase());
      if (version !== loadVersion) return;
      if (Array.isArray(remoteSuggestions)) {
        outfitSuggestions.value = remoteSuggestions.map((s) => ({
          id: s.id,
          sos_id: s.sos_id,
          responder_id: s.user_id || s.responder_id,
          username: s.ootie_profiles?.username || '@衣友',
          display_name: s.ootie_profiles?.display_name || s.ootie_profiles?.username || '',
          avatar_url: s.ootie_profiles?.avatar_url || '',
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

  watch(() => authStore.profileId, () => {
    sosPosts.value.forEach(post => { post.saved = false; });
    void initFromSupabase();
  }, { immediate: true });

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
    const post = sosPosts.value.find(entry => entry.id === sosId);
    const profileId = requireMember();
    if (!post || !profileId) return false;
    const saved = !post.saved;
    return persist(`save:${sosId}`,
      () => saved ? createSavedOutfit(profileId, {target_type:'SOS',target_id:sosId}) : deleteSavedOutfit(profileId, {target_type:'SOS',target_id:sosId}),
      () => { post.saved = saved; }, saved ? '已收藏這筆衣友求救' : '已取消收藏');
  };

  // Actions
  const createSosPost = async ({ title, occasion, weather, when_label, vibes, details, closet_item_ids, cover_url, cover_path, cover_item_id }) => {
    const profileId = requireMember();
    if (!profileId) return false;
    const requestedItemIds = Array.isArray(closet_item_ids)
      ? closet_item_ids
      : appStore.items.map((item) => item.id);
    const ownedItemIds = appStore.items.length > 0
      ? new Set(
          appStore.items
            .filter((item) => String(item.owner_id) === String(profileId))
            .map((item) => String(item.id))
        )
      : null;
    const finalItemIds = [...new Set(requestedItemIds.map((id) => String(id)))]
      .filter((id) => (ownedItemIds ? ownedItemIds.has(id) : isUuid(id)));
    if (!finalItemIds.length) {
      appStore.showToast(t('請至少選擇 1 件要公開給衣友的衣物。'));
      return false;
    }

    const newPost = {
      id: crypto.randomUUID(),
      sender_id: profileId,
      closet_owner_id: profileId,
      username: appStore.profile.username,
      initials: appStore.profile.initials,
      title: (title || '').trim(),
      occasion,
      weather,
      when_label,
      vibes: vibes || [],
      closet_item_ids: finalItemIds,
      cover_url: cover_url || null, cover_path: cover_path || null,
      cover_item_id: finalItemIds.includes(String(cover_item_id || '')) ? cover_item_id : null,
      details: (details || '').trim(),
      status: 'OPEN',
      adopted_suggestion_id: null,
      liked_suggestion_ids: [],
      created_at: new Date().toISOString()
    };

    return persist('create', () => insertSosPostToSupabase(newPost), row => {
      sosPosts.value.unshift({...newPost, ...row, sender_id: row.user_id || newPost.sender_id});
    }, '穿搭求救已發布並同步');
  };

  const submitSuggestion = async ({ sosId, selectedIds, message }) => {
    const profileId = requireMember();
    if (!profileId) return false;
    const targetSos = sosPosts.value.find((p) => p.id === sosId);
    if (!targetSos) return false;

    // Self-suggestion guard
    if (targetSos.sender_id === profileId) {
      appStore.showToast(t('你不能為自己的求救貼文提交搭配建議。'));
      return false;
    }

    if (targetSos.status !== 'OPEN') {
      appStore.showToast(t('這筆求救已結束，無法提交搭配建議。'));
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
      appStore.showToast(t('只能使用這筆求救公開的衣物。'));
      return false;
    }

    // Single active suggestion per responder rule
    const existingIdx = outfitSuggestions.value.findIndex(
      (s) => s.sos_id === sosId && (s.responder_id === profileId || s.user_id === profileId)
    );
    const newSug = {
      id: existingIdx >= 0 ? outfitSuggestions.value[existingIdx].id : crypto.randomUUID(),
      sos_id: sosId,
      responder_id: profileId,
      user_id: profileId,
      item_ids: validSelectedIds,
      message: (message || '').trim(),
      hearts: 0,
      created_at: new Date().toISOString()
    };


    return persist(`suggest:${sosId}`, () => insertOutfitSuggestionToSupabase(newSug, {update: existingIdx >= 0}), row => {
      const confirmed = {...newSug,...row,responder_id:row.user_id || newSug.responder_id,
        username:appStore.profile.username,initials:appStore.profile.initials};
      if (existingIdx >= 0) outfitSuggestions.value[existingIdx] = confirmed;
      else outfitSuggestions.value.unshift(confirmed);
    }, '穿搭建議已送出並同步');
  };

  const ownedPost = id => sosPosts.value.find(post => post.id === id && post.sender_id === authStore.profileId);
  const adoptSuggestion = async ({ sosId, suggestionId }) => {
    const post = ownedPost(sosId);
    if (!post || !getSuggestionsForSos(sosId).some(entry => entry.id === suggestionId)) return false;
    const nextId = post.adopted_suggestion_id === suggestionId ? null : suggestionId;
    return persist(`post:${sosId}`, () => updateAdoptedSuggestionInSupabase(sosId,nextId),
      () => { post.adopted_suggestion_id = nextId; }, '採納狀態已同步');
  };
  const toggleLikeSuggestion = async ({ sosId, suggestionId }) => {
    const post = ownedPost(sosId);
    if (!post || !getSuggestionsForSos(sosId).some(entry => entry.id === suggestionId)) return false;
    const ids = post.liked_suggestion_ids || [];
    const next = ids.includes(suggestionId) ? ids.filter(id => id !== suggestionId) : [...ids,suggestionId];
    return persist(`post:${sosId}`, () => updateLikedSuggestionsInSupabase(sosId,next),
      () => { post.liked_suggestion_ids = next; }, '喜歡的搭配已同步');
  };
  const closeSosPost = async sosId => {
    const post = ownedPost(sosId);
    if (!post) return false;
    return persist(`post:${sosId}`, () => updateSosStatusInSupabase(sosId,'CLOSED'),
      () => { post.status = 'CLOSED'; }, '該筆穿搭求救已結束並同步');
  };

  const deleteSosPost = async sosId => {
    const post=ownedPost(sosId); if (!post) return false;
    const authUserId=authStore.user?.id;
    const ok=await persist(`post:${sosId}`, () => deleteSosPostFromSupabase(sosId,authStore.profileId), () => {
      sosPosts.value=sosPosts.value.filter(item=>item.id!==sosId);
      outfitSuggestions.value=outfitSuggestions.value.filter(item=>item.sos_id!==sosId);
    }, '求救貼文已刪除。');
    if (ok && post.cover_path && authUserId) {
      try { await removeOotdImage(post.cover_path,authUserId); }
      catch { appStore.showToast(t('貼文已刪除，但主圖清理尚未完成。'),{type:'warning'}); }
    }
    return ok;
  };

  return {
    pending,
    deleteSosPost,
    initFromSupabase,
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