import { describe, expect, it, vi } from 'vitest';
import { WeatherError, fetchWeatherForCity, fetchWeatherAt, searchWeatherPlaces, weatherWardrobeAdvice, getBrowserPosition } from '../weather';

describe('weather service', () => {
  it('resolves a city through geocoding and returns provider weather', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [{ name: '台北', country_code: 'TW', latitude: 25.04, longitude: 121.56 }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ current: { temperature_2m: 24.4, weather_code: 2 } }) });
    await expect(fetchWeatherForCity('台北', fetchImpl)).resolves.toMatchObject({ city: '台北', temperature: 24, summary: '多雲' });
  });

  it('reports permission denied without inventing weather', async () => {
    const geolocation = { getCurrentPosition: (_success, failure) => failure({ code: 1 }) };
    await expect(getBrowserPosition(geolocation)).rejects.toMatchObject({ name: 'WeatherError', code: 'PERMISSION_DENIED' });
    await expect(getBrowserPosition(null)).rejects.toBeInstanceOf(WeatherError);
  });

  it('offers distinct city choices instead of silently choosing an ambiguous place', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok:true, json:async()=>({results:[
      {id:1,name:'Paris',admin1:'Île-de-France',country:'France',latitude:48.8,longitude:2.3},
      {id:2,name:'Paris',admin1:'Texas',country:'United States',latitude:33.6,longitude:-95.5}
    ]}) });
    const places = await searchWeatherPlaces('Paris','es',fetchImpl);
    expect(places).toHaveLength(2);
    expect(places[0].label).toContain('France');
    expect(places[1].label).toContain('Texas');
    expect(String(fetchImpl.mock.calls[0][0])).toContain('language=es');
  });

  it('uses actual forecast fields for layers and rain without fabricating missing values', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ok:true,json:async()=>({current:{temperature_2m:17,apparent_temperature:15,weather_code:3,time:'2026-10-23T10:00'},daily:{temperature_2m_min:[12],temperature_2m_max:[24],precipitation_probability_max:[70]},timezone:'Asia/Taipei'})});
    const weather = await fetchWeatherAt({latitude:25,longitude:121,city:'Taipei'},fetchImpl);
    expect(weather).toMatchObject({temperature:17,apparent:15,min:12,max:24,rain:70});
    expect(weatherWardrobeAdvice(weather)).toHaveLength(3);
    expect(weatherWardrobeAdvice(null)).toEqual([]);
  });

  it('rejects missing temperatures instead of interpreting null as zero degrees', async () => {
    await expect(fetchWeatherAt({latitude:25,longitude:121,city:'Taipei'},async()=>({ok:true,json:async()=>({current:{temperature_2m:null}})}))).rejects.toBeInstanceOf(WeatherError);
  });

  it('uses regional country names and excludes airports from city choices',async()=>{
    const places=await searchWeatherPlaces('Taipei','zh-TW',async()=>({ok:true,json:async()=>({results:[
      {id:1,name:'台北市',admin1:'臺灣省 or 台灣省',country:'台湾',country_code:'TW',feature_code:'PPLC',latitude:25,longitude:121},
      {id:2,name:'Taipei Airport',country_code:'TW',feature_code:'AIRP',latitude:25,longitude:121}
    ]})}));
    expect(places).toHaveLength(1);
    expect(places[0].label).toBe('台北市, 台灣');
  });
});
