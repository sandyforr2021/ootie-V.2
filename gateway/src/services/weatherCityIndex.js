import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gunzip } from 'node:zlib';
import { promisify } from 'node:util';

const decompress = promisify(gunzip);
const shards = new Map();
const normalize = text => text.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]/gu, '');
// Read only the matching shard; keep the free service's memory bounded.
export async function findIndexedCities(query, language) {
  const key = normalize(query.name);
  const shard = createHash('sha256').update(key).digest('hex').slice(0, 2);
  let data = shards.get(shard);
  if (!data) {
    const bytes = await readFile(new URL(`../../data/weather-cities/${shard}.json.gz`, import.meta.url));
    data = JSON.parse((await decompress(bytes)).toString('utf8'));
    if (shards.size >= 8) shards.delete(shards.keys().next().value);
    shards.set(shard, data);
  }
  const regions = new Intl.DisplayNames([language], { type: 'region' });
  const candidates = (data[key] || []).filter(row => !query.countryCode || row[2] === query.countryCode);
  // Historical aliases can refer to a former county seat (e.g. Kaohsiung/Fengshan).
  // Prefer current exact city names when the query has one, retaining same-name cities.
  const cityKey = value => normalize(value.replace(/(?:\s+City|市)$/iu, ''));
  const exact = candidates.filter(row => cityKey(row[1]) === cityKey(query.name));
  return (exact.length ? exact : candidates).slice(0, 8).map(([id, name, countryCode, latitude, longitude, , administrative]) => ({
    id: `geonames-${id}`, name, countryCode, latitude, longitude,
    label: [...new Set([query.inputName && normalize(query.inputName) !== normalize(name) ? `${query.inputName} · ${name}` : name, countryCode !== 'TW' && administrative !== name ? administrative : '', regions.of(countryCode)].filter(Boolean))].join(', ')
  }));
}
