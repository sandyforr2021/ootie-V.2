import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { fetchWeatherAt, weatherWardrobeAdvice } from '@/services/weather';

export const useWeatherStore = defineStore('weather', () => {
  const current = ref(null);
  const loading = ref(false);
  const error = ref('');
  let version = 0;
  const advice = computed(() => weatherWardrobeAdvice(current.value));
  async function selectPlace(place) {
    if (loading.value) return;
    const request = ++version;
    loading.value = true; error.value = ''; current.value = null;
    try { const result = await fetchWeatherAt({ ...place, city: place.label || place.name }); if (request === version) current.value = result; }
    catch (failure) { if (request === version) error.value = failure.name === 'WeatherError' ? failure.message : '天氣服務暫時無法使用。'; }
    finally { if (request === version) loading.value = false; }
  }
  return { current, loading, error, advice, selectPlace };
});
