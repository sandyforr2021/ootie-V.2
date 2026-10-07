import { describe, expect, it, vi } from 'vitest';
import { WeatherError, fetchWeatherForCity, getBrowserPosition } from '../weather';

describe('weather service', () => {
  it('resolves a city through geocoding and returns provider weather', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [{ name: '台北', latitude: 25.04, longitude: 121.56 }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ current: { temperature_2m: 24.4, weather_code: 2 } }) });
    await expect(fetchWeatherForCity('台北', fetchImpl)).resolves.toMatchObject({ city: '台北', temperature: 24, summary: '多雲' });
  });

  it('reports permission denied without inventing weather', async () => {
    const geolocation = { getCurrentPosition: (_success, failure) => failure({ code: 1 }) };
    await expect(getBrowserPosition(geolocation)).rejects.toMatchObject({ name: 'WeatherError', code: 'PERMISSION_DENIED' });
    await expect(getBrowserPosition(null)).rejects.toBeInstanceOf(WeatherError);
  });
});
