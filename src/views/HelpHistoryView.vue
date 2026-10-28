<template>
  <section class="page active help-history-page">
    <router-link to="/profile" class="back-link">← 返回個人檔案</router-link>

    <h1>幫助紀錄</h1>
    <div class="help-history-tabs" role="tablist" aria-label="幫助紀錄期間">
      <button :class="{ active: days === 7 }" type="button" @click="load(7)">最近 7 天</button>
      <button :class="{ active: days === 30 }" type="button" @click="load(30)">最近 30 天</button>
    </div>
    <p v-if="loading" class="help-history-state">正在載入幫助紀錄…</p>
    <p v-else-if="errorMessage" class="help-history-state is-error">{{ errorMessage }}</p>
    <div v-else-if="records.length" class="help-history-list">
      <article v-for="record in records" :key="record.id" class="help-history-card">

        <h2>{{ record.ootie_sos_posts?.title || $t('穿搭求救') }}</h2>
        <p>{{ record.message }}</p>
        <small>{{ formatDate(record.created_at) }}</small>
      </article>
    </div>
    <div v-else class="help-history-state">最近 {{ days }} 天還沒有幫衣友搭配。</div>
  </section>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { loadHelpHistory } from '@/services/socialMetrics';

const authStore = useAuthStore();
const days = ref(7);
const records = ref([]);
const loading = ref(false);
const errorMessage = ref('');

const load = async (nextDays = days.value) => {
  days.value = nextDays;
  if (!authStore.isMember || !authStore.profileId) {
    errorMessage.value = '請先登入後查看幫助紀錄。';
    return;
  }
  loading.value = true;
  errorMessage.value = '';
  try {
    records.value = await loadHelpHistory(authStore.profileId, days.value);
  } catch (error) {
    errorMessage.value = error?.userMessage || '幫助紀錄暫時無法取得。';
  } finally {
    loading.value = false;
  }
};

const formatDate = (value) => new Date(value).toLocaleDateString('zh-TW');
onMounted(load);
</script>

<style scoped>
.help-history-page { animation:rise .45s both; }.help-history-tabs{display:flex;gap:8px;margin:16px 0}.help-history-tabs button{border:1px solid var(--line);background:var(--white);border-radius:999px;padding:8px 14px;cursor:pointer}.help-history-tabs button.active{background:var(--ink);color:#fff}.help-history-list{display:grid;gap:12px}.help-history-card,.help-history-state{border:1px solid var(--line);background:var(--white);border-radius:14px;padding:16px}.help-history-card h2{font-size:16px;margin:6px 0}.help-history-card p{color:var(--muted)}.help-history-state{text-align:center;color:var(--muted)}.is-error{border-color:#c77771}
</style>
