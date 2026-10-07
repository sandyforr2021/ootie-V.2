import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { buildDemoQualityReport, demoUuid as uuid, validateDemoSeedSummary } from './demoSeedContract.mjs';
import { buildSocialItems, canonicalItemIdsForPost } from './ootdClosetConsistency.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const required = (name) => {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};
const url = required('SUPABASE_URL').replace(/\/$/, '');
const serviceKey = required('SUPABASE_SERVICE_ROLE_KEY');
const demoEmail = required('OOTIE_DEMO_EMAIL').toLowerCase();
const demoPassword = required('OOTIE_DEMO_PASSWORD');
const reset = String(process.env.OOTIE_DEMO_RESET || '').toLowerCase() === 'true';
const headers = (extra = {}) => ({ apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, ...extra });

const request = async (endpoint, options = {}) => {
  const response = await fetch(`${url}${endpoint}`, { ...options, headers: headers(options.headers) });
  const text = await response.text();
  const body = text ? (() => { try { return JSON.parse(text); } catch { return text; } })() : null;
  if (!response.ok) throw new Error(`${options.method || 'GET'} ${endpoint} failed (${response.status}): ${JSON.stringify(body)}`);
  return body;
};
const upsert = (table, rows, conflict = 'id') => request(`/rest/v1/${table}?on_conflict=${encodeURIComponent(conflict)}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify(rows)
});
const removeIds = async (table, ids) => {
  if (!ids.length) return;
  await request(`/rest/v1/${table}?id=in.(${ids.join(',')})`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
};
const removeByProfile = async (table, profileId) => {
  await request(`/rest/v1/${table}?profile_id=eq.${encodeURIComponent(profileId)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
};
const removeByOwners = async (table, ownerIds) => {
  if (!ownerIds.length) return;
  await request(`/rest/v1/${table}?owner_id=in.(${ownerIds.join(',')})`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
};
const publicUrl = (bucket, objectPath) => `${url}/storage/v1/object/public/${bucket}/${objectPath.split('/').map(encodeURIComponent).join('/')}`;
const upload = async (bucket, objectPath, bytes, mimeType) => request(`/storage/v1/object/${encodeURIComponent(bucket)}/${objectPath.split('/').map(encodeURIComponent).join('/')}`, {
  method: 'POST', headers: { 'Content-Type': mimeType, 'x-upsert': 'true' }, body: bytes
});
const downloadImage = async (source, fallbackPath) => {
  try {
    const response = await fetch(source, { redirect: 'follow' });
    if (!response.ok) throw new Error(String(response.status));
    return { bytes: Buffer.from(await response.arrayBuffer()), mimeType: response.headers.get('content-type')?.split(';')[0] || 'image/jpeg' };
  } catch {
    return { bytes: await readFile(path.join(root, fallbackPath)), mimeType: 'image/png' };
  }
};

const authList = await request('/auth/v1/admin/users?page=1&per_page=1000');
const existingUsers = new Map((authList.users || []).map((user) => [user.email?.toLowerCase(), user]));
const ensureUser = async (email, password, name) => {
  const existing = existingUsers.get(email.toLowerCase());
  if (existing) {
    await request(`/auth/v1/admin/users/${existing.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password, email_confirm: true, user_metadata: { full_name: name, ootie_demo: true } }) });
    return existing;
  }
  const created = await request('/auth/v1/admin/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name: name, ootie_demo: true } }) });
  existingUsers.set(email.toLowerCase(), created);
  return created;
};

const people = [
  ['OOTIE Style Editor','@ootie_style','OS'],['Minji Park','@minji','MJ'],['Sofia Chen','@sofia','SF'],['Nora Lin','@nora','NR'],
  ['Alex Wu','@alex','AX'],['Jules Kao','@jules','JL'],['Ella Chang','@ella','EL'],['Rachel Yu','@rachel','RC'],
  ['Mika Huang','@mika','MK'],['Iris Wang','@iris','IR'],['Theo Lin','@theo','TH'],['Anya Tsai','@anya','AN']
];
const socialPassword = `${demoPassword}-social`;
const users = [];
for (let index = 0; index < people.length; index += 1) {
  const [name] = people[index];
  const email = index === 0 ? demoEmail : `ootie.demo.${index}@dev.example.com`;
  users.push(await ensureUser(email, index === 0 ? demoPassword : socialPassword, name));
}

const knownProfiles = await request(`/rest/v1/ootie_profiles?select=id,user_id,name,display_name,username,initials&user_id=in.(${users.map((user) => user.id).join(',')})`);
const profileIdByUser = new Map(knownProfiles.map((profile) => [profile.user_id, profile.id]));
const profileByUser = new Map(knownProfiles.map((profile) => [profile.user_id, profile]));
const profileIds = people.map((_, index) => profileIdByUser.get(users[index].id) || uuid(`profile-${index}`));
const avatarSources = [
  'photo-1494790108377-be9c29b29330','photo-1534528741775-53994a69daeb','photo-1500648767791-00dcc994a43e','photo-1527980965255-d3b416303d12',
  'photo-1531123897727-8f129e1688ce','photo-1507003211169-0a1dd7228f2d','photo-1544005313-94ddf0286df2','photo-1506794778202-cad84cf45f1d',
  'photo-1520813792240-56fc4a3765a7','photo-1488426862026-3ee34a7d66df','photo-1547425260-76bcadfb4f2c','photo-1524504388940-b1c1722653e1'
];
const profiles = [];
for (let index = 0; index < people.length; index += 1) {
  const [name, username, initials] = people[index];
  const avatarPath = `avatars/${users[index].id}/demo-avatar.jpg`;
  const avatar = await downloadImage(`https://images.unsplash.com/${avatarSources[index]}?auto=format&fit=crop&w=320&h=320&q=82`, 'gateway/smoke-assets/person.png');
  await upload('ootie-profile-avatars', avatarPath, avatar.bytes, avatar.mimeType);
  profiles.push({ id: profileIds[index], user_id: users[index].id, name, display_name: name, username, initials, bio: '用衣櫥記錄生活，也分享每天真正穿得出去的靈感。', slogan: '把熟悉的衣服，穿出新的日常。', avatar_url: publicUrl('ootie-profile-avatars', avatarPath), avatar_storage_path: avatarPath, hearts: 40 + index * 17, helped: 3 + index, likes: 25 + index * 11, public_closet: true, created_at: new Date(Date.now() - (200 - index * 7) * 86400000).toISOString() });
}
try {
  await upsert('ootie_profiles', profiles, 'user_id');
} catch (error) {
  if (!String(error?.message || '').includes('DISPLAY_NAME_COOLDOWN')) throw error;
  const cooldownSafeProfiles = profiles.map((profile) => ({
    ...profile,
    display_name: profileByUser.get(profile.user_id)?.display_name || profile.display_name
  }));
  await upsert('ootie_profiles', cooldownSafeProfiles, 'user_id');
  console.warn('Presentation profile names updated; an existing display-name cooldown was preserved.');
}
await upsert('ootie_profile_private', [{ profile_id: profileIds[0], full_name: 'OOTIE Style Editor', birth_date: '1995-10-01', phone: null }], 'profile_id');

const garmentCatalog = [
  ['UNIQLO','白色棉質襯衫','Shirts','White','#F7F4EC','Minimal'],
  ['GU','柔粉針織開襟衫','Knitwear','Pink','#E7BFC1','Soft'],
  ['MUJI','奶油黃圓領針織衫','Knitwear','Yellow','#EAD58C','Casual'],
  ['ZARA','淺藍條紋襯衫','Shirts','Blue','#AFC8DC','Smart Casual'],
  ['COS','炭灰短版西裝外套','Jackets','Gray','#4B4C50','Minimal'],
  ['H&M','米色經典風衣','Coats','Beige','#C7AE8E','Classic'],
  ['MUJI','象牙白羊毛大衣','Coats','White','#E8E0D2','Minimal'],
  ['ZARA','黑色細肩帶洋裝','Dresses','Black','#242325','Chic'],
  ['H&M','淡紫方領洋裝','Dresses','Lavender','#BEB0DD','Sweet'],
  ['GU','丹寧 A 字裙','Skirts','Blue','#55779A','Casual'],
  ['UNIQLO','奶油白百褶裙','Skirts','White','#EEE6D5','Soft'],
  ['Levi’s','經典直筒牛仔褲','Jeans','Blue','#527395','Casual'],
  ['COS','炭灰打褶西裝褲','Trousers','Gray','#55575C','Minimal'],
  ['UNIQLO','米色寬版長褲','Trousers','Beige','#CDB99E','Relaxed'],
  ['GU','淺色丹寧短褲','Shorts','Blue','#9BB5C8','Casual'],
  ['adidas','白色皮革休閒鞋','Sneakers','White','#F4F2EA','Sporty'],
  ['New Balance','灰色慢跑鞋','Sneakers','Gray','#9B9DA2','Sporty'],
  ['Charles & Keith','黑色經典樂福鞋','Loafers','Black','#272629','Classic'],
  ['ZARA','深棕短靴','Boots','Brown','#5A3E32','Chic'],
  ['Charles & Keith','黑色月牙肩背包','Bags','Black','#29282B','Minimal'],
  ['H&M','天空藍托特包','Bags','Blue','#91B8D2','Casual'],
  ['Charles & Keith','奶油黃迷你包','Bags','Yellow','#E8CE75','Sweet'],
  ['MUJI','米白棒球帽','Hats','White','#E7DFD0','Casual'],
  ['GU','海軍藍漁夫帽','Hats','Navy','#293B58','Street'],
  ['COS','銀色圓圈耳環','Accessories','Silver','#C8CBD0','Minimal'],
  ['H&M','小珍珠項鍊','Accessories','White','#F0E9DC','Classic'],
  ['UNIQLO','黑色細版皮帶','Accessories','Black','#252427','Classic'],
  ['ZARA','淡紫絲巾','Accessories','Lavender','#B9A4D8','Chic'],
  ['GU','白色羅紋背心','Tops','White','#F4F1E9','Casual'],
  ['MUJI','海軍藍純棉 T 恤','Tops','Navy','#273752','Minimal'],
  ['H&M','薄荷綠棉質上衣','Tops','Mint','#BFD8C6','Soft'],
  ['COS','灰色麻花針織背心','Knitwear','Gray','#898A8B','Preppy'],
  ['UNIQLO','海軍藍針織外套','Knitwear','Navy','#293950','Classic'],
  ['Levi’s','淺刷色丹寧外套','Jackets','Blue','#88A4B7','Casual'],
  ['GU','橄欖綠工裝外套','Jackets','Green','#667154','Street'],
  ['ZARA','黑色打褶短褲','Shorts','Black','#2B2A2D','Chic'],
  ['UNIQLO','奶油白百慕達短褲','Shorts','White','#E5DDCF','Minimal'],
  ['Charles & Keith','酒紅瑪莉珍鞋','Loafers','Red','#6D2D37','Sweet'],
  ['MUJI','焦糖色芭蕾平底鞋','Loafers','Brown','#A77E5C','Soft'],
  ['H&M','白色帆布鞋','Sneakers','White','#EEECE5','Casual'],
  ['COS','奶油白結構手提包','Bags','White','#E6DDCC','Minimal'],
  ['GU','柔粉針織毛帽','Hats','Pink','#DFAFB9','Casual']
];
const garmentUrls = [];
for (let index = 0; index < garmentCatalog.length; index += 1) {
  // Version the remote object path when the curated capture set changes so
  // Supabase CDN clients do not keep displaying an older closet asset.
  const assetPath = `ootd/${users[0].id}/demo-assets-real-v1/garment-${String(index + 1).padStart(2, '0')}.webp`;
  const bytes = await readFile(path.join(root, 'public', 'demo', 'garments', `${String(index + 1).padStart(2, '0')}.webp`));
  await upload('ootie-ootd-images', assetPath, bytes, 'image/webp');
  garmentUrls.push(publicUrl('ootie-ootd-images', assetPath));
}
const supplementalGarmentPath = `ootd/${users[0].id}/demo-assets-real-v1/garment-43.webp`;
await upload(
  'ootie-ootd-images',
  supplementalGarmentPath,
  await readFile(path.join(root, 'public', 'demo', 'garments', '43.webp')),
  'image/webp'
);
const supplementalGarmentUrl = publicUrl('ootie-ootd-images', supplementalGarmentPath);

const mainItems = garmentCatalog.map(([brand, name, category, color, colorHex, style], index) => {
  return { id: uuid(`main-item-${index}`), owner_id: profileIds[0], name: `${brand} / ${name}`, name_zh: name, brand, category, shape: ['Relaxed','Straight','Cropped','Structured'][index % 4], primary_color: color, secondary_color: index % 3 === 0 ? '無彩色系' : index % 3 === 1 ? '藍綠冷色系' : '大地色系', color_hex: colorHex, style, season: ['All year','Spring / Summer','Autumn / Winter'][index % 3], photo: garmentUrls[index], price: 890 + index * 170, wear_count: (index * 3) % 28, last_worn: new Date(Date.now() - ((index * 7) % 120) * 86400000).toISOString().slice(0, 10), purchase_date: new Date(Date.now() - (300 + index * 8) * 86400000).toISOString().slice(0, 10), favorite: index % 6 === 0, hidden: false, notes: 'OOTIE 展示單品；品牌名稱僅用於情境展示。', created_at: new Date(Date.now() - index * 2 * 86400000).toISOString() };
});
const socialItems = buildSocialItems({ mainItems, profileIds });
if (reset) await removeByOwners('ootie_clothing_items', profileIds.slice(1));
await upsert('ootie_clothing_items', [...mainItems, ...socialItems]);
// The original development smoke item predates the deterministic catalog. If
// it is present, keep its stable row while upgrading its presentation image.
await request(`/rest/v1/ootie_clothing_items?owner_id=eq.${encodeURIComponent(profileIds[0])}&name_zh=eq.${encodeURIComponent('合成鼠尾草綠針織外套')}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
  body: JSON.stringify({ photo: supplementalGarmentUrl })
});

const ootdAssetUrls = [];
for (let index = 0; index < 36; index += 1) {
  const ownerIndex = index % people.length;
  const assetPath = `ootd/${users[ownerIndex].id}/demo-feed/look-${String(index + 1).padStart(2, '0')}.webp`;
  const bytes = await readFile(path.join(root, 'public', 'demo', 'ootd', `${String(index + 1).padStart(2, '0')}.webp`));
  await upload('ootie-ootd-images', assetPath, bytes, 'image/webp');
  ootdAssetUrls.push(publicUrl('ootie-ootd-images', assetPath));
}
const scenarios = [
  ['上班通勤','俐落襯衫和西裝褲，讓早晨會議多一點從容。'],['約會','柔軟色調配輕盈裙裝，舒服也保留約會的心意。'],
  ['咖啡廳','針織與丹寧是坐一下午也自在的咖啡廳組合。'],['朋友聚會','有份量的外套加俐落配件，聊天拍照都剛剛好。'],
  ['正式場合','簡潔線條與深色洋裝，讓正式場合不顯得用力。'],['休閒散步','輕外套配平底鞋，適合河邊走走的慢節奏。'],
  ['下雨天','防風外套、短靴和深色包款，雨天也保持清爽。'],['夏季清爽','透氣上衣和淺色下身，留給炎熱午後更多空氣感。'],
  ['秋冬疊穿','針織、外套與圍巾疊出溫度，也維持乾淨比例。'],['韓系','短版外套配高腰下身，完成明亮俐落的韓系日常。'],
  ['日系','低彩度天然材質，穿出安靜耐看的日系層次。'],['極簡','黑白灰只留下輪廓與材質，越簡單越耐看。'],
  ['文青','格紋、針織和皮革小包，適合書店與展覽的午後。'],['街頭','寬鬆輪廓搭球鞋，用層次完成不費力的街頭感。'],
  ['甜美','柔粉與奶油白互相呼應，甜而不膩的週末穿搭。'],['中性','寬版西裝與簡潔內搭，讓比例自由又有精神。'],
  ['黑白','用黑白對比和不同材質，讓無彩色穿搭不單調。'],['大地色','焦糖、米色與象牙白，是秋日最安定的組合。'],
  ['牛仔','丹寧疊丹寧用深淺做區隔，保留復古也不厚重。'],['運動休閒','機能鞋與柔軟上衣，從通勤一路舒服到週末。']
];
const posts = Array.from({ length: 36 }, (_, index) => {
  const author = index % people.length;
  const daysAgo = index < 12 ? index % 7 : 8 + (index % 32);
  const allItems = [...mainItems, ...socialItems];
  const variant = Math.floor(index / people.length);
  const selected = canonicalItemIdsForPost(index).map((id) => allItems.find((item) => item.id === id));
  if (selected.some((item) => !item)) throw new Error(`Missing canonical OOTD item for post ${index + 1}`);
  const [scenario, copy] = scenarios[index % scenarios.length];
  return { id: uuid(`ootd-${index}`), user_id: profileIds[author], image: ootdAssetUrls[index], caption: `${scenario}｜${copy}${variant ? ` 第 ${variant + 1} 種搭法。` : ''}`, item_ids: selected.map((item) => item.id), wearing: selected.map((item) => ({ id: item.id, name: item.name_zh, photo: item.photo })), hashtags: ['#OOTD', `#${scenario}`, ['#明亮日常','#穿搭靈感','#衣櫥再搭配'][variant]], likes: index < 7 ? 210 - index * 17 : 25 + ((index * 23) % 120), comments: 2 + ((index * 5) % 18), created_at: new Date(Date.now() - daysAgo * 86400000 - index * 3600000).toISOString() };
});

const sosPosts = Array.from({ length: 12 }, (_, index) => {
  const author = (index + 1) % people.length;
  const ownItems = socialItems.filter((item) => item.owner_id === profileIds[author]);
  return { id: uuid(`sos-${index}`), user_id: profileIds[author], closet_owner_id: profileIds[author], title: ['重要簡報怎麼穿才有自信？','週末約會想穿得自然又有精神','旅行只能帶三套，怎麼選？','婚禮賓客穿搭需要一點建議'][index % 4], details: '希望使用現有衣櫥完成，重視舒適、比例與場合感。', occasion: ['工作','約會','旅行','聚會'][index % 4], weather: ['微涼','晴天','可能降雨'][index % 3], when_label: ['明天','本週末','下週'][index % 3], vibes: [['Smart Casual','Confident'],['Soft','Minimal'],['Easy','Versatile']][index % 3], closet_item_ids: ownItems.map((item) => item.id), liked_suggestion_ids: [], status: index % 5 === 0 ? 'CLOSED' : 'OPEN', created_at: new Date(Date.now() - (index + 1) * 86400000).toISOString() };
});
const suggestions = Array.from({ length: 18 }, (_, index) => ({ id: uuid(`suggestion-${index}`), sos_id: sosPosts[index % sosPosts.length].id, user_id: profileIds[(index + 3 + Math.floor(index / sosPosts.length)) % profileIds.length], item_ids: mainItems.slice(index % 10, (index % 10) + 3).map((item) => item.id), message: ['先用同色系拉長比例，再用包款增加重點。','保留一件有結構的外套，其他單品選柔軟材質。','鞋款和上衣呼應，整體會更完整。'][index % 3], hearts: 2 + ((index * 7) % 28), created_at: new Date(Date.now() - index * 4200000).toISOString() }));
const likes = [];
for (let postIndex = 0; postIndex < posts.length; postIndex += 1) {
  for (let actor = 0; actor < Math.min(people.length, 2 + (postIndex % 8)); actor += 1) {
    if (profileIds[actor] === posts[postIndex].user_id) continue;
    likes.push({ id: uuid(`like-${postIndex}-${actor}`), post_id: posts[postIndex].id, user_id: profileIds[actor], created_at: new Date(Date.now() - (postIndex % 7) * 86400000).toISOString() });
  }
}
const savedPosts = posts.slice(2, 10).map((post, index) => ({ id: uuid(`saved-${index}`), post_id: post.id, user_id: profileIds[0], created_at: new Date(Date.now() - index * 86400000).toISOString() }));
const savedOutfitTargets = [
  ...posts.slice(2, 8).map((post) => ({ target_type: 'OOTD', target_id: post.id })),
  ...sosPosts.filter((post) => post.status === 'OPEN').slice(0, 2).map((post) => ({ target_type: 'SOS', target_id: post.id }))
];
const savedOutfits = savedOutfitTargets.map((target, index) => ({ id: uuid(`saved-outfit-${index}`), profile_id: profileIds[0], ...target, created_at: new Date(Date.now() - index * 86400000).toISOString() }));
const notificationFixtures = [
  { text: '@anya 喜歡了你的 OOTD。', event_type: 'OOTD_LIKE', actor_profile_id: profileIds[11], entity_id: posts[0].id, target_path: `/ootd/${posts[0].id}` },
  { text: '@theo 回覆了你的穿搭 SOS。', event_type: 'SOS_SUGGESTION', actor_profile_id: profileIds[10], entity_id: sosPosts[0].id, target_path: `/sos?sos=${sosPosts[0].id}` },
  { text: '@nora 開始追蹤你。', event_type: 'FOLLOW', actor_profile_id: profileIds[3], entity_id: uuid('notification-follow-entity'), target_path: `/profile?user=${encodeURIComponent(people[3][1])}` },
  { text: '本月方案點數已加入。', event_type: 'SUBSCRIPTION', actor_profile_id: null, entity_id: uuid('notification-plan-entity'), target_path: '/membership' },
  { text: '生日點數已到帳。', event_type: 'POINTS', actor_profile_id: null, entity_id: uuid('notification-birthday-entity'), target_path: '/membership' },
  { text: 'AI 穿搭預覽已完成。', event_type: 'AI_RESULT', actor_profile_id: null, entity_id: uuid('notification-ai-entity'), target_path: '/tryon' }
];
const notifications = notificationFixtures.map((fixture, index) => ({ id: uuid(`notification-${index}`), user_id: profileIds[0], ...fixture, meta: JSON.stringify({ demo: true, index }), read: index > 2, created_at: new Date(Date.now() - index * 3600000).toISOString() }));

if (reset) {
  await removeIds('ootie_outfit_suggestions', suggestions.map((row) => row.id));
  await removeIds('ootie_sos_posts', sosPosts.map((row) => row.id));
  await removeIds('ootie_post_likes', likes.map((row) => row.id));
  await removeIds('ootie_saved_posts', savedPosts.map((row) => row.id));
  await removeByProfile('ootie_saved_outfits', profileIds[0]);
  await removeIds('ootie_ootd_posts', posts.map((row) => row.id));
  await removeIds('ootie_notifications', notifications.map((row) => row.id));
}
await upsert('ootie_ootd_posts', posts);
await upsert('ootie_post_likes', likes, 'post_id,user_id');
await upsert('ootie_saved_posts', savedPosts);
await upsert('ootie_sos_posts', sosPosts);
await upsert('ootie_saved_outfits', savedOutfits, 'profile_id,target_type,target_id');
await upsert('ootie_outfit_suggestions', suggestions);
await upsert('ootie_notifications', notifications);
await upsert('ootie_demo_subscriptions', [{ profile_id: profileIds[0], plan: 'PLUS', status: 'ACTIVE', monthly_points: 50 }], 'profile_id');
await upsert('ootie_point_transactions', [
  { id: uuid('points-initial'), profile_id: profileIds[0], amount: 140, type: 'MANUAL_ADJUSTMENT', source_key: 'demo-seed:initial', metadata: { label: '初始點數', demo: true } },
  { id: uuid('points-subscription'), profile_id: profileIds[0], amount: 50, type: 'SUBSCRIPTION_GRANT', source_key: 'demo-seed:plus-2026-10', metadata: { plan: 'PLUS', demo: true } },
  { id: uuid('points-promo'), profile_id: profileIds[0], amount: 30, type: 'PROMOTIONAL_REWARD', source_key: 'demo-seed:welcome', metadata: { label: '歡迎獎勵', demo: true } }
]);
await request('/rest/v1/rpc/grant_ootie_birthday_points', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ p_user_id: users[0].id, p_award_year: 2026, p_amount: 25 }) });

const personBytes = await readFile(path.join(root, 'gateway/smoke-assets/person.png'));
const personPath = `person/${users[0].id}/demo-full-body.png`;
const resultPath = `ai-generated/${users[0].id}/${uuid('ai-history')}/result.png`;
await upload('ootie-ai-private', personPath, personBytes, 'image/png');
await upload('ootie-ai-private', resultPath, personBytes, 'image/png');
await upsert('ootie_ai_generations', [{ id: uuid('ai-history'), user_id: users[0].id, generation_type: 'outfit_preview', provider: 'google_cloud', model: 'gemini-3.1-flash-image', status: 'succeeded', source_item_ids: mainItems.slice(0, 3).map((item) => item.id), person_image_path: personPath, result_path: resultPath, result_metadata: { demoSeed: true }, estimated_cost_usd: 0, points_charged: 0, created_at: new Date(Date.now() - 86400000).toISOString(), completed_at: new Date(Date.now() - 86400000 + 12000).toISOString(), saved_at: new Date(Date.now() - 80000000).toISOString() }]);

await writeFile(path.join(root, 'DEMO_ACCOUNT.local.md'), `# OOTIE Development Demo Account\n\nDevelopment only. Never use in Production.\n\n- Email: ${demoEmail}\n- Password: ${demoPassword}\n- User ID: ${users[0].id}\n- Profile ID: ${profileIds[0]}\n\nReseed: run \`npm run seed:demo\`. Reset deterministic demo rows first: set \`OOTIE_DEMO_RESET=true\`.\n`, 'utf8');

const counts = { profiles: profiles.length, mainClosetItems: mainItems.length, socialClosetItems: socialItems.length, ootdPosts: posts.length, likes: likes.length, savedPosts: savedPosts.length, savedOutfits: savedOutfits.length, sosPosts: sosPosts.length, suggestions: suggestions.length, notifications: notifications.length, pointTransactions: 4, aiHistory: 1 };
if (!validateDemoSeedSummary(counts)) throw new Error(`Demo seed count contract failed: ${JSON.stringify(counts)}`);
const quality = buildDemoQualityReport({ clothingItems: mainItems, posts });
if (quality.duplicatePostCount || quality.duplicateExactOutfitCombinationCount) throw new Error(`Demo seed duplication contract failed: ${JSON.stringify(quality)}`);
console.log(JSON.stringify({ ok: true, demoEmail, demoUserId: users[0].id, demoProfileId: profileIds[0], counts, quality }, null, 2));
