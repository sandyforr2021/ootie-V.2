// The provider indexes several Taiwanese cities under their English names only.
// Match complete aliases, rather than substrings, so other places remain searchable.
const TAIWAN_CITY_ALIASES = [
  ['Taipei', '台北', '臺北'],
  ['New Taipei', '新北'],
  ['Kaohsiung', '高雄'],
  ['Taichung', '台中', '臺中'],
  ['Tainan', '台南', '臺南'],
  ['Taoyuan', '桃園', '桃园'],
  ['Keelung', '基隆'],
  ['Hsinchu', '新竹'],
  ['Chiayi', '嘉義', '嘉义'],
  ['Yilan', '宜蘭', '宜兰'],
  ['Hualien', '花蓮', '花莲'],
  ['Taitung', '台東', '臺東', '台东'],
  ['Pingtung', '屏東', '屏东'],
  ['Changhua', '彰化'],
  ['Nantou', '南投'],
  ['Miaoli', '苗栗'],
  ['Douliu', '斗六'],
  ['Magong', '馬公', '马公'],
];

const normalizeAlias = value => value.normalize('NFKC').trim().toLowerCase()
  .replace(/\s+/g, ' ').replace(/(?:市| city)$/u, '').trim();
const aliases = new Map(TAIWAN_CITY_ALIASES.flatMap(([name, ...names]) =>
  [name, ...names].map(alias => [normalizeAlias(alias), name])));

export function weatherPlaceQuery(value) {
  const input = String(value || '').normalize('NFKC').trim();
  const taiwanPrefix = /^(?:台灣|臺灣|台湾|Taiwan)[\s,，]*/i;
  const taiwanSuffix = /[\s,，]*(?:台灣|臺灣|台湾|Taiwan)$/i;
  const explicitlyTaiwan = taiwanPrefix.test(input) || taiwanSuffix.test(input);
  const city = input.replace(taiwanPrefix, '').replace(taiwanSuffix, '').trim();
  const canonical = aliases.get(normalizeAlias(city));
  return { name: canonical || city, inputName: city, countryCode: canonical || explicitlyTaiwan ? 'TW' : null };
}

export function weatherPlaceSearchUrl(base, city, language, count) {
  const query = weatherPlaceQuery(city);
  const url = new URL(base);
  url.searchParams.set('name', query.name);
  url.searchParams.set('count', String(count));
  url.searchParams.set('language', language === 'zh-TW' ? 'zh' : language);
  url.searchParams.set('format', 'json');
  if (query.countryCode) url.searchParams.set('countryCode', query.countryCode);
  return { url, countryCode: query.countryCode };
}
