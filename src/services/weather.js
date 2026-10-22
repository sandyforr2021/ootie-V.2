const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';

export class WeatherError extends Error {
  constructor(code, message) { super(message); this.name = 'WeatherError'; this.code = code; }
}

const weatherLabel = (code) => {
  const value = Number(code);
  if ([0, 1].includes(value)) return { icon: '☀', summary: '晴朗' };
  if ([2, 3].includes(value)) return { icon: '☁', summary: '多雲' };
  if ([45,48].includes(value)) return { icon: '☁', summary: '霧' };
  if ([71,73,75,77,85,86].includes(value)) return { icon: '❄', summary: '降雪' };
  if (value >= 51 && value <= 82) return { icon: '☂', summary: '可能降雨' };
  if (value >= 95) return { icon: '⚡', summary: '雷雨' };
  return { icon: '◌', summary: '天氣狀態' };
};

export async function fetchWeatherAt({ latitude, longitude, city }, fetchImpl = fetch) {
  if (!Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude)) || Math.abs(latitude)>90 || Math.abs(longitude)>180) throw new WeatherError('INVALID_LOCATION', '請選擇有效地區。');
  const url = new URL(FORECAST_URL);
  url.searchParams.set('latitude', String(latitude));
  url.searchParams.set('longitude', String(longitude));
  url.searchParams.set('current', 'temperature_2m,apparent_temperature,weather_code');
  url.searchParams.set('daily', 'temperature_2m_max,temperature_2m_min,precipitation_probability_max');
  url.searchParams.set('forecast_days', '1');
  url.searchParams.set('timezone', 'auto');
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new WeatherError('PROVIDER_ERROR', '天氣服務暫時無法使用。');
  const payload = await response.json();
  const current = payload?.current;
  if (!current || current.temperature_2m == null || !Number.isFinite(Number(current.temperature_2m))) throw new WeatherError('PROVIDER_ERROR', '天氣資料格式不完整。');
  const condition = weatherLabel(current.weather_code);
  const optional = value => value == null || !Number.isFinite(Number(value)) ? null : Math.round(Number(value));
  return { ...condition, temperature: Math.round(Number(current.temperature_2m)), apparent: optional(current.apparent_temperature), city, latitude, longitude,
    min: optional(payload.daily?.temperature_2m_min?.[0]), max: optional(payload.daily?.temperature_2m_max?.[0]), rain: optional(payload.daily?.precipitation_probability_max?.[0]),
    time: current.time || null, timezone: payload.timezone || null, weatherCode: current.weather_code, fetchedAt: Date.now() };
}

export async function searchWeatherPlaces(city, language = 'en', fetchImpl = fetch) {
  const normalized = String(city || '').trim();
  if (normalized.length < 2) throw new WeatherError('CITY_REQUIRED', '請輸入城市名稱。');
  const url = new URL(GEOCODING_URL);
  url.searchParams.set('name', normalized);
  url.searchParams.set('count', '8');
  url.searchParams.set('language', language === 'zh-TW' ? 'zh' : language);
  url.searchParams.set('format', 'json');
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new WeatherError('PROVIDER_ERROR', '城市搜尋暫時無法使用。');
  const places = ((await response.json())?.results || []).filter(place=>!place.feature_code || /^(PPL|ADM)/.test(place.feature_code));
  if (!places.length) throw new WeatherError('CITY_NOT_FOUND', '找不到這個城市，請確認名稱後再試。');
  return places.map(place => {
    let region=place.country;
    try { if(place.country_code) region=new Intl.DisplayNames([language],{type:'region'}).of(place.country_code) || region; } catch { /* Keep the provider's country name. */ }
    let administrative=String(place.admin1 || '').split(/\s+or\s+/)[0].trim();
    if(place.country_code==='TW' && /^(?:[臺台]灣省|Taiwan)$/i.test(administrative)) administrative='';
    return {id:place.id,name:place.name,label:[...new Set([place.name,administrative,region].filter(Boolean))].join(', '),latitude:place.latitude,longitude:place.longitude};
  });
}

export function weatherWardrobeAdvice(weather) {
  if (!weather) return [];
  const temperature = weather.apparent ?? weather.temperature;
  const advice = [temperature < 12 ? '低溫時以保暖外套與針織層次為主。' : temperature < 21 ? '微涼天氣適合薄外套與可增減的層次。' : temperature < 28 ? '舒適溫度適合透氣上衣與輕薄下身。' : '炎熱時選擇輕薄、透氣的衣物。'];
  if ((weather.rain ?? 0) >= 40 || (weather.weatherCode >= 51 && weather.weatherCode <= 99)) advice.push('可能下雨，搭配防潑水外層並攜帶雨具。');
  if (weather.min != null && weather.max - weather.min >= 8) advice.push('日夜溫差較大，帶一件容易收納的外套。');
  return advice;
}

export async function fetchWeatherForCity(city, fetchImpl = fetch) {
  const normalized = String(city || '').trim();
  if (!normalized) throw new WeatherError('CITY_REQUIRED', '請輸入城市名稱。');
  const url = new URL(GEOCODING_URL);
  url.searchParams.set('name', normalized);
  url.searchParams.set('count', '1');
  url.searchParams.set('language', 'zh');
  url.searchParams.set('format', 'json');
  const response = await fetchImpl(url);
  if (!response.ok) throw new WeatherError('PROVIDER_ERROR', '城市搜尋暫時無法使用。');
  const place = (await response.json())?.results?.[0];
  if (!place) throw new WeatherError('CITY_NOT_FOUND', '找不到這個城市，請確認名稱後再試。');
  return fetchWeatherAt({ latitude: place.latitude, longitude: place.longitude, city: place.name || normalized }, fetchImpl);
}

export function getBrowserPosition(geolocation = typeof navigator !== 'undefined' ? navigator.geolocation : null) {
  if (!geolocation) return Promise.reject(new WeatherError('GEOLOCATION_UNAVAILABLE', '此裝置不支援定位，請手動選擇城市。'));
  return new Promise((resolve, reject) => {
    geolocation.getCurrentPosition(
      ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude }),
      (error) => reject(new WeatherError(error?.code === 1 ? 'PERMISSION_DENIED' : 'GEOLOCATION_UNAVAILABLE', error?.code === 1 ? '定位未授權，請手動選擇城市。' : '目前無法取得位置，請手動選擇城市。')),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 30 * 60 * 1000 }
    );
  });
}
