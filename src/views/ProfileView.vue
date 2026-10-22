<template>
  <section v-if="isSelf && !isMember" class="page active profile-locked-state" id="profilePage">
    <h1>{{ t("登入後查看你的個人檔案") }}</h1>
    <p class="intro">{{ t("登入會員即可管理個人資料、衣櫥設定與自己的 OOTD。") }}</p>
    <button type="button" class="primary" @click="openLoginGate">{{ $t("登入／註冊") }}</button>
  </section>

  <section v-else class="page active" id="profilePage">
    <div class="profile-top-bar" v-if="!isSelf">
      <router-link to="/explore" class="back-link">← {{ t('返回探索') }}</router-link>
    </div>

    <p class="profile-context">{{ isSelf ? $t('我的帳號') : t('衣友個人檔案') }}</p>
    <h1>{{ isSelf ? $t('個人檔案') : (targetProfile.name || targetProfile.display_name) }}</h1>

    <div class="profile-header">
      <div class="profile-avatar" :class="{ 'has-image': targetProfile.avatar_url }">
        <img
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
      <div class="profile-stat">
        <strong>{{ formatMetric(followCounts.followers) }}</strong>
        <span>{{ t("追蹤者") }}</span>
      </div>
      <div class="profile-stat">
        <strong>{{ formatMetric(followCounts.following) }}</strong>
        <span>{{ $t("追蹤中") }}</span>
      </div>
      <button v-if="isSelf" type="button" class="profile-stat profile-stat-button" @click="openSavedOutfits">
        <strong>{{ formatMetric(profileMetrics.saved) }}</strong>
        <span>{{ t("我收藏的穿搭") }}</span>
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

    <router-link v-if="isSelf" to="/shop?tab=activity" class="profile-membership-card">
      <div>

        <strong>{{ $t('我的購物足跡') }}</strong>
        <small>{{ $t('查看收藏、試穿與前往商家的紀錄。') }}</small>
      </div>
      <span aria-hidden="true">→</span>
    </router-link>

    <section class="profile-settings" v-if="isSelf">
      <h2>{{ $t("衣櫥設定") }}</h2>
      <div class="setting-row">
        <div>
          <strong>{{ $t("公開我的衣櫥") }}</strong>
          <p>{{ $t("讓衣友可以查看你的單品並提供穿搭建議。") }}</p>
        </div>
        <button
          :class="['switch', { on: appStore.profile.public_closet }]"
          :aria-pressed="appStore.profile.public_closet"
          :disabled="changingVisibility"
          :aria-label="t('切換公開衣櫥')"
          @click="togglePublicCloset"
        ></button>
      </div>
    </section>

    <section class="profile-ootd">
      <div class="profile-ootd-heading">
        <h2>{{ isSelf ? $t('我的 OOTD') : tf('{user} 的 OOTD', { user: targetProfile.username }) }}</h2>
      </div>

      <div v-if="userPosts.length" class="ootd-grid">
        <article v-for="post in userPosts" :key="post.id" class="ootd-card">
          <router-link :to="{ path: `/ootd/${post.id}`, query: { user: post.username, from: 'profile' } }" class="ootd-card-link">
            <img class="ootd-photo" :src="post.image" :alt="tf('{user} 的 OOTD', { user: post.username })" loading="lazy" decoding="async" />
          </router-link>
          <div class="ootd-body">
            <p class="ootd-caption">{{ $t(post.caption) }}</p>
            <div v-if="post.hashtags && post.hashtags.length" class="ootd-tags">
              {{ post.hashtags.join('　') }}
            </div>
            <p class="ootd-items">
              {{ post.wearing && post.wearing.length ? tf('穿搭單品：{items}', { items: wearingNames(post).join(' · ') }) : t('尚未標註衣櫥單品') }}
            </p>
            <p v-if="post.created_at || post.createdAt" class="ootd-date">
              {{ formatDate(post.created_at || post.createdAt) }}
            </p>
            <div class="ootd-actions">
              <button type="button" :class="['ootd-action', { liked: post.liked }]" @click="ootdStore.toggleLike(post.id)">
                {{ post.liked ? '♥' : '♡' }} {{ post.likes || 0 }}
              </button>
              <button type="button" :class="['ootd-action', { saved: post.saved }]" @click="ootdStore.toggleSave(post.id)">
                {{ post.saved ? '▣ ' + t('已收藏') : '▢ ' + t('收藏') }}
              </button>
              <button type="button" class="ootd-action" @click="shareOotd(post.id)">{{ $t("分享") }}</button>
              <template v-if="isSelf">
                <button type="button" class="ootd-action" @click="editOotd(post.id)">{{ t("編輯") }}</button>
                <button type="button" class="ootd-action ootd-delete-action" @click="deleteOotd(post.id)">
                  {{ t("刪除") }}
                </button>
              </template>
            </div>
          </div>
        </article>
      </div>

      <div v-else class="profile-ootd-empty">
        {{ t(isSelf ? '你發布的 OOTD 會顯示在這裡。' : '此使用者尚未發布 OOTD。') }}
      </div>
    </section>
  </section>
</template>

<script setup>
import { t, tf, formatDate } from '@/i18n';
import { isFixtureContent } from '@/services/contentAuthenticity';
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAppStore } from '@/stores/app';
import { useAuthStore } from '@/stores/auth';
import { useOotdStore } from '@/stores/ootd';
import { useSocialStore } from '@/stores/social';
import { getPublicProfileByUsername, updatePublicProfile } from '@/services/profileRepository';
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
const followCounts = ref({ followers: 0, following: 0 });

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
  if (!route.query.user) {
    remotePublicProfile.value = null;
    return;
  }
  try {
    const profile = await getPublicProfileByUsername(route.query.user);
    remotePublicProfile.value = isFixtureContent(profile) ? null : profile;
  } catch (error) {
    // Keep the public page usable when the optional profile read is unavailable;
    // no private account fields are ever used in the local presentation fallback.
    remotePublicProfile.value = null;
  }
};

onMounted(() => {
  ootdStore.loadRemotePosts();
  loadPublicProfile().then(loadProfileMetrics);
});

watch(() => route.query.user, async () => {
  await loadPublicProfile();
  await loadProfileMetrics();
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

watch(() => authStore.profileId, async (profileId) => {
  if (!profileId) return;
  await loadProfileMetrics();
}, { immediate: true });

const formatMetric = (value) => value === null || value === undefined ? '—' : value;

const openSavedOutfits = () => {
  router.push({ path: '/bookmarks', query: { tab: 'outfits' } });
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


const wearingNames = (post) => resolvePostTaggedItems(
  post,
  [...(post.tagged_items || []), ...appStore.items]
).map((item) => item.name);

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

const changingVisibility = ref(false);
const togglePublicCloset = async () => {
  if (!isMember.value || !authStore.profileId) { openLoginGate(); return; }
  if (changingVisibility.value) return;
  const profileId = authStore.profileId;
  const next = !appStore.profile.public_closet;
  changingVisibility.value = true;
  try {
    const row = await updatePublicProfile(profileId, { public_closet: next });
    if (row?.public_closet !== next) throw new Error('PROFILE_UPDATE_NOT_CONFIRMED');
    if (profileId !== authStore.profileId) return;
    appStore.profile.public_closet = next;
    authStore.profileIdentity = { ...authStore.profileIdentity, profile: { ...authStore.profile, public_closet: next } };
    appStore.showToast(t(next ? '衣櫥已設為公開' : '衣櫥已設為私人'), { type: 'success', syncStatus: 'SYNCED' });
  } catch {
    appStore.showToast(t('衣櫥設定未儲存，請重試。'), { type: 'error', syncStatus: 'REMOTE_FAILED' });
  } finally { changingVisibility.value = false; }
};
</script>

<style scoped>
.profile-membership-card { display: flex; justify-content: space-between; align-items: center; gap: 18px; margin: 0 0 24px; padding: 18px 0; border-bottom: 1px solid var(--line); transition: color .18s ease; }
.profile-membership-card:hover { color: var(--accent-violet-ink); }
.profile-membership-card strong, .profile-membership-card small { display: block; }
.profile-membership-card > div > span { color: var(--muted); font-size: 12px; }
.profile-membership-card strong { margin-top: 5px; font-size: 19px; font-weight: 800; }
.profile-membership-card small { margin-top: 5px; color: var(--muted); }
@media (max-width: 620px) { .profile-membership-card { align-items: flex-start; padding: 16px 0; } }
</style>

