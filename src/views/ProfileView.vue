<template>
  <section v-if="isSelf && !isMember" class="page active profile-locked-state" id="profilePage">
    <h1>登入後查看你的個人檔案</h1>
    <p class="intro">登入會員即可管理個人資料、衣櫥設定與自己的 OOTD。</p>
    <button type="button" class="primary" @click="openLoginGate">登入／註冊</button>
  </section>

  <section v-else class="page active" id="profilePage">
    <div class="profile-top-bar" v-if="!isSelf">
      <router-link to="/explore" class="back-link">← 返回探索</router-link>
    </div>

    <p class="profile-context">{{ isSelf ? '我的帳號' : '衣友個人檔案' }}</p>
    <h1>{{ isSelf ? '個人檔案' : (targetProfile.name || targetProfile.display_name) }}</h1>

    <div class="profile-header">
      <div class="profile-avatar" :class="{ 'has-image': targetProfile.avatar_url }">
        <img
          v-if="targetProfile.avatar_url"
          :src="targetProfile.avatar_url"
          :alt="`${targetProfile.name || targetProfile.display_name} 的大頭貼`"
        />
        <template v-else>{{ targetProfile.initials }}</template>
      </div>
      <div class="profile-copy">
        <h2>{{ targetProfile.name || targetProfile.display_name }}</h2>
        <p class="handle">{{ targetProfile.username }}</p>
        <p class="bio">{{ targetProfile.slogan || targetProfile.bio }}</p>
      </div>
      <div class="profile-actions">
        <template v-if="isSelf">
          <button class="secondary" @click="openEditProfile">編輯資料</button>
          <button class="primary" @click="openOotdForm">＋ 發布 OOTD</button>
        </template>
        <template v-else>
          <button
            :class="['primary', { secondary: isFollowingTarget }]"
            @click="toggleFollowTarget"
          >
            {{ isFollowingTarget ? '已追蹤' : '＋ 追蹤' }}
          </button>
        </template>
      </div>
    </div>

    <div class="profile-stats">
      <div class="profile-stat">
        <strong>{{ formatMetric(followCounts.followers) }}</strong>
        <span>追蹤者</span>
      </div>
      <div class="profile-stat">
        <strong>{{ formatMetric(followCounts.following) }}</strong>
        <span>追蹤中</span>
      </div>
      <button v-if="isSelf" type="button" class="profile-stat profile-stat-button" @click="openSavedOutfits">
        <strong>{{ formatMetric(profileMetrics.saved) }}</strong>
        <span>我收藏的穿搭</span>
        <small v-if="profileMetrics.savedError">暫時無法取得</small>
      </button>
      <button v-if="isSelf" type="button" class="profile-stat profile-stat-button" @click="openHelpHistory">
        <strong>{{ formatMetric(profileMetrics.helped) }}</strong>
        <span>幫助衣友</span>
        <small v-if="profileMetrics.helpedError">暫時無法取得</small>
      </button>
      <div v-else class="profile-stat">
        <strong>{{ formatMetric(profileMetrics.helped) }}</strong>
        <span>幫助衣友</span>
        <small v-if="profileMetrics.helpedError">暫時無法取得</small>
      </div>
      <div class="profile-stat">
        <strong>{{ formatMetric(profileMetrics.likes) }}</strong>
        <span>貼文獲得讚數</span>
        <small v-if="profileMetrics.likesError">暫時無法取得</small>
      </div>
    </div>

    <router-link v-if="isSelf" to="/membership" class="profile-membership-card">
      <div>
        <span>方案與點數</span>
        <strong>{{ subscriptionStore.currentPlan }} · {{ subscriptionStore.pointsBalance }} 點</strong>
        <small>查看生日點數、AI 扣點與方案紀錄</small>
      </div>
      <span aria-hidden="true">→</span>
    </router-link>

    <section class="profile-settings" v-if="isSelf">
      <h2>衣櫥設定</h2>
      <div class="setting-row">
        <div>
          <strong>公開我的衣櫥</strong>
          <p>讓衣友可以查看你的單品並提供穿搭建議。</p>
        </div>
        <button
          :class="['switch', { on: appStore.profile.public_closet }]"
          :aria-pressed="appStore.profile.public_closet"
          aria-label="切換公開衣櫥"
          @click="togglePublicCloset"
        ></button>
      </div>
    </section>

    <section class="profile-ootd">
      <div class="profile-ootd-heading">
        <h2>{{ isSelf ? '我的 OOTD' : `${targetProfile.username} 的 OOTD` }}</h2>
      </div>

      <div v-if="userPosts.length" class="ootd-grid">
        <article v-for="post in userPosts" :key="post.id" class="ootd-card">
          <router-link :to="{ path: `/ootd/${post.id}`, query: { user: post.username, from: 'profile' } }" class="ootd-card-link">
            <img class="ootd-photo" :src="post.image" :alt="`${post.username} 的 OOTD`" loading="lazy" decoding="async" />
          </router-link>
          <div class="ootd-body">
            <p class="ootd-caption">{{ post.caption }}</p>
            <div v-if="post.hashtags && post.hashtags.length" class="ootd-tags">
              {{ post.hashtags.join('　') }}
            </div>
            <p class="ootd-items">
              {{ post.wearing && post.wearing.length ? `穿搭單品：${wearingNames(post).join('、')}` : '尚未標註衣櫥單品' }}
            </p>
            <p v-if="post.created_at || post.createdAt" class="ootd-date">
              {{ formatDate(post.created_at || post.createdAt) }}
            </p>
            <div class="ootd-actions">
              <button type="button" :class="['ootd-action', { liked: post.liked }]" @click="ootdStore.toggleLike(post.id)">
                {{ post.liked ? '♥' : '♡' }} {{ post.likes || 0 }}
              </button>
              <button type="button" :class="['ootd-action', { saved: post.saved }]" @click="ootdStore.toggleSave(post.id)">
                {{ post.saved ? '▣ 已收藏' : '▢ 收藏' }}
              </button>
              <button type="button" class="ootd-action" @click="shareOotd(post.id)">分享</button>
              <template v-if="isSelf">
                <button type="button" class="ootd-action" @click="editOotd(post.id)">編輯</button>
                <button type="button" class="ootd-action ootd-delete-action" @click="deleteOotd(post.id)">
                  刪除
                </button>
              </template>
            </div>
          </div>
        </article>
      </div>

      <div v-else class="profile-ootd-empty">
        {{ isSelf ? '你發布的 OOTD 會顯示在這裡。' : '此使用者尚未發布 OOTD。' }}
      </div>
    </section>
  </section>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAppStore } from '@/stores/app';
import { useAuthStore } from '@/stores/auth';
import { useOotdStore } from '@/stores/ootd';
import { useSubscriptionStore } from '@/stores/subscription';
import { useSocialStore } from '@/stores/social';
import { getPublicProfileByUsername } from '@/services/profileRepository';
import { resolvePostTaggedItems } from '@/services/ootdTaggedItems';
import {
  countSavedOutfits,
  loadHelpedFriendsCount,
  loadReceivedLikeCount
} from '@/services/socialMetrics';

const appStore = useAppStore();
const authStore = useAuthStore();
const ootdStore = useOotdStore();
const subscriptionStore = useSubscriptionStore();
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
    remotePublicProfile.value = await getPublicProfileByUsername(route.query.user);
  } catch (error) {
    // Keep the public page usable when the optional profile read is unavailable;
    // no private account fields are ever used in the local presentation fallback.
    remotePublicProfile.value = null;
  }
};

onMounted(() => {
  ootdStore.loadRemotePosts();
  loadPublicProfile().then(loadProfileMetrics);
  if (isMember.value) subscriptionStore.refresh();
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
  await Promise.allSettled([subscriptionStore.refresh(), loadProfileMetrics()]);
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

const formatDate = (val) => {
  if (!val) return '';
  const date = new Date(val);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('zh-TW');
};

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
  if (confirm('確定要刪除這則 OOTD 嗎？\n刪除後無法恢復。')) {
    await ootdStore.deletePost(postId);
  }
};

const shareOotd = (postId) => {
  ootdStore.sharePost(postId);
};

const togglePublicCloset = () => {
  appStore.profile.public_closet = !appStore.profile.public_closet;
  appStore.showToast(
    appStore.profile.public_closet ? '衣櫥已在此裝置設為公開' : '衣櫥已在此裝置設為私人',
    { type: 'warning', syncStatus: 'LOCAL_ONLY' }
  );
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

