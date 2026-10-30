<template>
  <section v-if="isSelf && !isMember" class="page active profile-locked-state app-page" id="profilePage">
    <header class="ootie-page-heading"><h1>{{ t("登入後查看你的個人檔案") }}</h1></header>
    <p class="intro">{{ t("登入會員即可管理個人資料、衣櫥設定與自己的 OOTD。") }}</p>
    <button type="button" class="primary" @click="openLoginGate">{{ $t("登入／註冊") }}</button>
  </section>

  <section v-else class="page active app-page" id="profilePage">
    <header class="ootie-page-heading"><h1>{{ isSelf ? $t('個人檔案') : (targetProfile.name || targetProfile.display_name) }}</h1><router-link v-if="!isSelf" to="/explore" class="back-link"><AppIcon name="back" :size="16" />{{ t('返回探索') }}</router-link></header>

    <div class="profile-header">
      <div class="profile-avatar" :class="{ 'has-image': targetProfile.avatar_url }">
        <MediaImage
          v-if="targetProfile.avatar_url"
          :src="targetProfile.avatar_url"
          :alt="tf('{name} 的大頭貼', { name: targetProfile.name || targetProfile.display_name })"
        />
        <template v-else>{{ targetProfile.initials }}</template>
      </div>
      <div class="profile-copy">
        <h2>{{ targetProfile.name || targetProfile.display_name }}</h2>
        <p class="handle">{{ targetProfile.username }}</p>
        <p class="bio">{{ t(targetProfile.slogan || targetProfile.bio) }}</p>
      </div>
      <div class="profile-actions">
        <template v-if="isSelf">
          <button class="secondary" @click="openEditProfile">{{ t("編輯資料") }}</button>
          <button class="primary" @click="openOotdForm">＋ {{ t('發布 OOTD') }}</button>
        </template>
        <template v-else>
          <button
            :class="['primary', { secondary: isFollowingTarget }]"
            @click="toggleFollowTarget"
          >
            {{ isFollowingTarget ? t('已追蹤') : '＋ ' + t('追蹤') }}
          </button>
        </template>
      </div>
    </div>

    <div class="profile-stats">
      <button type="button" class="profile-stat profile-stat-button" @click="connectionsKind='followers'">
        <strong>{{ formatMetric(followCounts.followers) }}</strong>
        <span>{{ t("追蹤者") }}</span>
      </button>
      <button type="button" class="profile-stat profile-stat-button" @click="connectionsKind='following'">
        <strong>{{ formatMetric(followCounts.following) }}</strong>
        <span>{{ $t("追蹤中") }}</span>
      </button>
      <button v-if="isSelf" type="button" class="profile-stat profile-stat-button" @click="openSavedOutfits">
        <strong>{{ formatMetric(profileMetrics.saved) }}</strong>
        <span>{{ t("我的收藏") }}</span>
        <small v-if="profileMetrics.savedError">{{ t("暫時無法取得") }}</small>
      </button>
      <button v-if="isSelf" type="button" class="profile-stat profile-stat-button" @click="openHelpHistory">
        <strong>{{ formatMetric(profileMetrics.helped) }}</strong>
        <span>{{ $t("幫助衣友") }}</span>
        <small v-if="profileMetrics.helpedError">{{ t("暫時無法取得") }}</small>
      </button>
      <div v-else class="profile-stat">
        <strong>{{ formatMetric(profileMetrics.helped) }}</strong>
        <span>{{ $t("幫助衣友") }}</span>
        <small v-if="profileMetrics.helpedError">{{ t("暫時無法取得") }}</small>
      </div>
      <div class="profile-stat">
        <strong>{{ formatMetric(profileMetrics.likes) }}</strong>
        <span>{{ t("貼文獲得讚數") }}</span>
        <small v-if="profileMetrics.likesError">{{ t("暫時無法取得") }}</small>
      </div>
    </div>

    <FollowListDialog :open="!!connectionsKind" :profile-id="isSelf?authStore.profileId:remotePublicProfile?.id" :kind="connectionsKind" @close="connectionsKind=''"/>




    <section class="profile-ootd">
      <div class="profile-ootd-heading">
        <h2>{{ isSelf ? $t('我的 OOTD') : tf('{user} 的 OOTD', { user: targetProfile.username }) }}</h2>
      </div>

      <div v-if="userPosts.length" class="ootd-grid">
        <OotdFeedCard v-for="post in userPosts" :key="post.id" :post="profilePost(post)" :own="isSelf" :following="isFollowingTarget" :can-follow="!isSelf" @profile="router.push({path:'/profile',query:isSelf?{}:{user:post.username}})" @follow="toggleFollowTarget" @open="openProfilePost(post)" @comments="openProfilePost(post,true)" @like="ootdStore.toggleLike(post.id)" @save="ootdStore.toggleSave(post.id)" @share="shareOotd(post.id)" @edit="editOotd(post.id)" @delete="deleteOotd(post.id)"/>
      </div>

      <div v-else class="profile-ootd-empty">
        {{ t(isSelf ? '你發布的 OOTD 會顯示在這裡。' : '此使用者尚未發布 OOTD。') }}
      </div>
      <button v-if="userPosts.length && ootdStore.hasMore" type="button" class="secondary profile-load-more" :disabled="ootdStore.loading || ootdStore.loadingMore" @click="ootdStore.loadMorePosts()">{{ t(ootdStore.loadingMore ? '載入中…' : '載入更多') }}</button>
    </section>
  </section>
</template>

<script setup>
import MediaImage from '@/components/ui/MediaImage.vue';
import OotdFeedCard from '@/components/ootd/OotdFeedCard.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import { t, tf, formatDate } from '@/i18n';
import SavedOutfitsCollection from '@/components/bookmarks/SavedOutfitsCollection.vue';
import { isFixtureContent } from '@/services/contentAuthenticity';
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAppStore } from '@/stores/app';
import { useAuthStore } from '@/stores/auth';
import { useOotdStore } from '@/stores/ootd';
import { useSocialStore } from '@/stores/social';
import { getPublicProfileByUsername, updatePublicProfile } from '@/services/profileRepository';
import FollowListDialog from '@/components/modal/FollowListDialog.vue';
import { resolvePostTaggedItems } from '@/services/ootdTaggedItems';
import {
  countSavedOutfits,
  loadHelpedFriendsCount,
  loadReceivedLikeCount
} from '@/services/socialMetrics';

const appStore = useAppStore();
const authStore = useAuthStore();
const ootdStore = useOotdStore();
const socialStore = useSocialStore();
const connectionsKind=ref('');
const followCounts = ref({ followers: null, following: null });

const isMember = computed(() => authStore.isMember);
const openLoginGate = () => appStore.openLoginGate('AUTH_REQUIRED', '/profile');
const route = useRoute();
const router = useRouter();
const remotePublicProfile = ref(null);
const profileMetrics = ref({
  saved: null,
  helped: null,
  likes: null,
  savedError: false,
  helpedError: false,
  likesError: false
});

const loadPublicProfile = async () => {
  const username = route.query.user;
  remotePublicProfile.value = null;
  if (!username) return;
  try {
    const profile = await getPublicProfileByUsername(username);
    if (route.query.user !== username) return;
    remotePublicProfile.value = isFixtureContent(profile) ? null : profile;
  } catch (error) {
    // Keep the public page usable when the optional profile read is unavailable;
    // no private account fields are ever used in the local presentation fallback.
    if (route.query.user === username) remotePublicProfile.value = null;
  }
};

onMounted(() => {
  if(route.query.tab==='saved')void router.replace('/profile/saved');
});

const isSelf = computed(() => {
  const queryUser = route.query.user;
  if (!queryUser) return true;
  return isMember.value && appStore.normalizeUsername(queryUser) === appStore.normalizeUsername(appStore.profile.username);
});

const publicDisplayName = (profile, fallback) => {
  const displayName = profile?.display_name?.trim();
  if (displayName && !/demo|模擬|測試帳號/i.test(displayName)) return displayName;
  return profile?.username || fallback;
};

const targetProfile = computed(() => {
  if (isSelf.value) {
    return appStore.profile;
  }
  const queryUser = appStore.normalizeUsername(route.query.user);
  if (remotePublicProfile.value) {
    const displayName = publicDisplayName(remotePublicProfile.value, queryUser);
    return {
      ...remotePublicProfile.value,
      display_name: displayName,
      slogan: remotePublicProfile.value.slogan || '用衣櫥記錄日常，與衣友分享穿搭靈感。',
      name: displayName,
      username: remotePublicProfile.value.username || queryUser,
      initials: remotePublicProfile.value.initials || queryUser.replace('@', '').substring(0, 2).toUpperCase()
    };
  }
  const matchedPosts = appStore.ootdPosts.filter(
    (p) => appStore.normalizeUsername(p.username) === queryUser
  );

  const samplePost = matchedPosts[0];
  const initials = samplePost ? samplePost.initials : queryUser.replace('@', '').substring(0, 2).toUpperCase();
  const name = samplePost ? samplePost.username : queryUser;
  return {
    name,
    display_name: name,
    username: queryUser,
    initials,
    avatar_url: '',
    slogan: '用衣櫥記錄日常，與衣友分享穿搭靈感。',
    bio: '用衣櫥記錄日常，與衣友分享穿搭靈感。',
    public_closet: true
  };
});

const loadProfileMetrics = async () => {
  const profileId = isSelf.value ? authStore.profileId : remotePublicProfile.value?.id;
  if (!profileId) {
    followCounts.value = { followers: null, following: null };
    profileMetrics.value = {
      saved: null, helped: null, likes: null,
      savedError: false, helpedError: false, likesError: false
    };
    return;
  }

  try {
    followCounts.value = await socialStore.loadCounts(profileId);
  } catch {
    followCounts.value = { followers: null, following: null };
  }

  const requests = [
    loadHelpedFriendsCount(profileId),
    loadReceivedLikeCount(profileId)
  ];
  if (isSelf.value) requests.unshift(countSavedOutfits(profileId));
  const results = await Promise.allSettled(requests);
  const [savedResult, helpedResult, likesResult] = isSelf.value
    ? results
    : [{ status: 'fulfilled', value: null }, ...results];

  profileMetrics.value = {
    saved: savedResult.status === 'fulfilled' ? savedResult.value ?? 0 : null,
    helped: helpedResult.status === 'fulfilled' ? helpedResult.value : null,
    likes: likesResult.status === 'fulfilled' ? likesResult.value : null,
    savedError: savedResult.status === 'rejected',
    helpedError: helpedResult.status === 'rejected',
    likesError: likesResult.status === 'rejected'
  };
};

watch([() => route.query.user, () => authStore.profileId], async (_, __, onCleanup) => {
  let cancelled = false;
  onCleanup(() => { cancelled = true; });
  connectionsKind.value = '';
  await loadPublicProfile();
  if (cancelled) return;
  const authorId = isSelf.value ? authStore.profileId : remotePublicProfile.value?.id;
  await Promise.all([
    loadProfileMetrics(),
    ootdStore.loadRemotePosts({ authorIds: authorId ? [authorId] : [] })
  ]);
}, { immediate: true });

const formatMetric = (value) => value === null || value === undefined ? '—' : value;

const openSavedOutfits = () => {
  router.push('/profile/saved');
};

const openHelpHistory = () => {
  router.push('/profile/help-history');
};

const isFollowingTarget = computed(() => {
  if (isSelf.value) return false;
  return socialStore.isFollowing({ id: remotePublicProfile.value?.id, username: targetProfile.value.username });
});

const toggleFollowTarget = async () => {
  if (isSelf.value) return;
  await socialStore.toggleFollow({ ...targetProfile.value, id: remotePublicProfile.value?.id });
  if (remotePublicProfile.value?.id) followCounts.value = await socialStore.loadCounts(remotePublicProfile.value.id);
};

const userPosts = computed(() => {
  if (isSelf.value) {
    return appStore.ootdPosts.filter(
      (p) => p.username === appStore.profile.username || p.user_id === appStore.profile.user_id
    );
  }
  const queryUser = appStore.normalizeUsername(route.query.user);
  return appStore.ootdPosts.filter(
    (p) => appStore.normalizeUsername(p.username) === queryUser
  );
});


const profilePost=post=>({...post,avatar_url:post.avatar_url||targetProfile.value.avatar_url,display_name:post.display_name||targetProfile.value.name||targetProfile.value.display_name,initials:post.initials||targetProfile.value.initials,tagged_items:resolvePostTaggedItems(post,[...(post.tagged_items||[]),...appStore.items])});
const openProfilePost=(post,comments=false)=>router.push({path:`/ootd/${post.id}`,query:{user:post.username,from:'profile',...(comments?{comment:'1'}:{})}});

const openEditProfile = () => {
  appStore.isProfileEditOpen = true;
};

const openOotdForm = () => {
  if (!isMember.value) {
    appStore.openLoginGate('OOTD_PUBLISH_AUTH_REQUIRED', '/profile');
    return;
  }
  ootdStore.editingPostId = null;
  appStore.isOotdFormOpen = true;
};

const editOotd = (postId) => {
  ootdStore.editingPostId = postId;
  appStore.isOotdFormOpen = true;
};

const deleteOotd = async (postId) => {
  if (confirm(t('確定要刪除這則 OOTD 嗎？刪除後無法恢復。'))) {
    await ootdStore.deletePost(postId);
  }
};

const shareOotd = (postId) => {
  ootdStore.sharePost(postId);
};

</script>

<style scoped>
.profile-load-more { display:block; margin:24px auto 0; }
.profile-membership-card { display: flex; justify-content: space-between; align-items: center; gap: 18px; margin: 0 0 24px; padding: 18px 0; border-bottom: 1px solid var(--line); transition: color .18s ease; }
.profile-membership-card:hover { color: var(--accent-violet-ink); }
.profile-membership-card strong, .profile-membership-card small { display: block; }
.profile-membership-card > div > span { color: var(--muted); font-size: 12px; }
.profile-membership-card strong { margin-top: 5px; font-size: 19px; font-weight: 800; }
.profile-membership-card small { margin-top: 5px; color: var(--muted); }
@media (max-width: 620px) { .profile-membership-card { align-items: flex-start; padding: 16px 0; } }
</style>

