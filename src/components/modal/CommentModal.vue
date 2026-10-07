<template>
  <div v-if="appStore.isCommentOpen && targetPost" class="modal-backdrop open" @click.self="close">
    <section v-accessible-modal class="modal comment-modal">
      <button class="modal-close" aria-label="關閉" @click="close">×</button>
      <p class="eyebrow">OOTD Community</p>
      <h2>留言</h2>

      <div class="comment-list">
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
              <span class="comment-avatar" aria-hidden="true">{{ getCommentInitials(comment) }}</span>
              <strong>{{ getCommentUsername(comment) }}</strong>
            </router-link>
            <strong v-else>{{ getCommentUsername(comment) }}</strong>
            {{ comment.text }}
          </div>
        </template>
        <p v-else class="notification-time">還沒有留言，成為第一個留言的人吧。</p>
      </div>

      <form class="comment-form" @submit.prevent="handleSubmit">
        <input
          v-model="commentText"
          required
          placeholder="寫下你的想法"
        />
        <button class="primary" type="submit">送出</button>
      </form>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useAppStore } from '@/stores/app';
import { useOotdStore } from '@/stores/ootd';

const appStore = useAppStore();
const ootdStore = useOotdStore();

const commentText = ref('');

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
  () => appStore.isCommentOpen,
  (open) => {
    if (!open) return;
    commentText.value = '';
  }
);

const close = () => {
  appStore.isCommentOpen = false;
};

const handleSubmit = () => {
  if (!commentText.value.trim() || !targetPost.value) return;
  ootdStore.addComment(targetPost.value.id, commentText.value);
  commentText.value = '';
};
</script>
