<script setup>
import {computed,ref,onMounted,onBeforeUnmount,watch} from 'vue';
import {useWeatherStore} from '@/stores/weather';
import {getBrowserPosition,searchWeatherPlaces} from '@/services/weather';
import {locale,t} from '@/i18n';
import AppIcon from '@/components/ui/AppIcon.vue';
const weather=useWeatherStore();
const expanded=ref(false),locating=ref(false),query=ref(''),searching=ref(false),places=ref([]),error=ref('');
let searchVersion=0,locationVersion=0;
onBeforeUnmount(()=>{searchVersion++;locationVersion++;});
const city=computed(()=>['目前位置','Current location'].includes(weather.current?.city)?t('目前位置'):weather.current?.city);
const weatherIcon=computed(()=>{const code=weather.current?.weatherCode;if(code==null)return 'weather';return code>=95?'storm':code>=71&&code<=77?'snow':code>=51?'rain':code>=45?'fog':code>=3?'cloud':code===0?'sun':'weather';});
async function relocate(fresh=true){
 if(locating.value||weather.loading)return;
 const version=++locationVersion;
 locating.value=true;error.value='';
 try{const position=await getBrowserPosition(undefined,{fresh});if(version!==locationVersion)return;await weather.selectPlace({...position,label:'Current location'});if(weather.error)expanded.value=true;}
 catch(failure){if(version===locationVersion){error.value=failure.message||'目前無法取得位置，請手動選擇城市。';expanded.value=true;}}
 finally{locating.value=false;}
}
watch([query,locale],()=>{searchVersion++;places.value=[];searching.value=false;});
async function search(){
 const version=++searchVersion;searching.value=true;error.value='';places.value=[];
 try{const found=await searchWeatherPlaces(query.value,locale.value);if(version===searchVersion)places.value=found;}
 catch(failure){if(version===searchVersion)error.value=failure.message||'城市搜尋暫時無法使用。';}
 finally{if(version===searchVersion)searching.value=false;}
}
async function select(place){locationVersion++;await weather.selectPlace(place);places.value=[];if(!weather.error)expanded.value=false;}
onMounted(()=>{if(!weather.current&&!weather.loading)void relocate(false);});
</script>
<template>
 <section class="home-weather" :aria-label="t('天氣')">
  <div class="home-weather-row">
   <button type="button" class="weather-location" :aria-expanded="expanded" @click="expanded=!expanded">
    <span class="weather-city">{{ city||t('選擇地區') }}</span>
    <span class="weather-values"><AppIcon :name="weatherIcon" :size="26"/><strong v-if="weather.current">{{ weather.current.temperature }}°C</strong><strong v-else>—°C</strong><small v-if="weather.current">{{ t(weather.current.summary) }}</small></span>
   </button>
   <button class="weather-relocate" type="button" :disabled="locating||weather.loading" :aria-label="t('重新定位')" :title="t('重新定位')" @click="relocate()"><AppIcon name="locate" :size="20"/></button>
  </div>
  <div v-if="expanded" class="home-weather-details">
   <form class="home-weather-search" @submit.prevent="search"><label class="sr-only" for="home-weather-city">{{ t('城市或地區') }}</label><input id="home-weather-city" v-model.trim="query" minlength="2" maxlength="80" :placeholder="t('城市或地區')" required/><button type="submit" :disabled="searching" :aria-label="t('搜尋地區')"><AppIcon name="search" :size="19"/></button></form>
   <div v-if="places.length" class="home-weather-places"><button v-for="place in places" :key="place.id" type="button" :disabled="weather.loading" @click="select(place)">{{ place.label }}</button></div>
   <p v-if="locating||weather.loading||searching" role="status">{{ t('正在取得當地天氣…') }}</p>
   <p v-if="error||weather.error" role="alert">{{ t(error||weather.error) }}</p>
   <p v-if="weather.current">{{ t('體感') }} {{ weather.current.apparent ?? weather.current.temperature }}°C · {{ t('降雨機率') }} {{ weather.current.rain ?? '—' }}%</p>
   <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open-Meteo</a>
  </div>
 </section>
</template>
<style scoped>
.home-weather{position:relative;min-width:0;color:var(--ink)}.home-weather-row{display:flex;align-items:center;gap:10px}.home-weather-row>svg{color:var(--accent)}.weather-location{display:grid;grid-template-rows:16px 30px;align-items:center;gap:6px;background:none;border:0;padding:0;min-height:52px;text-align:left;color:inherit;cursor:pointer}.weather-location strong{font-size:28px;line-height:30px;font-weight:650;white-space:nowrap;font-variant-numeric:tabular-nums}.weather-location .weather-city{display:block;font-size:11px;line-height:16px;color:var(--muted);max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.weather-location .weather-values{height:30px;display:flex;align-items:center;gap:8px;min-width:0}.weather-values>svg{color:var(--accent);flex:none}.weather-location small{display:block;font-size:11px;color:var(--muted);margin:0;white-space:nowrap}.weather-relocate{display:grid;place-items:center;width:44px;flex:none;border:0;background:#fff;box-shadow:0 3px 12px #4934560d;min-height:44px;border-radius:9px;padding:8px;color:var(--ink);cursor:pointer}.weather-relocate:disabled{opacity:.5;cursor:wait}.home-weather-details{position:absolute;right:0;top:calc(100% + 14px);z-index:15;width:min(330px,80vw);padding:16px;border:1px solid var(--line);border-radius:12px;background:var(--white);box-shadow:0 15px 32px -18px #30223655}.home-weather-search{display:flex;gap:8px}.home-weather-search input{width:100%;min-width:0;min-height:44px;padding:10px;border:1px solid var(--line);border-radius:7px;font:inherit;font-size:14px}.home-weather-search button{width:44px;flex:none;border:0;border-radius:7px;background:var(--accent-lavender-soft);cursor:pointer}.home-weather-details p,.home-weather-details>a{font-size:12px;line-height:1.6}.home-weather-details>a{color:var(--muted);font-size:10px}.home-weather-places{display:grid}.home-weather-places button{border:0;border-bottom:1px solid var(--line);background:none;text-align:left;padding:12px 0;font:inherit;font-size:13px;cursor:pointer}@media(max-width:700px){.weather-location strong{font-size:24px}.home-weather-row{gap:8px}.home-weather-details{right:auto;left:0}}
</style>
