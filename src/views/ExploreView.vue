<template>
  <section class="page active app-page" id="explorePage">
    <header class="explore-hero ootie-page-heading">
      <div>
        <h1>{{ $t("探索") }}</h1>
      </div>

    </header>

    <div class="explore-toolbar">
      <label class="explore-search">
        <span>⌕</span>
        <input
          v-model="ootdStore.searchQuery"
          type="search"
          :placeholder="$t('搜尋（帳號、關鍵字、服飾……等）', 'Search accounts, keywords, clothing…')"
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

    <section v-if="people.length" class="people-results" :aria-label="$t('衣友', 'People')"><article v-for="person in people" :key="person.id"><button @click="goToProfile(person.username)"><img v-if="person.avatar_url" :src="person.avatar_url" alt="" /><strong>{{ person.display_name || person.username }}</strong><span>@{{ person.username }}</span></button><button :disabled="!canFollow(person) || socialStore.pendingProfileIds.includes(person.id)" @click="toggleFollow(person)">{{ $t(isFollowing(person)?'已追蹤':'追蹤') }}</button></article></section>
    <p v-if="peopleError" role="alert">{{ peopleError }}</p>
    <div v-if="ootdStore.loading" class="explore-empty" role="status" aria-live="polite">{{ $t("正在載入穿搭動態…") }}</div>
    <div v-else-if="ootdStore.loadError" class="explore-empty" role="alert">{{ ootdStore.loadError }}</div>
    <div v-else class="ootd-grid">
      <template v-if="ootdStore.filteredPosts.length">
        <OotdFeedCard v-for="post in ootdStore.filteredPosts" :key="post.id" :post="post" :own="post.user_id===authStore.profileId" :following="isFollowing(post)" :can-follow="canFollow(post)" :follow-pending="socialStore.pendingProfileIds.includes(post.user_id)" :like-pending="isInteractionPending(post.id,'like')" :save-pending="isInteractionPending(post.id,'save')" @profile="goToProfile(post.username)" @follow="toggleFollow(post)" @open="openPostDetail(post.id)" @comments="openPostDetail(post.id,{openComments:true})" @like="runPostAction(post.id,'like',()=>ootdStore.toggleLike(post.id))" @save="runPostAction(post.id,'save',()=>ootdStore.toggleSave(post.id))" @share="ootdStore.sharePost(post.id)" @edit="editOwnPost(post.id)" @delete="deleteOwnPost(post.id)"/>
      </template>

      <div v-else-if="ootdStore.activeFeedTab === 'following'" class="explore-empty"><h2>{{ $t('還沒有追蹤動態', 'No posts from people you follow yet') }}</h2><button class="primary" @click="ootdStore.activeFeedTab='for-you'">{{ $t('探索衣友', 'Discover people') }}</button></div>
      <div v-else class="explore-empty">
<AppIcon name="Explore" :size="36" /><h2>{{ $t(ootdStore.searchQuery ? '沒有符合條件的穿搭' : '讓你的穿搭，成為新的靈感。') }}</h2><p>{{ $t(ootdStore.searchQuery ? '換個關鍵字，再找找看。' : '分享自己的穿搭照片，和大家交流喜歡的風格。') }}</p><button class="primary" @click="startPost">{{ $t('分享我的穿搭') }}<AppIcon name="plus" :size="18" /></button>
      </div>
    </div>
    <button v-if="ootdStore.hasMore" class="secondary feed-load-more" :disabled="ootdStore.loading||ootdStore.loadingMore" @click="ootdStore.loadMorePosts()">{{ $t(ootdStore.loadingMore?'載入中…':'載入更多') }}</button>
  </section>
</template>

<script setup>
import OotdFeedCard from '@/components/ootd/OotdFeedCard.vue';
import {searchProfiles} from '@/services/profileSearch';
import AppIcon from '@/components/ui/AppIcon.vue';
import { onMounted, onBeforeUnmount, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAppStore } from '@/stores/app';
import { useAuthStore } from '@/stores/auth';
import { useOotdStore } from '@/stores/ootd';
import { useSocialStore } from '@/stores/social';
import { visiblePostTags } from '@/services/styleCrew';
import {t} from '@/i18n';

const appStore = useAppStore();
const authStore = useAuthStore();
const ootdStore = useOotdStore();
const socialStore = useSocialStore();
const route = useRoute();
const router = useRouter();
const editOwnPost=id=>{ootdStore.editingPostId=id;appStore.isOotdFormOpen=true;};
const deleteOwnPost=async id=>{if(confirm(t('確定要刪除這則 OOTD 嗎？刪除後無法恢復。')))await ootdStore.deletePost(id);};
const startPost = () => {if (!authStore.isMember) appStore.openLoginGate('OOTD_PUBLISH_AUTH_REQUIRED','/explore?quick=add-ootd'); else appStore.isOotdFormOpen = true;};
const people=ref([]), peopleError=ref('');
let searchTimer, searchVersion=0,feedTimer;
const refreshFeed=()=>ootdStore.loadRemotePosts({search:ootdStore.searchQuery,authorIds:ootdStore.activeFeedTab==='following'?socialStore.followingProfiles.map(row=>row.following_id):undefined});
watch(()=>[ootdStore.activeFeedTab,ootdStore.searchQuery,socialStore.followingProfiles.map(row=>row.following_id).join(',')],()=>{clearTimeout(feedTimer);feedTimer=setTimeout(refreshFeed,250);});
watch(()=>ootdStore.searchQuery,(query)=>{
 const version=++searchVersion; clearTimeout(searchTimer);people.value=[];peopleError.value='';
 if(!query.trim())return;
 searchTimer=setTimeout(async()=>{try{const rows=await searchProfiles(query);if(version===searchVersion)people.value=rows;}catch{if(version===searchVersion)peopleError.value='Search is unavailable. Please retry.';}},250);
});
onBeforeUnmount(()=>{clearTimeout(searchTimer);clearTimeout(feedTimer);searchVersion++;});
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
  await refreshFeed();
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

<style scoped>.people-results{display:grid;gap:10px;margin:20px 0}.people-results article{display:flex;justify-content:space-between;gap:12px;padding:12px;border:1px solid var(--line);border-radius:12px}.people-results button{display:flex;align-items:center;gap:10px}.people-results img{width:40px;height:40px;border-radius:50%;object-fit:cover}</style>

<style scoped>.community-destinations{display:flex;flex-wrap:wrap;gap:20px;margin-bottom:20px}.community-destinations a{padding:10px 0}</style>

<style scoped>.feed-load-more{display:block;margin:28px auto;min-height:44px}</style>
