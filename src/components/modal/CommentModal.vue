<template>
  <div v-if="appStore.isCommentOpen && targetPost" class="modal-backdrop open" @click.self="close">
    <section v-accessible-modal class="modal comment-modal">
      <button class="modal-close" :aria-label="$t(&quot;關閉&quot;)" @click="close">×</button>
      <h2>{{ $t("留言") }}</h2>

      <div class="comment-list">
        <p v-if="ootdStore.commentsLoading" role="status">{{ $t('正在載入留言…') }}</p>
        <p v-else-if="ootdStore.commentsError" role="alert">{{ ootdStore.commentsError }} <button @click="ootdStore.loadComments(targetPost.id)">{{ $t('重試') }}</button></p>
        <template v-if="targetPost.commentList.length">
          <div
            v-for="(comment, index) in targetPost.commentList"
            :key="index"
            class="comment-item"
          >
            <router-link
              v-if="getCommentProfileRoute(comment)"
              :to="getCommentProfileRoute(comment)"
              class="comment-author"
              :aria-label="`查看 ${getCommentUsername(comment)} 的個人主頁`"
            >
              <span class="comment-avatar" aria-hidden="true"><img v-if="comment.avatar_url" :src="comment.avatar_url" alt="" /><span v-else>{{ getCommentInitials(comment) }}</span></span>
              <strong>{{ comment.display_name || getCommentUsername(comment) }}</strong>
            </router-link>
            <strong v-else>{{ getCommentUsername(comment) }}</strong>
            <TranslatedText :content-id="comment.id" kind="comment" :text="comment.text" :source-language="comment.body_language" />
          </div>
        </template>
        <p v-else-if="!ootdStore.commentsLoading && !ootdStore.commentsError" class="notification-time">{{ $t('還沒有留言，成為第一個留言的人吧。') }}</p>
      </div>

      <form class="comment-form" @submit.prevent="handleSubmit">
        <input
          v-model="commentText"
          required
          maxlength="2000"
          :disabled="sending"
          :aria-label="$t('寫下你的想法')"
          :placeholder="$t('寫下你的想法')"
        />
        <button class="primary" type="submit" :disabled="sending || !commentText.trim()">{{ $t(sending ? '傳送中…' : '送出') }}</button>
      </form>
    </section>
  </div>
</template>

<script setup>
import TranslatedText from '@/components/ootd/TranslatedText.vue';
import { ref, computed, watch } from 'vue';
import { useAppStore } from '@/stores/app';
import { useOotdStore } from '@/stores/ootd';

const appStore = useAppStore();
const ootdStore = useOotdStore();

const commentText = ref('');
const sending = ref(false);
let draftId = crypto.randomUUID();
watch(commentText, () => { if (!sending.value) draftId = crypto.randomUUID(); });

const targetPost = computed(() => {
  return appStore.ootdPosts.find((p) => p.id === appStore.activeCommentPostId);
});

const getCommentUsername = (comment) => comment.user || comment.username || '';

const getCommentInitials = (comment) => {
  const username = getCommentUsername(comment).replace('@', '');
  return username.slice(0, 2).toUpperCase() || '衣友';
};

const getCommentProfileRoute = (comment) => {
  const username = getCommentUsername(comment);
  if (!username) return null;
  return { path: '/profile', query: { user: appStore.normalizeUsername(username) } };
};

watch(
  () => [appStore.isCommentOpen, appStore.activeCommentPostId],
  ([open]) => {
    if (!open) return;
    commentText.value = '';
    void ootdStore.loadComments(appStore.activeCommentPostId);
  }, {immediate:true}
);

const close = () => {
  appStore.isCommentOpen = false;
};

const handleSubmit = async () => {
  if (sending.value || !commentText.value.trim() || !targetPost.value) return;
  sending.value = true;
  try { if (await ootdStore.addComment(targetPost.value.id, commentText.value, draftId)) commentText.value = ''; }
  finally { sending.value = false; }
};
</script>
