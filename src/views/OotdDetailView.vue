<template>
  <section class="page active" id="sharedOotdPage">
    <div class="shared-ootd-header">
      <router-link :to="backRoute" class="text-link">{{ backLabel }}</router-link>
    </div>

    <div v-if="loading" class="profile-ootd-empty">
      正在載入這篇 OOTD...
    </div>

    <div v-else-if="!post" class="profile-ootd-empty">
      {{ errorMessage || '找不到這篇 OOTD。' }}
    </div>

    <PostDetailContent
      v-else
      :post="post"
      :author-profile-route="authorProfileRoute"
      @deleted="handleDeleted"
    />
  </section>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAppStore } from '@/stores/app';
import { useOotdStore } from '@/stores/ootd';
import { supabase } from '@/services/supabase';
import { getPublicItemsByIds } from '@/services/clothingRepository';
import { withDevelopmentDemoMediaRevision } from '@/services/mediaUrl';
import PostDetailContent from '@/components/ootd/PostDetailContent.vue';
import { updatePublicContentMeta } from '@/services/documentMeta';

const route = useRoute();
const router = useRouter();
const appStore = useAppStore();
const ootdStore = useOotdStore();

const post = ref(null);
const loading = ref(true);
const errorMessage = ref('');

const authorUsername = computed(() => {
  const raw = post.value?.username || route.query.user;
  return raw ? appStore.normalizeUsername(raw) : '';
});

const authorProfileRoute = computed(() => {
  if (!authorUsername.value) return null;
  return { path: '/profile', query: { user: authorUsername.value } };
});

const backRoute = computed(() => {
  if (route.query.from === 'explore') return { path: '/explore' };
  return authorProfileRoute.value || { path: '/explore' };
});

const backLabel = computed(() => {
  return route.query.from === 'explore' ? '← 返回探索' : '← 返回個人檔案';
});

const handleDeleted = () => router.replace(backRoute.value);

const isUuid = (value) =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

const hydrateTaggedItems = async (sourcePost) => {
  const itemIds = Array.isArray(sourcePost?.item_ids) ? [...new Set(sourcePost.item_ids.map(String))] : [];
  if (!itemIds.length || sourcePost?.tagged_items?.length) return sourcePost;
  try {
    const taggedItems = await getPublicItemsByIds(itemIds);
    return { ...sourcePost, tagged_items: taggedItems };
  } catch (_) {
    return sourcePost;
  }
};

const openRequestedComments = () => {
  if (!route.query.comment || !post.value) return;
  appStore.activeCommentPostId = post.value.id;
  appStore.isCommentOpen = true;
};

const updateShareMeta = () => {
  if (!post.value) return;
  const author = authorUsername.value || '@OOTIE';
  updatePublicContentMeta({
    title: `${author} 的 OOTD｜OOTIE`,
    description: String(post.value.caption || '看看這套 OOTIE 穿搭').slice(0, 160),
    image: post.value.image,
    url: `${window.location.origin}/ootd/${post.value.id}`
  });
};

const loadPost = async () => {
  const postId = route.params.id;
  if (!postId) {
    loading.value = false;
    errorMessage.value = '缺少貼文識別 ID。';
    return;
  }

  let localPost = appStore.ootdPosts.find((p) => String(p.id) === String(postId));
  if (!localPost && isUuid(String(postId))) {
    await ootdStore.loadRemotePosts();
    localPost = appStore.ootdPosts.find((p) => String(p.id) === String(postId));
  }
  if (localPost) {
    post.value = localPost;
    loading.value = false;
    post.value = await hydrateTaggedItems(localPost);
    updateShareMeta();
    openRequestedComments();
    return;
  }

  try {
    const { data, error } = await supabase
      .from('ootie_ootd_posts')
      .select('*')
      .eq('id', postId)
      .maybeSingle();

    if (error || !data) {
      errorMessage.value = '找不到這篇 OOTD，或目前沒有讀取權限。';
    } else {
      let authorProfile = null;
      if (isUuid(data.user_id)) {
        const { data: profileData } = await supabase
          .from('ootie_profiles')
          .select('username,display_name,initials,avatar_url')
          .eq('id', data.user_id)
          .maybeSingle();
        authorProfile = profileData;
      }

      post.value = await hydrateTaggedItems({
        id: String(data.id),
        user_id: data.user_id,
        username: authorProfile?.username || route.query.user || '',
        display_name: authorProfile?.display_name || '',
        initials: authorProfile?.initials || (authorProfile?.username
          ? appStore.normalizeUsername(authorProfile.username).replace('@', '').slice(0, 2).toUpperCase()
          : ''),
        avatar_url: authorProfile?.avatar_url || '',
        image: withDevelopmentDemoMediaRevision(data.image),
        image_storage_path: data.image_storage_path || '',
        caption: data.caption,
        wearing: Array.isArray(data.wearing) ? data.wearing : [],
        item_ids: Array.isArray(data.item_ids) ? data.item_ids : [],
        hashtags: Array.isArray(data.hashtags) ? data.hashtags : [],
        likes: data.likes || 0,
        comments: data.comments || 0,
        liked: false,
        saved: false,
        commentList: [],
        created_at: data.created_at
      });
      updateShareMeta();
      openRequestedComments();
    }
  } catch (err) {
    errorMessage.value = '讀取 OOTD 失敗。';
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  loadPost();
});
</script>

<style scoped>
.shared-ootd-header {
  margin-bottom: 20px;
}
</style>
