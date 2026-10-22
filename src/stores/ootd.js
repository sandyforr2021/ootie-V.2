import { genuineContent } from '@/services/contentAuthenticity';
import { listPostComments, insertPostComment } from '@/services/postComments';
import { t } from '@/i18n';
import { editorialLook } from '@/services/editorial';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { useAppStore } from './app';
import { useAuthStore } from './auth';
import { useSocialStore } from './social';
import {
  createPostLike,
  deletePostLike,
  createSavedOutfit,
  deleteSavedOutfit,
  loadPostInteractionState
} from '@/services/socialMetrics';
import {
  fetchProfileOotdPosts,
  insertOotdPost,
  updateOotdPost,
  deleteOotdPost
} from '@/services/supabase';
import { getCurrentUserItems, getPublicItemsByIds } from '@/services/clothingRepository';
import { removeOotdImage, uploadOotdImage } from '@/services/ootdMedia';
import { withDevelopmentDemoMediaRevision } from '@/services/mediaUrl';

export const uniquePostsById = (posts = []) => {
  const seen = new Set();
  return posts.filter((post) => {
    const id = String(post?.id || '').trim();
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
};

export const useOotdStore = defineStore('ootd', () => {
  const appStore = useAppStore();
  const activeFeedTab = ref('for-you');
  const searchQuery = ref('');
  const editingPostId = ref(null);
  const publishing = ref(false);
  const loading = ref(false);
  const loadError = ref('');
  const shareSheetPostId = ref(null);
  const commentsLoading = ref(false);
  const commentsError = ref('');
  let loadSequence = 0;
  const interactionPending = new Set();

  const getWearingName = (entry) => typeof entry === 'string' ? entry : entry?.name || '';

  const formatPost = (remote, taggedItems = []) => ({
    id: String(remote.id),
    editorial: Boolean(editorialLook(remote)),
    curated: (remote.hashtags || []).includes('#OOTIEStyleCrew'),
    saves: remote.saves ?? null,
    user_id: remote.user_id,
    username: remote.ootie_profiles?.username || appStore.profile.username || '@衣友',
    initials: remote.ootie_profiles?.initials || appStore.profile.initials || '衣友',
    avatar_url: remote.ootie_profiles?.avatar_url || '',
    image: withDevelopmentDemoMediaRevision(remote.image),
    image_storage_path: remote.image_storage_path || '',
    caption: remote.caption,
    wearing: Array.isArray(remote.wearing) ? remote.wearing : [],
    item_ids: Array.isArray(remote.item_ids) ? remote.item_ids : [],
    tagged_items: taggedItems,
    hashtags: Array.isArray(remote.hashtags) ? remote.hashtags : [],
    likes: remote.ootie_post_likes?.[0]?.count ?? remote.likes ?? 0,
    comments: remote.ootie_post_comments?.[0]?.count ?? remote.comments ?? 0,
    liked: false,
    saved: false,
    following: true,
    commentList: [],
    created_at: remote.created_at
  });

  const filteredPosts = computed(() => {
    const query = searchQuery.value.toLowerCase().trim();
    const feed = activeFeedTab.value;
    return uniquePostsById(appStore.ootdPosts).filter((post) => {
      const socialStore = useSocialStore();
      const isFollowing = socialStore.isFollowing({ id: post.user_id, username: post.username }) || post.username === appStore.profile.username;
      const matchFeed = feed === 'for-you' || isFollowing;
      const searchable = `${post.username} ${post.caption} ${(post.hashtags || []).join(' ')} ${(post.wearing || []).map(getWearingName).join(' ')}`.toLowerCase();
      return matchFeed && (!query || searchable.includes(query));
    });
  });

  const loadRemotePosts = async () => {
    const requestId = ++loadSequence;
    loading.value = true;
    loadError.value = '';
    try {
      const remotePosts = genuineContent(await fetchProfileOotdPosts(null));
      if (!Array.isArray(remotePosts)) throw new Error('FEED_UNAVAILABLE');
      const authStore = useAuthStore();
      let interactionState = { likedPostIds: new Set(), savedPostIds: new Set() };
      if (authStore.isMember && authStore.profileId) interactionState = await loadPostInteractionState(authStore.profileId);
      if (requestId !== loadSequence) return false;
      const itemIds = [...new Set(remotePosts.flatMap((post) => Array.isArray(post.item_ids) ? post.item_ids : []).map(String))];
      let publicItems = [];
      if (itemIds.length) {
        try { publicItems = await getPublicItemsByIds(itemIds); } catch (_) { /* public snapshots remain available by canonical id */ }
      }
      if (requestId !== loadSequence) return false;
      appStore.ootdPosts = uniquePostsById(remotePosts).sort((a,b) => (editorialLook(a)?.sort || 0) - (editorialLook(b)?.sort || 0)).map((remote) => {
        const taggedItems = (Array.isArray(remote.item_ids) ? remote.item_ids : [])
          .map((id) => publicItems.find((item) => String(item.id) === String(id)))
          .filter(Boolean);
        return {
          ...formatPost(remote, taggedItems),
          liked: interactionState.likedPostIds.has(String(remote.id)),
          saved: interactionState.savedPostIds.has(String(remote.id))
        };
      });
      return true;
    } catch (error) {
      loadError.value = error?.userMessage || '穿搭動態暫時無法載入。';
      return false;
    } finally {
      if (requestId === loadSequence) loading.value = false;
    }
  };

  const toggleLike = async (postId) => {
    const post = appStore.ootdPosts.find((item) => String(item.id) === String(postId));
    if (!post) return false;
    const authStore = useAuthStore();
    const profileId = authStore.profileId;
    const key = `like:${profileId}:${postId}`;
    if (interactionPending.has(key)) return false;
    if (authStore.isMember && authStore.profileId) {
      interactionPending.add(key);
      try {
        if (post.liked) await deletePostLike(authStore.profileId, postId);
        else await createPostLike(authStore.profileId, postId);
        if (profileId !== authStore.profileId) return false;
        post.liked = !post.liked;
        post.likes = Math.max(0, (post.likes || 0) + (post.liked ? 1 : -1));
        return true;
      } catch (error) {
        appStore.showToast(error?.userMessage || '按讚尚未同步到伺服器。', { type: 'error', syncStatus: 'REMOTE_FAILED' });
        return false;
      } finally { interactionPending.delete(key); }
    }
    appStore.openLoginGate('SOCIAL_AUTH_REQUIRED', `/ootd/${postId}`);
    return false;
  };

  const toggleSave = async (postId) => {
    const post = appStore.ootdPosts.find((item) => String(item.id) === String(postId));
    if (!post) return false;
    const authStore = useAuthStore();
    const profileId = authStore.profileId;
    const key = `save:${profileId}:${postId}`;
    if (interactionPending.has(key)) return false;
    if (authStore.isMember && authStore.profileId) {
      interactionPending.add(key);
      try {
        if (post.saved) await deleteSavedOutfit(authStore.profileId, { target_type: 'OOTD', target_id: postId });
        else await createSavedOutfit(authStore.profileId, { target_type: 'OOTD', target_id: postId });
        if (profileId !== authStore.profileId) return false;
        post.saved = !post.saved;
        if (post.saves != null) post.saves = Math.max(0, Number(post.saves) + (post.saved ? 1 : -1));
        appStore.showToast(post.saved ? '已收藏這篇穿搭' : '已取消收藏', { type: 'success', syncStatus: 'SYNCED' });
        return true;
      } catch (error) {
        appStore.showToast(error?.userMessage || '收藏尚未同步到伺服器。', { type: 'error', syncStatus: 'REMOTE_FAILED' });
        return false;
      } finally { interactionPending.delete(key); }
    }
    appStore.openLoginGate('SOCIAL_AUTH_REQUIRED', `/ootd/${postId}`);
    return false;
  };

  const loadComments = async (postId) => {
    const post = appStore.ootdPosts.find((item) => String(item.id) === String(postId));
    if (!post) return false;
    commentsLoading.value = true; commentsError.value = '';
    try {
      post.commentList = await listPostComments(postId);
      post.comments = post.commentList.length;
      return true;
    } catch {
      commentsError.value = t('留言暫時無法載入，請重試。');
      return false;
    } finally { commentsLoading.value = false; }
  };

  const addComment = async (postId, text, id = crypto.randomUUID()) => {
    const auth = useAuthStore();
    if (!auth.isMember || !auth.profileId) {
      appStore.openLoginGate('SOCIAL_AUTH_REQUIRED', `/ootd/${postId}?comment=1`);
      return false;
    }
    if (!text.trim()) return false;
    try {
      await insertPostComment({id, postId, profileId:auth.profileId, text});
      await loadComments(postId);
      appStore.showToast(t('留言已發布。'), {type:'success', syncStatus:'SYNCED'});
      return true;
    } catch {
      appStore.showToast(t('留言未能送出，內容已保留。'), {type:'error', syncStatus:'REMOTE_FAILED'});
      return false;
    }
  };

  const resolveOwnedItems = async (selectedItemIds, profileId) => {
    const uniqueIds = [...new Set((selectedItemIds || []).map(String))];
    if (!uniqueIds.length) return [];
    const ownedItems = await getCurrentUserItems(profileId);
    const selectedItems = uniqueIds.map((id) => ownedItems.find((item) => String(item.id) === id)).filter(Boolean);
    if (selectedItems.length !== uniqueIds.length) {
      const error = new Error('OOTD_TAGGED_ITEM_NOT_OWNED');
      error.userMessage = '只能標註自己衣櫥中的衣物。';
      throw error;
    }
    return selectedItems;
  };

  const formatHashtags = (hashtags) => (hashtags || '').split(/\s+/).filter(Boolean)
    .map((tag) => (tag.startsWith('#') ? tag : `#${tag}`));

  const toPublicItemSnapshot = (item) => ({
    id: item.id,
    name: item.name_zh || item.name,
    // Never duplicate a local/base64 clothing image into the OOTD row.
    photo: /^https?:\/\//i.test(item.photo || '') ? item.photo : ''
  });

  const createPost = async ({ imageFile, caption, hashtags, selectedItemIds }) => {
    const authStore = useAuthStore();
    if (!authStore.isMember || !authStore.profileId || !authStore.user?.id) {
      appStore.openLoginGate('OOTD_PUBLISH_AUTH_REQUIRED', '/explore?quick=add-ootd');
      return { post: null, syncStatus: 'AUTH_REQUIRED' };
    }
    if (publishing.value) return { post: null, syncStatus: 'IN_PROGRESS' };
    publishing.value = true;
    let uploaded = null;
    try {
      const selectedItems = await resolveOwnedItems(selectedItemIds, authStore.profileId);
      uploaded = await uploadOotdImage(imageFile, authStore.user.id);
      const remotePost = await insertOotdPost({
        image: uploaded.publicUrl,
        image_storage_path: uploaded.path,
        caption: caption.trim(),
        wearing: selectedItems.map(toPublicItemSnapshot),
        item_ids: selectedItems.map((item) => item.id),
        hashtags: formatHashtags(hashtags),
        likes: 0,
        comments: 0
      }, authStore.profileId);
      if (!remotePost) throw new Error('OOTD_REMOTE_CREATE_FAILED');
      const newPost = formatPost(remotePost, selectedItems);
      appStore.ootdPosts.unshift(newPost);
      appStore.addNotification('你的 OOTD 已成功發布。', 'explore');
      appStore.showToast('OOTD 已發布並同步', { type: 'success', syncStatus: 'SYNCED' });
      return { post: newPost, syncStatus: 'SYNCED' };
    } catch (error) {
      if (uploaded?.path) {
        try { await removeOotdImage(uploaded.path, authStore.user.id); } catch (_) { /* best-effort orphan cleanup */ }
      }
      appStore.showToast(error?.userMessage || 'OOTD 發布失敗，草稿已保留。', { type: 'error', syncStatus: 'REMOTE_FAILED' });
      return { post: null, syncStatus: 'REMOTE_FAILED', error };
    } finally {
      publishing.value = false;
    }
  };

  const updatePost = async (postId, { imageFile, image, caption, hashtags, selectedItemIds }) => {
    const authStore = useAuthStore();
    const post = appStore.ootdPosts.find((item) => String(item.id) === String(postId));
    if (!post || !authStore.isMember || !authStore.profileId || publishing.value) return { post: null, syncStatus: 'REMOTE_FAILED' };
    publishing.value = true;
    let uploaded = null;
    try {
      const selectedItems = await resolveOwnedItems(selectedItemIds, authStore.profileId);
      if (imageFile) uploaded = await uploadOotdImage(imageFile, authStore.user?.id);
      const changes = {
        image: uploaded?.publicUrl || image || post.image,
        caption: caption.trim(),
        wearing: selectedItems.map(toPublicItemSnapshot),
        item_ids: selectedItems.map((item) => item.id),
        hashtags: formatHashtags(hashtags)
      };
      if (uploaded?.path || post.image_storage_path) changes.image_storage_path = uploaded?.path || post.image_storage_path;
      const remotePost = await updateOotdPost(postId, changes, authStore.profileId);
      if (!remotePost || remotePost === true) throw new Error('OOTD_REMOTE_UPDATE_FAILED');
      const oldPath = post.image_storage_path;
      const interactionState = { liked: post.liked, saved: post.saved, commentList: post.commentList || [] };
      Object.assign(post, formatPost({ ...post, ...remotePost }, selectedItems), interactionState);
      if (uploaded?.path && oldPath && oldPath !== uploaded.path) {
        try { await removeOotdImage(oldPath, authStore.user?.id); } catch (_) { /* non-blocking old-image cleanup */ }
      }
      appStore.showToast('OOTD 修改已同步', { type: 'success', syncStatus: 'SYNCED' });
      return { post, syncStatus: 'SYNCED' };
    } catch (error) {
      if (uploaded?.path) {
        try { await removeOotdImage(uploaded.path, authStore.user?.id); } catch (_) { /* best-effort cleanup */ }
      }
      appStore.showToast(error?.userMessage || 'OOTD 修改失敗，原內容已保留。', { type: 'error', syncStatus: 'REMOTE_FAILED' });
      return { post, syncStatus: 'REMOTE_FAILED', error };
    } finally {
      publishing.value = false;
    }
  };

  const deletePost = async (postId) => {
    const authStore = useAuthStore();
    const index = appStore.ootdPosts.findIndex((item) => String(item.id) === String(postId));
    if (index === -1 || !authStore.isMember || !authStore.profileId) return false;
    const post = appStore.ootdPosts[index];
    try {
      const deleted = await deleteOotdPost(postId, authStore.profileId);
      if (!deleted) throw new Error('OOTD_REMOTE_DELETE_FAILED');
      appStore.ootdPosts.splice(index, 1);
      if (post.image_storage_path && authStore.user?.id) {
        try { await removeOotdImage(post.image_storage_path, authStore.user.id); } catch (_) { /* post delete remains authoritative */ }
      }
      appStore.showToast('OOTD 已刪除', { type: 'success', syncStatus: 'SYNCED' });
      return true;
    } catch (error) {
      appStore.showToast(error?.userMessage || '刪除失敗，貼文仍保留。', { type: 'error', syncStatus: 'REMOTE_FAILED' });
      return false;
    }
  };

  const getShareUrl = (postId) => `${window.location.origin}/ootd/${postId}`;

  const sharePost = async (postId) => {
    const shareUrl = getShareUrl(postId);
    try {
      if (navigator.share) {
        await navigator.share({ title: 'OOTIE 穿搭', text: '看看這套 OOTIE 穿搭', url: shareUrl });
        appStore.showToast('已完成分享', { type: 'success' });
        return 'SHARED';
      }
      shareSheetPostId.value = postId;
      return 'FALLBACK';
    } catch (error) {
      if (error?.name === 'AbortError') return 'CANCELLED';
      appStore.showToast('無法分享貼文連結', { type: 'error' });
      return 'FAILED';
    }
  };

  const copyShareLink = async (postId = shareSheetPostId.value) => {
    const shareUrl = getShareUrl(postId);
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(shareUrl);
      else {
        const input = document.createElement('input');
        input.value = shareUrl;
        document.body.appendChild(input);
        input.select();
        const copied = document.execCommand('copy');
        input.remove();
        if (!copied) throw new Error('COPY_FAILED');
      }
      appStore.showToast('貼文連結已複製', { type: 'success' });
      return true;
    } catch (_) {
      appStore.showToast('無法複製連結', { type: 'error' });
      return false;
    }
  };

  const shareTo = async (target, postId = shareSheetPostId.value) => {
    const url = getShareUrl(postId);
    const encodedUrl = encodeURIComponent(url);
    const text = encodeURIComponent('看看這套 OOTIE 穿搭');
    const targets = {
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      threads: `https://www.threads.net/intent/post?text=${text}%20${encodedUrl}`,
      line: `https://social-plugins.line.me/lineit/share?url=${encodedUrl}`
    };
    if (target === 'instagram') {
      const copied = await copyShareLink(postId);
      if (copied) {
        window.open('https://www.instagram.com/', '_blank', 'noopener,noreferrer');
        appStore.showToast('連結已複製，可貼到 Instagram 分享。', { type: 'success' });
      }
      return copied;
    }
    if (!targets[target]) return false;
    window.open(targets[target], '_blank', 'noopener,noreferrer');
    return true;
  };

  return {
    activeFeedTab,
    searchQuery,
    editingPostId,
    publishing,
    loading,
    loadError,
    shareSheetPostId,
    filteredPosts,
    loadRemotePosts,
    toggleLike,
    toggleSave,
    addComment,
    loadComments,
    commentsLoading,
    commentsError,
    createPost,
    updatePost,
    deletePost,
    sharePost,
    getShareUrl,
    copyShareLink,
    shareTo
  };
});
