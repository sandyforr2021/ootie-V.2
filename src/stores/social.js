import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { useAuthStore } from './auth';
import { useAppStore } from './app';
import {
  followProfile,
  getFollowCounts,
  loadFollowingProfiles,
  loadNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  unfollowProfile
} from '@/services/socialRepository';

const relativeTime = (value) => {
  const milliseconds = Date.now() - new Date(value || 0).getTime();
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return '剛剛';
  const minutes = Math.floor(milliseconds / 60000);
  if (minutes < 1) return '剛剛';
  if (minutes < 60) return `${minutes} 分鐘前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小時前`;
  return `${Math.floor(hours / 24)} 天前`;
};

export const useSocialStore = defineStore('social', () => {
  const followingProfiles = ref([]);
  const notifications = ref([]);
  const loading = ref(false);
  const error = ref('');
  const pendingProfileIds = ref([]);
  const countsByProfile = ref({});

  const unreadCount = computed(() => notifications.value.filter((item) => !item.read).length);
  const normalizeUsername = (value) => {
    const normalized = String(value || '').trim().toLowerCase();
    return normalized && !normalized.startsWith('@') ? `@${normalized}` : normalized;
  };

  const isFollowing = ({ id, username } = {}) => followingProfiles.value.some((item) =>
    (id && item.following_id === id) || (username && normalizeUsername(item.following?.username) === normalizeUsername(username))
  );

  const refresh = async (profileId) => {
    if (!profileId) {
      followingProfiles.value = [];
      notifications.value = [];
      return;
    }
    loading.value = true;
    error.value = '';
    try {
      const [follows, remoteNotifications, counts] = await Promise.all([
        loadFollowingProfiles(profileId),
        loadNotifications(profileId),
        getFollowCounts(profileId)
      ]);
      followingProfiles.value = follows;
      notifications.value = remoteNotifications.map((item) => ({ ...item, time: relativeTime(item.created_at) }));
      countsByProfile.value = { ...countsByProfile.value, [profileId]: counts };
    } catch (err) {
      error.value = err?.userMessage || '社群狀態暫時無法載入。';
    } finally {
      loading.value = false;
    }
  };

  const loadCounts = async (profileId) => {
    if (!profileId) return { followers: 0, following: 0 };
    const counts = await getFollowCounts(profileId);
    countsByProfile.value = { ...countsByProfile.value, [profileId]: counts };
    return counts;
  };

  const toggleFollow = async (target) => {
    const auth = useAuthStore();
    const app = useAppStore();
    if (!auth.isMember || !auth.profileId) {
      app.openLoginGate('AUTH_REQUIRED', target?.username ? `/profile?user=${encodeURIComponent(target.username)}` : '/explore');
      return false;
    }
    if (!target?.id || target.id === auth.profileId || pendingProfileIds.value.includes(target.id)) return false;
    pendingProfileIds.value.push(target.id);
    const currentlyFollowing = isFollowing(target);
    try {
      if (currentlyFollowing) {
        await unfollowProfile(auth.profileId, target.id);
        followingProfiles.value = followingProfiles.value.filter((item) => item.following_id !== target.id);
      } else {
        const row = await followProfile(auth.profileId, target.id);
        followingProfiles.value.unshift({ ...row, following: target });
      }
      await Promise.allSettled([loadCounts(auth.profileId), loadCounts(target.id)]);
      app.showToast(currentlyFollowing ? `已取消追蹤 ${target.username}` : `已追蹤 ${target.username}`, { type: 'success', syncStatus: 'SYNCED' });
      return true;
    } catch (err) {
      app.showToast(err?.userMessage || '追蹤狀態同步失敗。', { type: 'error', syncStatus: 'REMOTE_FAILED' });
      return false;
    } finally {
      pendingProfileIds.value = pendingProfileIds.value.filter((id) => id !== target.id);
    }
  };

  const markRead = async (notificationId) => {
    const auth = useAuthStore();
    const target = notifications.value.find((item) => item.id === notificationId);
    if (!auth.profileId || !target || target.read) return;
    await markNotificationRead(auth.profileId, notificationId);
    target.read = true;
  };

  const markAllRead = async () => {
    const auth = useAuthStore();
    if (!auth.profileId || unreadCount.value === 0) return;
    await markAllNotificationsRead(auth.profileId);
    notifications.value.forEach((item) => { item.read = true; });
  };

  const clear = () => {
    followingProfiles.value = [];
    notifications.value = [];
    countsByProfile.value = {};
    error.value = '';
  };

  return {
    followingProfiles,
    notifications,
    unreadCount,
    loading,
    error,
    pendingProfileIds,
    countsByProfile,
    isFollowing,
    refresh,
    loadCounts,
    toggleFollow,
    markRead,
    markAllRead,
    clear
  };
});
