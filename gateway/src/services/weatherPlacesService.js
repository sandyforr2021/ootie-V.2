import { GatewayError } from '../errors.js';
import { weatherPlaceQuery } from '../../../shared/weatherPlaces.js';
import { findIndexedCities } from './weatherCityIndex.js';

// A shared cache and bounded, paced queue keep explicit city searches modest.
// Weather still comes from Open-Meteo; Photon resolves multilingual OSM place names.
export function createWeatherPlacesService({ fetchImpl = fetch, endpoint = process.env.WEATHER_GEOCODER_URL || 'https://photon.komoot.io/api/' } = {}) {
  const cache = new Map();
  const pending = new Map();
  let tail = Promise.resolve();
  let nextRequest = 0;
  async function lookup(query, language) {
    const delay = Math.max(0, nextRequest - Date.now());
    if (delay) await new Promise(resolve => setTimeout(resolve, delay));
    nextRequest = Date.now() + 1100;
    const url = new URL(endpoint);
    url.searchParams.set('q', query.name);
    url.searchParams.set('limit', '8');
    for (const layer of ['city', 'district', 'county', 'state']) url.searchParams.append('layer', layer);
    // The public Photon instance supports English, German and French labels.
    // For the other UI languages, keep native place names instead of guessing.
    if (language === 'en') url.searchParams.set('lang', 'en');
    if (query.countryCode) url.searchParams.set('countrycode', query.countryCode);
    let response;
    try { response = await fetchImpl(url, { signal: AbortSignal.timeout(10000), headers: { 'User-Agent': 'OOTIE/1.0 (https://ootie-youcam-jury.onrender.com)' } }); }
    catch { throw new GatewayError('WEATHER_PLACES_UNAVAILABLE', 503); }
    if (!response.ok) throw new GatewayError('WEATHER_PLACES_UNAVAILABLE', 503);
    const payload = await response.json();
    if (!Array.isArray(payload.features)) throw new GatewayError('WEATHER_PLACES_UNAVAILABLE', 503);
    const regions = new Intl.DisplayNames([language], { type: 'region' });
    const seen = new Set();
    return payload.features.flatMap(feature => {
      const p = feature.properties || {};
      const [longitude, latitude] = feature.geometry?.coordinates || [];
      const countryCode = String(p.countrycode || '').toUpperCase();
      if (!p.name || !['place', 'boundary'].includes(p.osm_key) || !/^[A-Z]{2}$/.test(countryCode) || (query.countryCode && countryCode !== query.countryCode) ||
          !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180 ||
          !['city', 'district', 'county', 'state'].includes(p.type)) return [];
      const region = regions.of(countryCode) || p.country;
      const administrative = [p.city, p.county, p.state].filter(part => part && part !== p.name);
      const label = [...new Set([p.name, ...administrative, region])].join(', ');
      const key = `${label}:${latitude.toFixed(2)}:${longitude.toFixed(2)}`;
      if (seen.has(key)) return [];
      seen.add(key);
      return [{ id: `osm-${p.osm_type}-${p.osm_id}`, name: p.name, label, countryCode, latitude, longitude }];
    });
  }
  return {
    async search(body) {
      if (typeof body?.query !== 'string' || body.query.trim().length < 2 || body.query.length > 80) throw new GatewayError('INVALID_CITY_QUERY', 400);
      const language = ['zh-TW', 'en', 'ja', 'es'].includes(body.language) ? body.language : 'en';
      const query = weatherPlaceQuery(body.query);
      const key = JSON.stringify([query, language]);
      const cached = cache.get(key);
      if (cached && cached.expires > Date.now()) return cached.places;
      const indexed = await findIndexedCities(query, language);
      if (indexed.length) return indexed;
      if (pending.has(key)) return pending.get(key);
      if (pending.size >= 8) throw new GatewayError('WEATHER_SEARCH_BUSY', 429);
      const work = tail.catch(() => {}).then(() => lookup(query, language)).then(places => {
        if (cache.size >= 500) cache.delete(cache.keys().next().value);
        cache.set(key, { places, expires: Date.now() + 86400000 });
        return places;
      }).finally(() => pending.delete(key));
      tail = work.catch(() => {});
      pending.set(key, work);
      return work;
    }
  };
}
