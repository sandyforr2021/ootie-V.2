<script setup>
import { computed, ref, onMounted } from 'vue';
import { useWeatherStore } from '@/stores/weather';
import { useAppStore } from '@/stores/app';
import { searchWeatherPlaces, getBrowserPosition } from '@/services/weather';
import { itemName } from '@/services/itemPresentation';
import { locale } from '@/i18n';
const weather = useWeatherStore();
const app = useAppStore();
const query = ref('');
const places = ref([]);
const searching = ref(false);
const error = ref('');
onMounted(async()=>{
 if(weather.current || weather.loading) return;
 try { const position=await getBrowserPosition(); if(!weather.current && !weather.loading) await weather.selectPlace({...position,label:locale.value==='zh-TW'?'目前位置':'Current location'}); }
 catch(failure) { error.value=failure.message; }
});
async function search() {
  if (searching.value) return;
  searching.value = true; places.value = []; error.value = '';
  try { places.value = await searchWeatherPlaces(query.value, locale.value); }
  catch (failure) { error.value = failure.name === 'WeatherError' ? failure.message : '城市搜尋暫時無法使用。'; }
  finally { searching.value = false; }
}
const open = id => { app.selectedItemId = id; app.isDetailOpen = true; };
const pieces = computed(() => {
  if (!weather.current) return [];
  const cold = (weather.current.apparent ?? weather.current.temperature) < 21;
  const categories = cold ? ['Jackets','Knitwear','Trousers','Sneakers'] : ['Tops','Shorts','Trousers','Sneakers'];
  return categories.map(category => app.items.find(item => item.hidden !== true && item.hidden !== 'true' && item.category === category)).filter(Boolean).slice(0,3);
});
</script>

<template>
  <section class="weather-wardrobe" aria-labelledby="weather-outfit-title">
    <div class="weather-intro"><span class="eyebrow">{{ $t('今天，穿什麼？') }}</span><h2 id="weather-outfit-title">{{ $t('跟著天氣，搭出好心情。') }}</h2><p>{{ $t('搜尋並選擇城市，查看當地天氣與衣櫥搭配方向。') }}</p></div>
    <div class="weather-main"><form class="weather-search" @submit.prevent="search"><label class="sr-only" for="weatherPlace">{{ $t('城市或地區') }}</label><input id="weatherPlace" v-model.trim="query" minlength="2" maxlength="80" required :placeholder="$t('城市或地區')"><button class="secondary" :disabled="searching">{{ $t(searching ? '搜尋中…' : '搜尋地區') }}</button></form>
      <div v-if="places.length" class="weather-places" :aria-label="$t('選擇地區')"><button v-for="place in places" :key="place.id" :disabled="weather.loading" @click="weather.selectPlace(place); places = []">{{ place.label }}<span>→</span></button></div>
      <p v-if="searching || weather.loading" role="status">{{ $t('正在取得當地天氣…') }}</p><p v-if="error || weather.error" role="alert">{{ $t(error || weather.error) }}</p>
      <div v-if="weather.current" class="weather-current"><div class="weather-now"><span aria-hidden="true">{{ weather.current.icon }}</span><strong>{{ weather.current.temperature }}°C</strong><div><h3>{{ weather.current.city }}</h3><p>{{ $t(weather.current.summary) }}<template v-if="weather.current.apparent != null"> · {{ $t('體感') }} {{ weather.current.apparent }}°C</template></p></div></div><p class="weather-day"><span v-if="weather.current.min != null && weather.current.max != null">{{ $t('今日') }} {{ weather.current.min }}–{{ weather.current.max }}°C</span><span v-if="weather.current.rain != null">{{ $t('降雨機率') }} {{ weather.current.rain }}%</span></p><ul><li v-for="tip in weather.advice" :key="tip">{{ $t(tip) }}</li></ul><div v-if="pieces.length" class="weather-pieces"><button v-for="item in pieces" :key="item.id" @click="open(item.id)"><img v-if="item.photo" :src="item.photo" alt="" loading="lazy"><span>{{ itemName(item) }}</span></button></div><small v-if="weather.current.time">{{ $t('資料時間') }} {{ weather.current.time.replace('T',' ') }} · {{ weather.current.timezone }}</small></div>
      <a class="weather-source" href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">{{ $t('天氣資料') }}: Open-Meteo · {{ $t('天氣預報，非即時實測') }}</a>
    </div>
  </section>
</template>

<style scoped>
.weather-wardrobe{display:grid;grid-template-columns:.8fr 1.2fr;gap:40px;margin:32px 0 40px;padding:32px;border-radius:20px;background:var(--accent-yellow-soft,#fff4c8);border:1px solid var(--line)}.weather-intro h2{font-family:var(--font-display);font-size:clamp(24px,3vw,32px);line-height:1.25;margin:12px 0}.weather-intro p,.weather-main p{font-size:12px;line-height:1.7;color:var(--muted)}.weather-search{display:flex;gap:8px}.weather-search input{min-width:0;flex:1;padding:11px 14px;border:1px solid var(--line);border-radius:9px;background:var(--surface-raised,#fffdf8);color:var(--ink);font-size:14px}.weather-search button{flex-shrink:0;font-size:12px;white-space:normal}.weather-places{margin:12px 0;background:var(--surface-raised);border-radius:10px;overflow:hidden}.weather-places button{display:flex;justify-content:space-between;gap:16px;width:100%;text-align:left;border:0;border-bottom:1px solid var(--line);padding:12px;background:none;color:var(--ink);font-size:13px}.weather-places button:hover{background:var(--accent-blue-soft)}.weather-now{display:flex;align-items:center;gap:15px;margin-top:22px}.weather-now>span{font-size:29px}.weather-now>strong{font-size:36px;letter-spacing:-.04em;font-variant-numeric:tabular-nums}.weather-now h3{font-size:14px;margin:0;line-height:1.5}.weather-now p{margin:2px 0}.weather-day{display:flex;flex-wrap:wrap;gap:16px}.weather-current ul{padding-left:18px;font-size:13px;line-height:1.8}.weather-current small{display:block;font-size:10px;color:var(--muted);margin-top:15px}.weather-source{display:inline-block;font-size:10px;color:var(--muted);margin-top:16px}.weather-pieces{display:flex;gap:10px}.weather-pieces button{display:flex;flex:1;min-width:0;align-items:center;gap:8px;text-align:left;border:1px solid var(--line);border-radius:9px;padding:8px;color:var(--ink);background:var(--surface-raised,#fffdf8)}.weather-pieces img{width:35px;height:48px;object-fit:contain;background:white}.weather-pieces span{font-size:10px;line-height:1.4;overflow-wrap:anywhere}@media(max-width:800px){.weather-wardrobe{grid-template-columns:1fr;gap:12px;padding:24px}}@media(max-width:450px){.weather-wardrobe{padding:20px}.weather-pieces button{flex-direction:column;align-items:start}.weather-search input{font-size:16px}.weather-now{flex-wrap:wrap}.weather-now>div{flex-basis:100%}}
</style>
