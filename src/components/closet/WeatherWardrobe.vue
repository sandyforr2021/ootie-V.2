<script setup>
import { computed, ref, onMounted, onBeforeUnmount, watch } from 'vue';
import { useWeatherStore } from '@/stores/weather';
import { useAppStore } from '@/stores/app';
import { t } from '@/i18n';
import AppIcon from '@/components/ui/AppIcon.vue';
import OutfitBoard from './OutfitBoard.vue';
import { useAuthStore } from '@/stores/auth';
import { fetchProfileOotdPosts } from '@/services/supabase';
import { outfitDate, outfitOccasions, recommendDailyOutfit } from '@/services/dailyOutfit';
const weather = useWeatherStore();
const app = useAppStore();
const auth = useAuthStore();
const occasion = ref('everyday'), now = ref(Date.now()), recentPosts = ref([]), historyError = ref(false);
const today = computed(() => outfitDate(now.value, weather.current?.timezone));
let historyVersion = 0, clockTimer;
async function loadHistory() {
  const version = ++historyVersion, id = auth.profileId;
  recentPosts.value = []; historyError.value = false;
  if (!id) return;
  const posts = await fetchProfileOotdPosts(id);
  if (version !== historyVersion || id !== auth.profileId) return;
  recentPosts.value = posts || []; historyError.value = posts === null;
}
watch(() => auth.profileId, () => { occasion.value = 'everyday'; loadHistory(); }, { immediate: true });
watch(() => app.ootdPosts, loadHistory, { deep: true });
watch(today, loadHistory);
function refreshDay() {
  now.value = Date.now();
  if (weather.current && !weather.loading && now.value-weather.current.fetchedAt > 30*60*1000) {
    weather.selectPlace({ ...weather.current, label: weather.current.city });
  }
}
onBeforeUnmount(() => { historyVersion++; clearInterval(clockTimer); document.removeEventListener('visibilitychange', refreshDay); });
onMounted(()=>{clockTimer=setInterval(refreshDay,60000);document.addEventListener('visibilitychange',refreshDay);refreshDay();});
const open = id => { app.selectedItemId = id; app.isDetailOpen = true; };
const selectedOutfit = ref(0);
const outfits = computed(() => {
  const options = [0,1,2].map(variant => recommendDailyOutfit({items:app.items,posts:recentPosts.value,profileId:auth.profileId,weather:weather.current,occasion:occasion.value,date:today.value,variant}));
  return options.filter((pieces,index)=>pieces.length && options.findIndex(other=>other.map(item=>item.id).join(':')===pieces.map(item=>item.id).join(':'))===index);
});
watch([occasion,today,()=>auth.profileId],()=>{selectedOutfit.value=0;});
const pieces = computed(() => outfits.value[selectedOutfit.value] || outfits.value[0] || []);
</script>

<template>
 <section class="weather-wardrobe" aria-labelledby="weather-outfit-title">
  <div class="weather-intro"><h2 id="weather-outfit-title">{{ t('今日穿搭') }}</h2>
   <OutfitBoard v-if="pieces.length" :pieces="pieces" @open="open"/>
   <router-link v-else class="outfit-empty" to="/closet?quick=add-item"><AppIcon name="Closet" :size="32"/>{{ t('加入第一件衣服') }}</router-link>
   <div v-if="outfits.length>1" class="outfit-choices" :aria-label="t('今日搭配')"><button v-for="(outfit,index) in outfits" :key="index" type="button" :aria-pressed="index===selectedOutfit" @click="selectedOutfit=index">{{ $tf('搭配 {number}',{number:index+1}) }}</button></div>
  </div>
  <div class="outfit-context"><label class="outfit-occasion">{{ t('場合') }}<select v-model="occasion" :aria-label="t('場合')"><option v-for="option in outfitOccasions" :key="option.value" :value="option.value">{{ t(option.label) }}</option></select></label>
   <ul><li v-for="tip in weather.advice" :key="tip"><AppIcon name="weather" :size="19"/><span>{{ t(tip) }}</span></li></ul>
   <p v-if="historyError" class="outfit-history-note" role="status">{{ t('近期穿搭紀錄暫時無法載入。') }} <button type="button" @click="loadHistory">{{ t('重試') }}</button></p>
  </div>
 </section>
</template>
<style scoped>

.weather-wardrobe{display:grid;grid-template-columns:minmax(280px,380px) minmax(0,1fr);align-items:center;gap:40px;padding:28px 32px;margin:32px 0 40px;border:1px solid var(--line);border-radius:16px;background:#fff}
.weather-intro{min-width:0}.weather-intro h2{font:400 30px/1.4 var(--font-display);margin:0 0 18px}.outfit-context{min-width:0}.outfit-context ul{list-style:none;padding:0;margin:28px 0 0;display:grid;gap:16px}.outfit-context li{display:flex;gap:12px;align-items:flex-start;font-size:13px;line-height:1.8}.outfit-context li svg{color:var(--accent);margin-top:2px}.outfit-occasion{display:flex;gap:14px;align-items:center;font-size:13px;color:var(--muted)}.outfit-occasion select{padding:10px 14px;border:1px solid var(--line);border-radius:8px;background:#fff;color:var(--ink);font:inherit;max-width:100%;min-height:44px}
.outfit-choices{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:16px}.outfit-choices button{border:1px solid var(--line);background:white;border-radius:24px;padding:10px 16px;min-height:44px;color:var(--muted);font-size:12px;cursor:pointer}.outfit-choices button[aria-pressed=true]{background:var(--ink);color:white;border-color:var(--ink)}.outfit-empty{display:flex;align-items:center;justify-content:center;gap:12px;min-height:200px;color:var(--ink)}.outfit-history-note{font-size:12px;color:var(--muted)}.outfit-history-note button{background:none;border:0;color:var(--accent);text-decoration:underline}
@media(max-width:700px){.weather-wardrobe{grid-template-columns:minmax(0,1fr);gap:24px;padding:24px}.outfit-context ul{margin-top:18px}.weather-intro h2{font-size:27px}}
</style>
