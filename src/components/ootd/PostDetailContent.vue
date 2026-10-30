<template>
  <article class="ootd-card detail-card post-detail-card" :aria-busy="pendingInteractions.size > 0">
    <header class="post-detail-author">
      <router-link
        v-if="authorProfileRoute && !post.editorial"
        :to="authorProfileRoute"
        class="post-detail-author-link"
        :aria-label="`查看 ${authorUsername} 的個人主頁`"
      >
        <span class="ootd-avatar" aria-hidden="true">
          <MediaImage v-if="post.avatar_url" :src="post.avatar_url" alt="" loading="eager" decoding="async" />
          <span v-else>{{ authorInitials }}</span>
        </span>
        <span class="post-detail-author-copy">
          <strong>{{ post.display_name || authorUsername }}</strong>
          <small>{{ formattedDate || 'OOTD 分享' }}</small>
        </span>
      </router-link>
      <span v-else class="post-detail-author-link is-disabled">
        <span class="ootd-avatar" aria-hidden="true">
          <MediaImage v-if="post.avatar_url" :src="post.avatar_url" alt="" loading="eager" decoding="async" />
          <span v-else>{{ authorInitials }}</span>
        </span>
        <span class="post-detail-author-copy">
          <strong>{{ post.editorial ? $t('OOTIE 編輯精選') : authorUsername || $t('未提供作者') }}</strong>
          <small>{{ formattedDate || 'OOTD 分享' }}</small>
        </span>
      </span>

      <button
        v-if="authorUsername && !isSelfAuthor && !post.editorial"
        type="button"
        :class="['follow-button', { following: isFollowingAuthor }]"
        :aria-pressed="isFollowingAuthor"
        :aria-label="`${isFollowingAuthor ? '取消追蹤' : '追蹤'} ${authorUsername}`"
        :disabled="!canFollowAuthor || socialStore.pendingProfileIds.includes(post.user_id)"
        @click="toggleFollow"
      >
        {{ $t(isFollowingAuthor ? '已追蹤' : '追蹤') }}
      </button>
    </header>

    <div class="ootd-detail-image-frame">
      <MediaImage
        full class="ootd-photo ootd-detail-image"
        :src="post.image"
        :alt="`${authorUsername || '作者'} 的完整 OOTD 穿搭`"
        loading="eager"
        decoding="async"
        fetchpriority="high"
      />
    </div>

    <div class="post-detail-primary-actions" aria-label="貼文互動">
      <button
        type="button"
        :class="['ootd-action', { liked: post.liked }]"
        :aria-pressed="Boolean(post.liked)"
        :disabled="isInteractionPending('like')"
        :aria-label="post.liked ? '取消喜歡這套穿搭' : '喜歡這套穿搭'"
        @click="runPostAction('like', () => ootdStore.toggleLike(post.id))"
      >
        <AppIcon name="heart" :fill="post.liked ? 'currentColor' : 'none'" /> <span>{{ post.likes || 0 }}</span>
      </button>
      <button type="button" class="ootd-action" :aria-label="`查看 ${post.comments || 0} 則留言`" @click="openComments"><AppIcon name="comment" /><span>{{ post.comments || 0 }}</span></button>
      <button
        type="button"
        :class="['ootd-action', { saved: post.saved }]"
        :aria-pressed="Boolean(post.saved)"
        :disabled="isInteractionPending('save')"
        :aria-label="post.saved ? '取消收藏這套穿搭' : '收藏這套穿搭'"
        @click="runPostAction('save', () => ootdStore.toggleSave(post.id))"
      >
        <AppIcon name="bookmark" :fill="post.saved ? 'currentColor' : 'none'" /> <span v-if="post.saves != null">{{ post.saves }}</span>
      </button>
      <button type="button" class="ootd-action" aria-label="分享這套穿搭" @click="sharePost"><AppIcon name="share" /></button>

    </div>

    <div class="ootd-body">
      <p v-if="post.editorial" class="editorial-source">{{ $t('AI 輔助製作的品牌穿搭靈感') }}</p>
      <TranslatedText :content-id="post.id" :text="post.caption" :source-language="post.caption_language" />
      <div v-if="post.hashtags && post.hashtags.length" class="ootd-tags">
        {{ visiblePostTags(post.hashtags).join('　') }}
      </div>

      <section v-if="taggedItems.length" class="ootd-tagged-section" aria-label="本套使用單品">
        <div class="ootd-tagged-heading">
          <h3>{{ $t('本套使用單品') }}</h3>
          <span>{{ taggedItems.length }}{{ $t("件") }}</span>
        </div>
        <div class="ootd-tagged-items">
          <article v-for="item in taggedItems" :key="item.key" :class="['ootd-tagged-item', { removed: item.removed }]">
            <MediaImage v-if="item.photo" class="product-image" :src="item.photo" :alt="item.name" loading="lazy" decoding="async" />
            <span class="ootd-tagged-copy">
              <strong>{{ item.name }}</strong>
              <small v-if="item.brand || item.category || item.primary_color">
                {{ [item.brand, categoryLabel(item.category), item.primary_color].filter(Boolean).join(' · ') }}
              </small>
            </span>
          </article>
        </div>
      </section>
      <p v-else-if="!post.editorial" class="ootd-items">{{ $t('尚未標註衣櫥單品') }}</p>
      <p v-if="post.editorial" class="editorial-source">{{ $t('品牌穿搭圖不代表真實會員或本人試穿結果。') }}</p>
      <router-link v-if="post.editorial" class="primary" to="/closet">{{ $t('從自己的衣櫥搭出相似風格') }}</router-link>

      <div class="ootd-actions post-detail-secondary-actions">
        <router-link v-if="authorProfileRoute && !post.editorial" :to="authorProfileRoute" class="secondary">
          查看個人主頁
        </router-link>
        <button v-if="isSelfAuthor && !post.editorial" type="button" class="secondary ootd-delete-action" @click="deletePost">刪除</button>
      </div>
      <PostComments ref="commentsSection" :post="post" />
    </div>
  </article>
</template>

<script setup>
import MediaImage from '@/components/ui/MediaImage.vue';
import TranslatedText from '@/components/ootd/TranslatedText.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import { computed, ref } from 'vue';
import { useAppStore } from '@/stores/app';
import { useOotdStore } from '@/stores/ootd';
import { useAuthStore } from '@/stores/auth';
import { useSocialStore } from '@/stores/social';
import { resolvePostTaggedItems } from '@/services/ootdTaggedItems';
import { labels } from '@/constants';
import PostComments from './PostComments.vue';
import { visiblePostTags } from '@/services/styleCrew';

const emit = defineEmits(['deleted']);

const props = defineProps({
  post: {
    type: Object,
    required: true
  },
  authorProfileRoute: {
    type: Object,
    default: null
  }
});

const appStore = useAppStore();
const ootdStore = useOotdStore();
const authStore = useAuthStore();
const socialStore = useSocialStore();
const pendingInteractions = ref(new Set());
const commentsSection = ref(null);

const authorUsername = computed(() => {
  return props.post.username ? appStore.normalizeUsername(props.post.username) : '';
});

const authorInitials = computed(() => {
  if (props.post.initials) return props.post.initials;
  return authorUsername.value.replace('@', '').slice(0, 2).toUpperCase() || '衣友';
});

const isSelfAuthor = computed(() => {
  if (props.post.user_id && authStore.profileId) return props.post.user_id === authStore.profileId;
  return authStore.isMember && authorUsername.value === appStore.normalizeUsername(appStore.profile.username);
});

const taggedItems = computed(() => {
  return resolvePostTaggedItems(props.post, [...(props.post.tagged_items || []), ...appStore.items]);
});

const isFollowingAuthor = computed(() => {
  return socialStore.isFollowing({ id: props.post.user_id, username: authorUsername.value });
});

const canFollowAuthor = computed(() => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(props.post.user_id || '')));

const toggleFollow = () => {
  socialStore.toggleFollow({
    id: props.post.user_id,
    username: authorUsername.value,
    display_name: props.post.display_name,
    initials: props.post.initials,
    avatar_url: props.post.avatar_url
  });
};

const isInteractionPending = (action) => pendingInteractions.value.has(action);
const runPostAction = async (action, callback) => {
  if (pendingInteractions.value.has(action)) return;
  pendingInteractions.value = new Set(pendingInteractions.value).add(action);
  try {
    await callback();
  } finally {
    const next = new Set(pendingInteractions.value);
    next.delete(action);
    pendingInteractions.value = next;
  }
};

const openComments = () => {
  commentsSection.value?.focusComposer();
};

const sharePost = () => {
  ootdStore.sharePost(props.post.id);
};

const deletePost = async () => {
  if (!isSelfAuthor.value) return;
  if (!window.confirm('確定要刪除這則 OOTD 嗎？\n刪除後無法恢復。')) return;
  if (await ootdStore.deletePost(props.post.id)) emit('deleted', props.post.id);
};

const categoryLabel = (category) => labels[category] || category || '';

const formattedDate = computed(() => {
  const value = props.post.created_at || props.post.createdAt;
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('zh-TW');
});
</script>
