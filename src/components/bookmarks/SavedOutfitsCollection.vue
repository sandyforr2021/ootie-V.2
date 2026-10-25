<template>
  <section class="page active saved-outfits-page" :class="{'studio-collection':embedded}">
    <header class="core-page-hero saved-outfits-page-hero">
      <div>
                <h2>{{ $t('收藏靈感') }}</h2>
        <p class="intro">{{ $t('收藏的穿搭與衣友求救，隨時回來找靈感。') }}</p>
      </div>

    </header>

    <p v-if="loading" class="saved-outfits-state">{{ $t('正在載入收藏穿搭…') }}</p>
    <div v-else-if="errorMessage" class="saved-outfits-state is-error">
      <p>{{ errorMessage }}</p>
      <p class="saved-outfits-hint">{{ $t("收藏喜歡的穿搭，隨時回來找靈感。") }}</p>
    </div>
    <div v-else-if="entries.length" class="saved-outfits-grid">
      <article v-for="entry in entries" :key="entry.key" class="saved-outfit-card">
        <p class="eyebrow">{{ entry.target_type === 'SOS' ? $t('衣友求救') : 'OOTD' }}</p>
        <template v-if="entry.target">
          <img v-if="entry.target.image" class="saved-outfit-image" :src="entry.target.image" :alt="entry.title" />
          <h2>{{ entry.title }}</h2>
          <p>{{ entry.subtitle }}</p>
          <button type="button" class="secondary" @click="openEntry(entry)">{{ $t('查看內容') }}</button>
        </template>
        <template v-else>
          <h2>{{ $t('此內容已不存在') }}</h2>
          <p>{{ $t('原始貼文或求救已無法取得。') }}</p>
        </template>
        <button type="button" class="text-button" @click="removeEntry(entry)">{{ $t('移除收藏') }}</button>
      </article>
    </div>
    <div v-else class="saved-outfits-state">
      <h2>{{ $t('還沒有收藏的穿搭') }}</h2>
      <p>{{ $t('在探索或衣友求救板按下收藏，就會顯示在這裡。') }}</p>
    </div>
  </section>
</template>

<script setup>
defineProps({embedded:{type:Boolean,default:false}});
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAppStore } from '@/stores/app';
import { useAuthStore } from '@/stores/auth';
import { useOotdStore } from '@/stores/ootd';
import { useSosStore } from '@/stores/sos';
import { deleteSavedOutfit, listSavedOutfits } from '@/services/socialMetrics';

const appStore = useAppStore();
const authStore = useAuthStore();
const ootdStore = useOotdStore();
useSosStore(); // Hydrates public SOS targets used by saved entries.
const router = useRouter();
const remoteEntries = ref([]);
const loading = ref(false);
const errorMessage = ref('');

const findTarget = (entry) => entry.target_type === 'OOTD'
  ? appStore.ootdPosts.find((post) => String(post.id) === String(entry.target_id))
  : appStore.sosPosts.find((post) => String(post.id) === String(entry.target_id));

const entries = computed(() => {
  const source = authStore.isMember
    ? remoteEntries.value
    : [
      ...appStore.ootdPosts.filter((post) => post.saved).map((post) => ({ target_type: 'OOTD', target_id: post.id })),
      ...appStore.sosPosts.filter((post) => post.saved).map((post) => ({ target_type: 'SOS', target_id: post.id }))
    ];
  return source.map((entry) => {
    const target = findTarget(entry);
    return {
      ...entry,
      key: entry.id || `${entry.target_type}-${entry.target_id}`,
      target,
      title: entry.target_type === 'OOTD' ? target?.caption || 'OOTD' : target?.title || '衣友求救',
      subtitle: entry.target_type === 'OOTD' ? target?.username || '' : target?.details || target?.username || ''
    };
  });
});

const load = async () => {
  if (!authStore.isMember || !authStore.profileId) return;
  loading.value = true;
  errorMessage.value = '';
  try {
    remoteEntries.value = await listSavedOutfits(authStore.profileId);
  } catch (error) {
    errorMessage.value = error?.userMessage || '收藏資料暫時無法取得。';
  } finally {
    loading.value = false;
  }
};

const removeEntry = async (entry) => {
  if (authStore.isMember && authStore.profileId) {
    try {
      await deleteSavedOutfit(authStore.profileId, entry);
      remoteEntries.value = remoteEntries.value.filter((item) => item.id !== entry.id);
    } catch (error) {
      appStore.showToast(error?.userMessage || '無法移除收藏。', { type: 'error', syncStatus: 'REMOTE_FAILED' });
    }
    return;
  }
  const target = findTarget(entry);
  if (target) target.saved = false;
};

const openEntry = (entry) => {
  if (entry.target_type === 'OOTD') {
    router.push({ path: `/ootd/${entry.target_id}`, query: { user: entry.target?.username, from: 'shop' } });
  } else {
    appStore.activeSosDetailId = entry.target_id;
    appStore.isSosDetailOpen = true;
    router.push('/sos');
  }
};

onMounted(async () => {
  await ootdStore.loadRemotePosts();
});

watch(() => authStore.profileId, (profileId) => {
  if (profileId) load();
}, { immediate: true });
</script>

<style scoped>
.studio-collection{padding:0}.studio-collection .core-page-hero{padding:0 0 24px;background:transparent}.studio-collection .core-page-note{display:none}
.saved-outfits-page { max-width:1180px; margin:0 auto; padding-bottom:72px; }
.saved-outfits-page-hero { background:radial-gradient(circle at 82% 18%, rgba(247,221,105,.62) 0 8%, transparent 9%),linear-gradient(128deg,var(--accent-pink-soft),#fff 52%,var(--accent-blue-soft)); }
.saved-outfits-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:20px; }
.saved-outfit-card,.saved-outfits-state { background:var(--white); border:1px solid var(--line); border-radius:var(--radius-card); padding:20px; box-shadow:var(--shadow-soft); }
.saved-outfit-card { overflow:hidden; transition:transform var(--motion-standard) var(--ease-out),box-shadow var(--motion-standard) ease; }
.saved-outfit-card:hover { transform:translateY(-3px); box-shadow:var(--shadow-hover); }
.saved-outfit-card h2 { font-size:17px; line-height:1.4; margin:8px 0; }
.saved-outfit-card p { color:var(--muted); line-height:1.5; }
.saved-outfit-image { width:100%; aspect-ratio:4/5; object-fit:contain; object-position:center; border-radius:16px; background:linear-gradient(145deg,var(--paper),#eeeae3); margin-bottom:10px; }
.saved-outfits-state { min-height:190px; display:grid; place-content:center; text-align:center; color:var(--muted); }
.saved-outfits-state.is-error { border-color:#c77771; background:var(--accent-pink-soft); }
.saved-outfits-hint { font-size:13px; }
.text-button { min-height:44px; margin-top:10px; color:var(--accent-violet-ink); background:none; border:0; padding:8px 0; cursor:pointer; }
@media (max-width:760px) { .saved-outfits-page { padding-bottom:36px; }.saved-outfits-grid { grid-template-columns:1fr; gap:14px; } }
</style>
