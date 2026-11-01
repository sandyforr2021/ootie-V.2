<template>
  <section class="page active app-page sos-detail-page" id="sosDetailPage">
    <div class="sos-detail-page-header">
      <router-link :to="backRoute" class="back-link">{{ backLabel }}</router-link>
    </div>

    <div v-if="loading" class="sos-detail-loading" role="status">
      {{ $t("正在載入穿搭求救…") }}
    </div>

    <div v-else-if="!post" class="sos-detail-empty" role="alert">
      <p>{{ errorMessage || $t("找不到這則穿搭求救，可能已被刪除。") }}</p>
      <router-link to="/sos" class="primary return-btn">{{ $t("返回穿搭求救") }}</router-link>
    </div>

    <div v-else class="sos-detail-card">
      <SosDetailContent :post="post" :is-modal="false" @deleted="handleDeleted" />
    </div>
  </section>
</template>

<script setup>
import { computed, ref, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAppStore } from '@/stores/app';
import { useSosStore } from '@/stores/sos';
import { t } from '@/i18n';
import SosDetailContent from '@/components/sos/SosDetailContent.vue';

const route = useRoute();
const router = useRouter();
const appStore = useAppStore();
const sosStore = useSosStore();

const loading = ref(true);
const errorMessage = ref('');

const post = computed(() => {
  const id = route.params.id;
  if (!id) return null;
  return sosStore.sosPosts.find(p => String(p.id) === String(id)) || null;
});

const backRoute = computed(() => {
  if (route.query.from === 'saved') {
    return { path: '/profile/saved', query: { type: ['OOTD', 'SOS'].includes(route.query.type) ? route.query.type : undefined } };
  }
  if (route.query.from === 'help') {
    return '/profile/help-history';
  }
  return '/sos';
});

const backLabel = computed(() => {
  if (route.query.from === 'saved') return t('返回我的收藏');
  if (route.query.from === 'help') return t('返回幫助紀錄');
  return t('返回穿搭求救');
});

const handleDeleted = () => {
  router.replace('/sos');
};

const resolvePost = async () => {
  const postId = route.params.id;
  if (!postId) {
    loading.value = false;
    errorMessage.value = t('缺少貼文識別 ID。');
    return;
  }

  if (!post.value) {
    // If not loaded yet, wait for sosStore init
    loading.value = true;
    try {
      await sosStore.initFromSupabase();
    } catch {
      // ignore
    } finally {
      loading.value = false;
    }
  } else {
    loading.value = false;
  }
};

onMounted(() => {
  resolvePost();
});

watch(() => route.params.id, () => {
  resolvePost();
});
</script>

<style scoped>
.sos-detail-page {
  max-width: 820px;
  margin: 0 auto;
  padding: 24px 20px 80px;
}
.sos-detail-page-header {
  margin-bottom: 16px;
}
.sos-detail-card {
  background: var(--surface-raised, #fff);
  border: 1px solid var(--line, #ece7ea);
  border-radius: 20px;
  padding: 32px 28px;
  box-shadow: var(--shadow-sm, 0 4px 16px rgba(0, 0, 0, 0.03));
}
.sos-detail-loading,
.sos-detail-empty {
  padding: 60px 20px;
  text-align: center;
  color: var(--muted, #8e8890);
  background: var(--surface-raised, #fff);
  border: 1px solid var(--line, #ece7ea);
  border-radius: 20px;
}
.return-btn {
  display: inline-block;
  margin-top: 16px;
  text-decoration: none;
}
@media (max-width: 600px) {
  .sos-detail-page {
    padding: 16px 14px 60px;
  }
  .sos-detail-card {
    padding: 20px 16px;
    border-radius: 16px;
  }
}
</style>
