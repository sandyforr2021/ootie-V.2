const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';

export class WeatherError extends Error {
  constructor(code, message) { super(message); this.name = 'WeatherError'; this.code = code; }
}

const weatherLabel = (code) => {
  const value = Number(code);
  if ([0, 1].includes(value)) return { icon: '☀', summary: '晴朗' };
  if ([2, 3, 45, 48].includes(value)) return { icon: '☁', summary: '多雲' };
  if (value >= 51 && value <= 82) return { icon: '☂', summary: '可能降雨' };
  if (value >= 95) return { icon: '⚡', summary: '雷雨' };
  return { icon: '◌', summary: '天氣狀態' };
};

export async function fetchWeatherAt({ latitude, longitude, city }, fetchImpl = fetch) {
  const url = new URL(FORECAST_URL);
  url.searchParams.set('latitude', String(latitude));
  url.searchParams.set('longitude', String(longitude));
  url.searchParams.set('current', 'temperature_2m,weather_code');
  url.searchParams.set('timezone', 'auto');
  const response = await fetchImpl(url);
  if (!response.ok) throw new WeatherError('PROVIDER_ERROR', '天氣服務暫時無法使用。');
  const current = (await response.json())?.current;
  if (!current || !Number.isFinite(Number(current.temperature_2m))) throw new WeatherError('PROVIDER_ERROR', '天氣資料格式不完整。');
  const condition = weatherLabel(current.weather_code);
  return { ...condition, temperature: Math.round(Number(current.temperature_2m)), city, latitude, longitude };
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
