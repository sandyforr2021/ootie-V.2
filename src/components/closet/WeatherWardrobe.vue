<script setup>
import { computed, ref, onMounted, onBeforeUnmount, watch } from 'vue';
import { useWeatherStore } from '@/stores/weather';
import { useAppStore } from '@/stores/app';
import { searchWeatherPlaces, getBrowserPosition } from '@/services/weather';
import { itemName, itemPhoto } from '@/services/itemPresentation';
import { locale, t } from '@/i18n';
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
const cityLabel = computed(() => ['目前位置', 'Current location'].includes(weather.current?.city) ? t('目前位置') : weather.current?.city);
const query = ref('');
const places = ref([]);
const searching = ref(false);
const error = ref('');
let searchVersion = 0;
watch([query, locale], () => { searchVersion++; places.value = []; error.value = ''; searching.value = false; });
onMounted(async()=>{
 clockTimer = setInterval(refreshDay, 60000);
 document.addEventListener('visibilitychange', refreshDay);
 refreshDay();
 if(weather.current || weather.loading) return;
 try { const position=await getBrowserPosition(); if(!weather.current && !weather.loading) await weather.selectPlace({...position,label:locale.value==='zh-TW'?'目前位置':'Current location'}); }
 catch(failure) { error.value=failure.message; }
});
async function search() {
  if (searching.value) return;
  const version = ++searchVersion;
  searching.value = true; places.value = []; error.value = '';
  try { const found = await searchWeatherPlaces(query.value, locale.value); if (version === searchVersion) places.value = found; }
  catch (failure) { if (version === searchVersion) error.value = failure.name === 'WeatherError' ? failure.message : '城市搜尋暫時無法使用。'; }
  finally { if (version === searchVersion) searching.value = false; }
}
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
    <div class="weather-intro"><h2 id="weather-outfit-title">{{ $t('天氣與穿搭') }}</h2>
      <label v-if="auth.isMember" class="outfit-occasion">{{ $t('場合') }}<select v-model="occasion" :aria-label="$t('場合')"><option v-for="option in outfitOccasions" :key="option.value" :value="option.value">{{ $t(option.label) }}</option></select></label>
      <OutfitBoard v-if="pieces.length" :pieces="pieces" @open="open" />
      <div v-if="outfits.length>1" class="outfit-choices" :aria-label="$t('今日搭配')"><button v-for="(outfit,index) in outfits" :key="index" type="button" :aria-pressed="index===selectedOutfit" @click="selectedOutfit=index">{{ $tf('搭配 {number}',{number:index+1}) }}</button></div>
      <p v-if="historyError" class="outfit-history-note" role="status">{{ $t('近期穿搭紀錄暫時無法載入。') }} <button type="button" @click="loadHistory">{{ $t('重試') }}</button></p>
    </div>
    <div class="weather-main"><form class="weather-search" @submit.prevent="search"><label class="sr-only" for="weatherPlace">{{ $t('城市或地區') }}</label><input id="weatherPlace" v-model.trim="query" minlength="2" maxlength="80" required :placeholder="$t('城市或地區')"><button class="secondary" :disabled="searching">{{ $t(searching ? '搜尋中…' : '搜尋地區') }}</button></form>
      <div v-if="places.length" class="weather-places" :aria-label="$t('選擇地區')"><button v-for="place in places" :key="place.id" :disabled="weather.loading" @click="weather.selectPlace(place); places = []">{{ place.label }}<span>→</span></button></div>
      <p v-if="searching || weather.loading" role="status">{{ $t('正在取得當地天氣…') }}</p><p v-if="error || weather.error" role="alert">{{ $t(error || weather.error) }}</p>
      <div v-if="weather.current" class="weather-current"><div class="weather-now"><span aria-hidden="true">{{ weather.current.icon }}</span><strong>{{ weather.current.temperature }}°C</strong><div><h3>{{ cityLabel }}</h3><p>{{ $t(weather.current.summary) }}<template v-if="weather.current.apparent != null"> · {{ $t('體感') }} {{ weather.current.apparent }}°C</template></p></div></div><p class="weather-day"><span v-if="weather.current.min != null && weather.current.max != null">{{ $t('今日') }} {{ weather.current.min }}–{{ weather.current.max }}°C</span><span v-if="weather.current.rain != null">{{ $t('降雨機率') }} {{ weather.current.rain }}%</span></p><ul><li v-for="tip in weather.advice" :key="tip">{{ $t(tip) }}</li></ul></div>
      <details class="weather-attribution"><summary :aria-label="$t('資料來源')" :title="$t('資料來源')"><AppIcon name="info" :size="16" /></summary><div class="weather-attribution-content">
      <a class="weather-source" href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">{{ $t('天氣資料') }}: Open-Meteo · {{ $t('天氣預報，非即時實測') }}</a>
      <small class="weather-source">{{ $t('城市資料') }}: <a href="https://www.geonames.org/" target="_blank" rel="noopener noreferrer">GeoNames</a> · <a href="https://photon.komoot.io/" target="_blank" rel="noopener noreferrer">Photon</a> · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a></small>
      </div></details>
    </div>
  </section>
</template>

<style scoped>
.weather-wardrobe{display:grid;grid-template-columns:1fr 1.15fr;gap:40px;margin:40px 0;padding:32px;border-radius:20px;background:#fff;border:1px solid var(--line)}
.outfit-choices{display:flex;justify-content:center;gap:8px;margin-top:16px;flex-wrap:wrap}.outfit-choices button{border:1px solid var(--line);background:#fff;border-radius:20px;padding:8px 15px;font-size:12px;color:var(--muted)}.outfit-choices button[aria-pressed=true]{background:var(--ink);color:#fff;border-color:var(--ink)}
.outfit-occasion{display:flex;align-items:center;gap:12px;margin-bottom:16px;font-size:13px;color:var(--muted)}.outfit-occasion select{padding:8px 12px;border:1px solid var(--line);border-radius:7px;background:#fff;color:var(--ink);font:inherit;max-width:100%}.outfit-dress{grid-area:1/1/3/2}.outfit-history-note{font-size:12px;color:var(--muted)}.outfit-history-note button{border:0;background:none;color:var(--accent);text-decoration:underline}
.weather-intro h2{font-family:var(--font-display);font-size:clamp(24px,3vw,32px);line-height:1.25;margin:0 0 20px}.weather-main{min-width:0;align-self:center}.weather-main p{font-size:12px;line-height:1.7;color:var(--muted)}
.weather-search{display:flex;gap:8px}.weather-search input{min-width:0;flex:1;padding:11px 14px;border:1px solid var(--line);border-radius:9px;background:var(--surface-raised,#fffdf8);color:var(--ink);font-size:14px}.weather-search button{flex-shrink:0;font-size:12px;white-space:normal}.weather-places{margin:12px 0;background:var(--surface-raised);border-radius:10px;overflow:hidden}.weather-places button{display:flex;justify-content:space-between;gap:16px;width:100%;text-align:left;border:0;border-bottom:1px solid var(--line);padding:12px;background:none;color:var(--ink);font-size:13px}.weather-places button:hover{background:var(--accent-blue-soft)}
.weather-now{display:flex;align-items:center;flex-wrap:wrap;gap:14px;margin-top:28px}.weather-now>span{font-size:29px}.weather-now>strong{font-size:40px;letter-spacing:-.04em;font-variant-numeric:tabular-nums}.weather-now>div{flex:1;min-width:140px}.weather-now h3{font-size:14px;margin:0;line-height:1.5}.weather-now p{margin:2px 0}.weather-day{display:flex;flex-wrap:wrap;gap:16px}.weather-current ul{padding-left:18px;font-size:13px;line-height:1.8}
.weather-outfit{display:grid;grid-template-columns:1.25fr .85fr;grid-template-rows:155px 170px;gap:8px 14px;max-width:360px;margin-inline:auto}.weather-outfit button{min-width:0;min-height:0;border:0;border-radius:12px;background:none;padding:4px;cursor:pointer}.weather-outfit button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}.weather-outfit :deep(img){display:block;width:100%;height:100%;object-fit:contain;transition:transform 180ms ease-out}.outfit-top{grid-area:1/1}.outfit-bottom{grid-area:2/1}.outfit-shoes{grid-area:2/2;align-self:end;height:105px}.outfit-accessory,.outfit-outer{grid-area:1/2}.outfit-accessory{height:110px;align-self:center;transform:rotate(7deg)}.outfit-top{transform:rotate(-4deg)}.outfit-bottom{transform:rotate(3deg)}
.weather-attribution{position:relative;margin-top:12px;display:flex;justify-content:flex-end}.weather-attribution summary{list-style:none;width:32px;height:32px;display:grid;place-items:center;cursor:pointer;color:var(--muted);border-radius:50%}.weather-attribution summary::-webkit-details-marker{display:none}.weather-attribution summary:hover{background:#efe1aa;color:var(--ink)}.weather-attribution-content{position:absolute;bottom:38px;right:0;width:280px;max-width:70vw;padding:16px;border:1px solid var(--line);border-radius:12px;background:var(--paper);z-index:2}.weather-source{display:block;font-size:11px;line-height:1.7;color:var(--muted)}.weather-source+.weather-source{margin-top:8px}
@media(hover:hover){.weather-outfit button:hover :deep(img){transform:translateY(-3px)}}@media(prefers-reduced-motion:reduce){.weather-outfit :deep(img){transition:none}}@media(max-width:700px){.weather-wardrobe{grid-template-columns:1fr;gap:24px;padding:24px}.weather-outfit{width:100%;grid-template-rows:140px 150px}.weather-search input{font-size:16px}.weather-now{margin-top:20px}}
</style>
