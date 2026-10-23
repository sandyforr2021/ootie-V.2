<template>
  <section class="page active" id="explorePage">
    <header class="explore-hero">
      <div>
        <h1>{{ $t("探索") }}</h1>
        <p class="intro" role="note">{{ $t('分享今天的穿搭，找到下一個靈感。') }}</p>
      </div>
      <p class="explore-note" aria-hidden="true">new looks<br />new stories ♡</p>
    </header>

    <div class="explore-toolbar">
      <label class="explore-search">
        <span>⌕</span>
        <input
          v-model="ootdStore.searchQuery"
          type="search"
          :placeholder="$t(&quot;搜尋穿搭&quot;)"
          :aria-label="$t(&quot;搜尋穿搭、風格、使用者&quot;)"
        />
      </label>
      <div class="feed-tabs">
        <button
          type="button"
          :aria-pressed="ootdStore.activeFeedTab === 'for-you'"
          :class="['feed-tab', { active: ootdStore.activeFeedTab === 'for-you' }]"
          @click="ootdStore.activeFeedTab = 'for-you'"
        > {{ $t("為你推薦") }} </button>
        <button
          type="button"
          :aria-pressed="ootdStore.activeFeedTab === 'following'"
          :class="['feed-tab', { active: ootdStore.activeFeedTab === 'following' }]"
          @click="ootdStore.activeFeedTab = 'following'"
        > {{ $t("追蹤中") }} </button>
      </div>
    </div>

    <div v-if="ootdStore.loading" class="explore-empty" role="status" aria-live="polite">{{ $t("正在載入穿搭動態…") }}</div>
    <div v-else-if="ootdStore.loadError" class="explore-empty" role="alert">{{ ootdStore.loadError }}</div>
    <div v-else class="ootd-grid">
      <template v-if="ootdStore.filteredPosts.length">
        <article
          v-for="(post, index) in ootdStore.filteredPosts"
          :key="post.id"
          class="ootd-card"
          :data-post-id="post.id"
          :style="{ animationDelay: `${index * 45}ms` }"
        >
          <header class="ootd-user-row">
            <span v-if="post.editorial" class="ootd-user"><span class="ootd-avatar">O.</span><span class="ootd-user-copy"><strong>{{ $t('OOTIE 編輯精選') }}</strong><small>{{ $t('品牌編輯') }}</small></span></span>
            <button v-else class="ootd-user" type="button" :aria-label="`查看 ${post.username} 的個人主頁`" @click="goToProfile(post.username)">
              <span class="ootd-avatar" aria-hidden="true">
                <img v-if="post.avatar_url" :src="post.avatar_url" alt="" loading="lazy" decoding="async" />
                <span v-else>{{ post.initials }}</span>
              </span>
              <span class="ootd-user-copy">
                <strong class="user-link-text">{{ post.display_name || post.username }}</strong>
                <span>{{ formatPostTime(post.created_at) }}<template v-if="postStyleLabel(post)"> · {{ postStyleLabel(post) }}</template></span>
              </span>
            </button>
            <button
              type="button"
              v-if="!post.editorial"
              :class="['follow-button', { following: isFollowing(post) }]"
              :aria-pressed="isFollowing(post)"
              :aria-label="`${isFollowing(post) ? '取消追蹤' : '追蹤'} ${post.username}`"
              :disabled="!canFollow(post) || socialStore.pendingProfileIds.includes(post.user_id)"
              @click="toggleFollow(post)"
            >
                {{ $t(isFollowing(post) ? '已追蹤' : '追蹤') }}
            </button>
          </header>

          <button class="ootd-photo-button" type="button" :aria-label="`查看 ${post.username} 的完整穿搭`" @click="openPostDetail(post.id)">
            <img
              class="ootd-photo"
              :src="post.image"
              :alt="`${post.username} 的全身穿搭`"
              :loading="index < 2 ? 'eager' : 'lazy'"
              decoding="async"
            />
          </button>

          <div class="ootd-body">
            <div class="ootd-actions" aria-label="貼文互動">
              <button
                :class="['ootd-action', { liked: post.liked }]"
                :aria-pressed="Boolean(post.liked)"
                :aria-label="`${post.liked ? '取消喜歡' : '喜歡'} ${post.username} 的穿搭`"
                :disabled="isInteractionPending(post.id, 'like')"
                @click="runPostAction(post.id, 'like', () => ootdStore.toggleLike(post.id))"
              >
                {{ $t(post.liked ? '已喜歡' : '喜歡') }} <span>{{ post.likes }}</span>
              </button>
              <button
                class="ootd-action"
                :aria-label="`查看 ${post.comments} 則留言`"
                @click="openPostDetail(post.id, { openComments: true })"
              > {{ $t("留言") }} <span>{{ post.comments }}</span>
              </button>
              <button
                :class="['ootd-action', { saved: post.saved }]"
                :aria-pressed="Boolean(post.saved)"
                :aria-label="`${post.saved ? '取消收藏' : $t('收藏')} ${post.username} 的穿搭`"
                :disabled="isInteractionPending(post.id, 'save')"
                @click="runPostAction(post.id, 'save', () => ootdStore.toggleSave(post.id))"
              >
                {{ $t(post.saved ? '已收藏' : '收藏') }} <span v-if="post.saves != null">{{ post.saves }}</span>
              </button>
              <button class="ootd-action" :aria-label="`分享 ${post.username} 的穿搭`" @click="ootdStore.sharePost(post.id)">{{ $t("分享") }}</button>
            </div>
            <div
              class="post-detail-trigger"
              role="button"
              tabindex="0"
              @click="openPostDetail(post.id)"
              @keydown.enter="openPostDetail(post.id)"
            >
              <p v-if="post.editorial" class="editorial-source">{{ $t('AI 輔助製作的品牌穿搭靈感') }}</p>
              <p class="ootd-caption">{{ $t(post.caption) }}</p>
              <div class="ootd-tags">{{ visiblePostTags(post.hashtags).join('　') }}</div>
            </div>
            <div v-if="post.tagged_items?.length" class="explore-tagged-items" aria-label="這套穿搭標註的衣櫥單品">
              <button
                v-for="item in post.tagged_items"
                :key="item.id"
                type="button" class="explore-tagged-piece" @click="openPostDetail(post.id)"
              ><img class="product-image" :src="item.photo" :alt="item.name_zh || item.name" loading="lazy" decoding="async" /><span>{{ item.name_zh || item.name }}</span></button>
            </div>
          </div>
        </article>
      </template>

      <div v-else class="explore-empty">
<AppIcon name="Explore" :size="36" /><h2>{{ $t(ootdStore.searchQuery ? '沒有符合條件的穿搭' : '讓你的穿搭，成為新的靈感。') }}</h2><p>{{ $t(ootdStore.searchQuery ? '換個關鍵字，再找找看。' : '分享自己的穿搭照片，和大家交流喜歡的風格。') }}</p><button class="primary" @click="startPost">{{ $t('分享我的穿搭') }}<AppIcon name="plus" :size="18" /></button>
      </div>
    </div>
  </section>
</template>

<script setup>
import AppIcon from '@/components/ui/AppIcon.vue';
import { onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAppStore } from '@/stores/app';
import { useAuthStore } from '@/stores/auth';
import { useOotdStore } from '@/stores/ootd';
import { useSocialStore } from '@/stores/social';
import { visiblePostTags } from '@/services/styleCrew';

const appStore = useAppStore();
const authStore = useAuthStore();
const ootdStore = useOotdStore();
const socialStore = useSocialStore();
const route = useRoute();
const router = useRouter();
const startPost = () => {if (!authStore.isMember) appStore.openLoginGate('OOTD_PUBLISH_AUTH_REQUIRED','/explore?quick=add-ootd'); else appStore.isOotdFormOpen = true;};
const pendingInteractions = ref(new Set());

const interactionKey = (postId, action) => `${postId}:${action}`;
const isInteractionPending = (postId, action) => pendingInteractions.value.has(interactionKey(postId, action));
const runPostAction = async (postId, action, callback) => {
  const key = interactionKey(postId, action);
  if (pendingInteractions.value.has(key)) return;
  pendingInteractions.value = new Set(pendingInteractions.value).add(key);
  try {
    await callback();
  } finally {
    const next = new Set(pendingInteractions.value);
    next.delete(key);
    pendingInteractions.value = next;
  }
};

const formatPostTime = (value) => {
  if (!value) return '近期分享';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '近期分享';
  const days = Math.round((date.getTime() - Date.now()) / 86400000);
  if (Math.abs(days) <= 7) return new Intl.RelativeTimeFormat('zh-TW', { numeric: 'auto' }).format(days, 'day');
  return date.toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' });
};

const postStyleLabel = (post) => {
  const tag = visiblePostTags(post?.hashtags).find((entry) => !/^#?ootd$/i.test(String(entry)));
  return tag ? String(tag).replace(/^#/, '') : '';
};

const openPostDetail = (postId, options = {}) => {
  const post = appStore.ootdPosts.find((item) => String(item.id) === String(postId));
  if (!post) return;
  router.push({
    name: 'OotdDetail',
    params: { id: post.id },
    query: {
      user: post.username,
      from: 'explore',
      ...(options.openComments ? { comment: '1' } : {})
    }
  });
};

const isFollowing = (post) => socialStore.isFollowing({ id: post.user_id, username: post.username });
const canFollow = (post) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(post?.user_id || ''))
  && post.user_id !== authStore.profileId;

const toggleFollow = (post) => socialStore.toggleFollow({
  id: post.user_id,
  username: post.username,
  display_name: post.display_name,
  initials: post.initials,
  avatar_url: post.avatar_url
});

const goToProfile = (username) => {
  router.push({ path: '/profile', query: { user: username } });
};

const checkDeepLink = () => {
  const postId = route.query.post;
  const commentId = route.query.comment;
  if (postId) {
    const post = appStore.ootdPosts.find((p) => String(p.id) === String(postId));
    if (post) {
      router.replace({path:`/ootd/${post.id}`,query:{from:'explore',...(commentId?{comment:'1'}:{})}});
    }
  }
};

onMounted(async () => {
  checkDeepLink();
  await ootdStore.loadRemotePosts();
  if (authStore.isMember && authStore.profileId) socialStore.refresh(authStore.profileId);
});

watch(
  () => route.query,
  () => {
    checkDeepLink();
  }
);

watch(
  () => authStore.profileId,
  async (profileId, previousProfileId) => {
    if (!profileId || profileId === previousProfileId) return;
    await Promise.all([ootdStore.loadRemotePosts(), socialStore.refresh(profileId)]);
  }
);
</script>
