<template>
  <section class="page active demo-home" id="homePage">
    <template v-if="!isMember">
      <div class="guest-hero">
        <div class="guest-hero-visual">
          <picture class="hero-photo">
            <source
              srcset="/assets/ootie-home-hero-v2-720.webp 720w, /assets/ootie-home-hero-v2-1024.webp 1024w"
              sizes="(max-width: 768px) calc(100vw - 32px), 430px"
              type="image/webp"
            />
            <img
              src="/assets/ootie-home-hero-v2-1024.webp"
              width="1024"
              height="1536"
              fetchpriority="high"
              decoding="async"
              alt="在明亮衣櫥前挑選柔黃色針織衫的穿搭情境"
            />
          </picture>
          <div class="hero-wardrobe-doors" aria-hidden="true">
            <span class="hero-door hero-door-left"></span>
            <span class="hero-door hero-door-right"></span>
          </div>
          <span class="hero-photo-note" aria-hidden="true">my closet,<br />my rhythm ♡</span>
          <span class="hero-color-ticket" aria-hidden="true">PINK · BUTTER · SKY</span>
        </div>
        <div class="guest-hero-copy">
          <h1>今天，<br /><span>穿出自己的節奏。</span></h1>
          <p>從你已經擁有的衣服開始，整理衣櫥、找到靈感，再用 AI 看見更多搭配可能。</p>
          <div class="hero-actions"><button class="primary" @click="openLogin">開始建立我的衣櫥</button><router-link class="secondary" to="/explore">看看大家怎麼穿</router-link></div>
          <p class="hero-trust-line">數位衣櫥 · AI Styling · 衣友靈感</p>
        </div>
      </div>

      <section class="home-section">
        <div class="section-heading"><div><p class="eyebrow">Trending this week</p><h2>最近最受歡迎的穿搭</h2></div><router-link class="text-link" to="/explore">探索更多 →</router-link></div>
        <div class="trending-strip"><button v-for="post in guestTrendingPosts" :key="post.id" class="trending-card" @click="openPost(post)"><span class="trending-media"><img :src="post.image" :alt="`${post.username} 的穿搭`" loading="lazy" decoding="async" /></span><span>{{ post.username }}</span><strong>{{ post.caption }}</strong><small>♥ {{ post.likes || 0 }} · {{ relativeDate(post.created_at) }}</small></button></div>
      </section>

      <section class="capability-grid home-section" aria-label="OOTIE 功能">
        <router-link class="capability-card closet-card" to="/closet"><div class="capability-copy"><span>01 · MY CLOSET</span><h3>數位衣櫥</h3><p>整理分類、穿著次數與單品狀態，讓衣服真的被看見。</p></div><img v-if="trendingPosts[1]?.image" :src="trendingPosts[1].image" alt="衣櫥穿搭靈感" loading="lazy" decoding="async" /></router-link>
        <router-link class="capability-card styling-card" to="/ai"><div class="capability-copy"><span>02 · STYLE WITH AI</span><h3>AI Styling</h3><p>只從你真實擁有的衣服中，提出可執行的穿搭建議。</p></div><img v-if="trendingPosts[2]?.image" :src="trendingPosts[2].image" alt="AI 穿搭靈感" loading="lazy" decoding="async" /></router-link>
        <router-link class="capability-card tryon-card" to="/tryon"><div class="capability-copy"><span>03 · TRY YOUR LOOK</span><h3>虛擬試穿</h3><p>以人物照與衣物圖建立單件試穿或整套 AI 穿搭預覽。</p></div><img v-if="trendingPosts[3]?.image" :src="trendingPosts[3].image" alt="虛擬試穿靈感" loading="lazy" decoding="async" /></router-link>
        <router-link class="capability-card sos-card" to="/sos"><div class="capability-copy"><span>04 · BETTER TOGETHER</span><h3>Style SOS</h3><p>把猶豫交給衣友，取得具體、可收藏的搭配提案。</p></div><img v-if="trendingPosts[4]?.image" :src="trendingPosts[4].image" alt="Style SOS 穿搭靈感" loading="lazy" decoding="async" /></router-link>
      </section>

      <section class="final-cta"><p class="eyebrow">Ready when you are</p><h2>從你已經擁有的衣服開始。</h2><button class="primary" @click="openLogin">登入並開啟衣櫥</button></section>
    </template>

    <template v-else>
      <div class="home-header-row member-home-header">
        <div><p class="member-greeting">歡迎回來，{{ firstName }}</p><h1>今天想穿什麼？</h1><p class="intro">先看看衣櫥裡有什麼，再決定今天的搭配。</p></div>
        <div class="weather-widget">
          <div class="weather-pill" role="status" aria-live="polite"><span>{{ weatherState.icon }}</span> {{ weatherState.label }}</div>
          <form class="weather-city-form" @submit.prevent="loadCityWeather">
            <label class="sr-only" for="weatherCity">選擇城市</label>
            <input id="weatherCity" v-model="weatherCity" placeholder="輸入城市" />
            <button type="submit" :disabled="weatherState.loading">套用</button>
            <button type="button" :disabled="weatherState.loading" @click="loadLocationWeather">使用定位</button>
          </form>
          <small v-if="weatherState.error">{{ weatherState.error }}</small>
        </div>
      </div>

      <nav class="member-summary-row" aria-label="會員摘要">
        <router-link to="/closet" class="summary-item"><span>衣櫥</span><strong>{{ appStore.items.length }} 件</strong><small>查看單品</small></router-link>
        <router-link to="/membership" class="summary-item"><span>點數</span><strong>{{ subscriptionStore.pointsBalance }}</strong><small>{{ subscriptionStore.currentPlan }}</small></router-link>
        <router-link to="/sos" class="summary-item"><span>SOS</span><strong>{{ openSosCount }} 則</strong><small>查看求救</small></router-link>
      </nav>

      <section class="member-ai-card">
        <div><h2>從自己的衣服，搭出今天的樣子。</h2><p>先取得穿搭建議，再選擇單件虛擬試穿或整套 AI 穿搭預覽。</p></div>
        <div class="hero-actions"><router-link class="primary" to="/ai">取得 AI 穿搭建議</router-link><router-link class="secondary" to="/tryon">開啟虛擬試穿</router-link></div>
      </section>

      <section class="home-section">
        <div class="section-heading"><h2>最近加入衣櫥</h2><router-link class="text-link" to="/closet">查看全部 →</router-link></div>
        <div v-if="recentItems.length" class="recent-row"><button v-for="item in recentItems" :key="item.id" class="recent-card" @click="openDetail(item.id)"><div class="item-image"><img class="product-image" :src="item.photo" :alt="item.name_zh || item.name" loading="lazy" decoding="async" /></div><h3>{{ item.name_zh || item.name }}</h3></button></div>
        <div v-else class="empty-state">衣櫥尚無單品，先加入第一件衣服。</div>
      </section>

      <section class="home-section">
        <div class="section-heading"><h2>本週熱門靈感</h2><router-link class="text-link" to="/explore">探索更多 →</router-link></div>
        <div class="trending-strip"><button v-for="post in trendingPosts" :key="post.id" class="trending-card" @click="openPost(post)"><span class="trending-media"><img :src="post.image" :alt="`${post.username} 的穿搭`" loading="lazy" decoding="async" /></span><span>{{ post.username }}</span><strong>{{ post.caption }}</strong><small>♥ {{ post.likes || 0 }} · {{ relativeDate(post.created_at) }}</small></button></div>
      </section>
    </template>
  </section>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAppStore } from '@/stores/app';
import { useAuthStore } from '@/stores/auth';
import { useClosetStore } from '@/stores/closet';
import { uniquePostsById, useOotdStore } from '@/stores/ootd';
import { useSosStore } from '@/stores/sos';
import { useSubscriptionStore } from '@/stores/subscription';
import { fetchWeatherAt, fetchWeatherForCity, getBrowserPosition } from '@/services/weather';
import { upsertPrivateProfile } from '@/services/profileRepository';

const router = useRouter();
const appStore = useAppStore();
const authStore = useAuthStore();
const closetStore = useClosetStore();
const ootdStore = useOotdStore();
const sosStore = useSosStore();
const subscriptionStore = useSubscriptionStore();
const isMember = computed(() => authStore.isMember);
const firstName = computed(() => (appStore.profile.name || '衣友').split(' ')[0]);
const recentItems = computed(() => appStore.items.slice(0, 4));
const openSosCount = computed(() => sosStore.sosPosts.filter((post) => post.status === 'OPEN').length);
const datedPosts = computed(() => uniquePostsById(appStore.ootdPosts).filter((post) => post.image));
const trendingPosts = computed(() => {
  const since = Date.now() - 7 * 86400000;
  const recent = datedPosts.value.filter((post) => {
    const time = new Date(post.created_at || post.createdAt || 0).getTime();
    return Number.isFinite(time) && time >= since;
  });
  return (recent.length ? recent : datedPosts.value).slice().sort((a, b) => Number(b.likes || 0) - Number(a.likes || 0)).slice(0, 8);
});
const guestTrendingPosts = computed(() => trendingPosts.value);
const weatherState = ref({ icon: '◌', label: '天氣資料載入中', loading: true, error: '' });
const weatherCity = ref('');

const openLogin = () => authStore.openAuthModal('login', null, '/');
const openPost = (post) => router.push({ name: 'OotdDetail', params: { id: post.id }, query: { user: post.username, from: 'home' } });
const openDetail = (id) => { appStore.selectedItemId = id; appStore.isDetailOpen = true; };
const relativeDate = (value) => {
  const time = new Date(value || 0).getTime();
  if (!Number.isFinite(time)) return '近期';
  const days = Math.max(0, Math.floor((Date.now() - time) / 86400000));
  return days === 0 ? '今天' : days === 1 ? '昨天' : `${days} 天前`;
};
const applyWeather = (weather) => {
  weatherState.value = { icon: weather.icon, label: `${weather.temperature}°C · ${weather.city || weather.summary}`, loading: false, error: '' };
};
const loadCityWeather = async () => {
  weatherState.value = { ...weatherState.value, loading: true, error: '' };
  try {
    const weather = await fetchWeatherForCity(weatherCity.value);
    applyWeather(weather);
    weatherCity.value = weather.city;
    if (authStore.profileId) await upsertPrivateProfile(authStore.profileId, { weather_city: weather.city });
  } catch (error) {
    weatherState.value = { icon: '—', label: '天氣暫時無法取得', loading: false, error: error?.message || '天氣服務暫時無法使用。' };
  }
};
const loadLocationWeather = async () => {
  weatherState.value = { ...weatherState.value, loading: true, error: '' };
  try {
    const position = await getBrowserPosition();
    applyWeather(await fetchWeatherAt({ ...position, city: '目前位置' }));
  } catch (error) {
    weatherState.value = { icon: '—', label: '請選擇城市', loading: false, error: error?.message || '目前無法取得位置。' };
  }
};
const loadWeather = async () => {
  if (!authStore.isMember) return;
  const privateProfile = await authStore.loadPrivateAccount();
  if (privateProfile?.weather_city) {
    weatherCity.value = privateProfile.weather_city;
    await loadCityWeather();
  } else {
    await loadLocationWeather();
  }
};
const loadMemberData = async (profileId) => {
  if (!profileId) return;
  await Promise.allSettled([closetStore.loadRemoteItems(profileId), subscriptionStore.refresh()]);
};
watch(() => authStore.profileId, async (profileId) => {
  await loadMemberData(profileId);
  if (profileId) await loadWeather();
}, { immediate: true });
onMounted(() => { ootdStore.loadRemotePosts(); });
</script>

<style scoped>
.demo-home .text-link{display:inline-flex;min-height:44px;align-items:center}
.demo-home,.home-section{min-width:0;max-width:100%}.demo-home{--home-radius:28px}.guest-hero{display:grid;grid-template-columns:minmax(0,.9fr) minmax(440px,1.1fr);gap:clamp(34px,5vw,76px);align-items:center;min-height:640px;padding:28px 0 76px}.guest-hero-copy{position:relative;z-index:2}.guest-hero-copy h1{max-width:700px;margin-bottom:22px;font-family:"DM Sans",sans-serif;font-size:clamp(50px,5.4vw,78px);font-weight:750;letter-spacing:-.055em;line-height:1.04}.guest-hero-copy>p:not(.eyebrow){max-width:590px;font-size:18px;line-height:1.75;color:var(--muted)}.hero-actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:28px}.hero-actions a,.hero-actions button{display:inline-flex;min-height:48px;align-items:center;justify-content:center}.guest-hero .hero-actions>*{min-width:190px}.guest-hero-visual{position:relative;min-height:570px;padding:34px 54px 24px 12px}.hero-polaroid{position:relative;z-index:1;padding:12px 12px 26px;background:var(--surface-raised);box-shadow:0 28px 64px rgba(42,38,48,.14);transform:rotate(-1.4deg)}.hero-polaroid>img{display:block;width:100%;height:500px;object-fit:cover}.hero-caption{position:absolute;left:30px;right:30px;bottom:44px;padding:18px 20px;border:1px solid rgba(255,255,255,.72);border-radius:18px;background:rgba(255,253,248,.91);box-shadow:0 12px 30px rgba(28,28,31,.10);backdrop-filter:blur(12px);display:grid;gap:5px;text-align:left}.hero-caption span{font-size:10px;letter-spacing:2.2px;color:var(--accent-violet-ink)}.hero-caption small{color:var(--muted)}.hero-note-sticker{position:absolute;z-index:2;top:2px;right:-8px;width:clamp(142px,15vw,205px);height:auto;transform:rotate(4deg);filter:drop-shadow(0 14px 16px rgba(53,45,57,.13));pointer-events:none}.home-section{margin:72px 0}.section-heading>div h2{margin-bottom:0;font-family:"DM Sans",sans-serif;font-size:clamp(30px,3vw,42px);font-weight:720;letter-spacing:-.035em}.trending-strip{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(230px,292px);gap:18px;max-width:100%;overflow-x:auto;padding:5px 5px 24px;scroll-snap-type:x mandatory;scroll-behavior:smooth}.trending-card{border:1px solid rgba(34,33,35,.05);background:var(--surface-raised);padding:0 0 18px;border-radius:22px;overflow:hidden;text-align:left;scroll-snap-align:start;box-shadow:var(--shadow-soft);transition:transform .2s ease,box-shadow .2s ease}.trending-card:hover{transform:translateY(-5px) rotate(-.25deg);box-shadow:var(--shadow-hover)}.trending-card img{width:100%;height:320px;object-fit:cover;transition:transform .35s ease}.trending-card:hover img{transform:scale(1.025)}.trending-card span,.trending-card strong,.trending-card small{display:block;margin:10px 17px 0}.trending-card span{color:var(--accent-violet-ink);font-size:12px}.trending-card strong{line-height:1.45}.trending-card small{color:var(--muted)}.capability-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.capability-card{position:relative;min-height:220px;display:grid;grid-template-columns:minmax(0,1fr) 42%;align-items:stretch;overflow:hidden;border:1px solid rgba(34,33,35,.06);border-radius:26px;background:var(--surface-raised);box-shadow:0 10px 30px rgba(48,43,51,.05);transition:transform .2s ease,box-shadow .2s ease}.capability-card:hover{transform:translateY(-4px);box-shadow:var(--shadow-hover)}.capability-copy{align-self:center;padding:30px}.capability-card span{color:var(--accent-violet-ink);font-size:10px;font-weight:700;letter-spacing:1.5px}.capability-card h3{margin:9px 0 10px;font-family:"DM Sans",sans-serif;font-size:26px;letter-spacing:-.025em}.capability-card p{margin:0;color:var(--muted);line-height:1.65}.capability-card>img{width:100%;height:100%;min-height:220px;object-fit:cover}.closet-card{background:var(--accent-pink-soft)}.styling-card{background:var(--accent-yellow-soft)}.tryon-card{background:var(--accent-blue-soft)}.sos-card{background:var(--accent-lavender-soft)}.final-cta{position:relative;overflow:hidden;margin:86px 0 20px;padding:58px;border:1px solid rgba(111,101,161,.08);border-radius:32px;background:var(--accent-lavender-soft);text-align:center}.final-cta h2{font-family:"DM Sans",sans-serif;font-size:clamp(30px,4vw,48px);font-weight:720;letter-spacing:-.04em}.member-home-header{align-items:flex-start}.member-summary-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.summary-card{padding:24px;background:var(--surface-raised);border:1px solid var(--line);border-radius:22px;box-shadow:var(--shadow-soft);transition:transform .2s ease}.summary-card:hover{transform:translateY(-3px)}.summary-card span,.summary-card small{display:block;color:var(--muted)}.summary-card strong{display:block;font:700 40px/1.1 "DM Sans",sans-serif;margin:8px 0}.summary-card.points{background:var(--accent-lavender-soft)}.member-ai-card{display:flex;justify-content:space-between;gap:24px;align-items:center;margin:28px 0 52px;padding:36px;border-radius:26px;background:var(--ink);color:white;box-shadow:0 20px 42px rgba(28,27,30,.16)}.member-ai-card p{color:#dedde2;max-width:630px}.member-ai-card .eyebrow{color:#cfc8ff}.recent-card{border:0;text-align:left;background:transparent}@media(max-width:1180px){.guest-hero{grid-template-columns:minmax(0,.9fr) minmax(390px,1.1fr)}.hero-note-sticker{right:0}.capability-copy{padding:24px}}@media(max-width:1024px){.guest-hero{grid-template-columns:1fr;min-height:0}.guest-hero-copy{max-width:760px}.guest-hero-visual{min-height:540px;padding-right:70px}.hero-polaroid>img{height:470px}.member-ai-card{display:block}}@media(max-width:768px){.guest-hero{display:flex;flex-direction:column;gap:24px;padding:4px 0 44px}.guest-hero-copy h1{font-size:clamp(40px,12vw,54px);line-height:1.03}.guest-hero-copy>p:not(.eyebrow){font-size:16px}.guest-hero-visual{width:100%;min-height:430px;padding:24px 4px 12px}.hero-polaroid{padding:8px 8px 18px}.hero-polaroid>img{height:390px}.hero-caption{left:20px;right:20px;bottom:28px;padding:15px}.hero-note-sticker{top:-8px;right:-8px;width:126px}.home-section{margin:54px 0}.section-heading{align-items:flex-end}.text-link{white-space:nowrap}.trending-strip{grid-auto-columns:78vw;gap:13px}.trending-card img{height:300px}.capability-grid,.member-summary-grid{grid-template-columns:1fr}.capability-card{min-height:190px;grid-template-columns:minmax(0,1fr) 38%}.capability-copy{padding:22px}.capability-card>img{min-height:190px}.final-cta{padding:38px 22px}.member-ai-card{padding:26px}.hero-actions>*{width:100%}}@media(max-width:420px){.hero-note-sticker{width:108px;right:-12px}.hero-caption strong{font-size:13px}.capability-card{grid-template-columns:1fr}.capability-card>img{height:150px;min-height:0}.capability-copy{padding:22px}.section-heading{gap:14px}}@media(prefers-reduced-motion:reduce){.trending-card,.trending-card img,.capability-card,.summary-card{transition:none}}
.guest-hero-copy h1{font-size:clamp(48px,4.4vw,66px)}
.weather-widget{display:grid;justify-items:end;gap:7px;max-width:420px}.weather-city-form{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}.weather-city-form input{width:132px;min-height:40px;padding:0 11px;border:1px solid var(--line);border-radius:12px;background:var(--surface-raised)}.weather-city-form button{min-height:40px;padding:0 12px;border:1px solid var(--line);border-radius:12px;background:var(--surface-raised);font-weight:700;cursor:pointer}.weather-city-form button:disabled{opacity:.55;cursor:wait}.weather-widget small{color:#92564f}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.guest-hero{position:relative;grid-template-columns:minmax(0,.82fr) minmax(440px,1.18fr);padding:34px clamp(18px,3vw,44px) 76px;border-radius:0 0 38px 38px;background:linear-gradient(135deg,rgba(255,240,243,.82),rgba(255,248,220,.56) 46%,rgba(232,247,255,.76));overflow:hidden}.guest-hero-copy{z-index:3}.guest-hero-copy h1{margin:4px 0 22px;font-size:clamp(58px,6.5vw,94px);font-weight:800;letter-spacing:-.065em;line-height:.92}.guest-hero-copy>p:not(.eyebrow){max-width:520px}.hero-polaroid{border:1px solid rgba(255,255,255,.8);box-shadow:0 28px 64px rgba(61,49,68,.16)}.hero-doodle{position:absolute;z-index:2;font-family:"Segoe Print","Bradley Hand",cursive;font-weight:700;line-height:1.2;pointer-events:none}.hero-doodle-one{right:2px;bottom:0;color:#e46589;transform:rotate(-7deg);font-size:15px}.hero-doodle-two{left:-4px;bottom:70px;padding:10px 12px;background:var(--accent-yellow);color:var(--ink);font-size:11px;transform:rotate(-8deg);box-shadow:0 8px 18px rgba(69,55,33,.12)}
@media(max-width:1024px){.guest-hero{padding-left:34px;padding-right:34px}.hero-doodle-one{right:20px}}
@media(max-width:768px){.guest-hero{padding:18px 14px 42px;border-radius:0 0 28px 28px}.guest-hero-copy h1{font-size:clamp(54px,18vw,78px)}.hero-doodle-two{left:8px;bottom:30px}.hero-doodle-one{right:10px;bottom:2px;font-size:12px}}
@media(max-width:768px){.weather-widget{width:100%;justify-items:stretch}.weather-city-form{justify-content:stretch}.weather-city-form input{flex:1;min-width:120px}}
.hero-polaroid>img{object-fit:contain;object-position:center;background:var(--paper)}
.trending-media{display:grid!important;place-items:center;width:100%;aspect-ratio:4/5;margin:0!important;overflow:hidden;background:linear-gradient(145deg,var(--paper),#f4f0eb)}
.trending-card .trending-media img{display:block;width:100%;height:100%;object-fit:contain;object-position:center}
.trending-card>span:not(.trending-media),.trending-card strong,.trending-card small{display:block;margin:10px 17px 0}
.trending-card>span:not(.trending-media){color:var(--accent-violet-ink);font-size:12px}
.capability-card>img{object-fit:contain;object-position:center;background:rgba(255,255,255,.48)}

/* Mobile-first brand hero v2: dedicated media, clear product action, wardrobe reveal. */
.demo-home .guest-hero{
  position:relative;
  display:block;
  min-height:0;
  padding:0;
  border-radius:0;
  background:transparent;
  overflow:visible;
}
.demo-home .guest-hero-visual{
  position:relative;
  width:100%;
  min-height:0;
  aspect-ratio:2 / 3;
  padding:0;
  overflow:hidden;
  border-radius:24px;
  background:#eaf3f7;
  box-shadow:0 22px 54px rgba(47,42,48,.14);
  isolation:isolate;
}
.hero-photo,.hero-photo img{display:block;width:100%;height:100%}
.hero-photo{position:absolute;inset:0}
.hero-photo img{
  object-fit:cover;
  object-position:center;
  animation:hero-photo-settle .8s cubic-bezier(.16,1,.3,1) both;
}
.hero-wardrobe-doors{position:absolute;inset:0;z-index:2;display:grid;grid-template-columns:1fr 1fr;pointer-events:none}
.hero-door{position:relative;background:linear-gradient(145deg,#fff9f1,#f4e3df);box-shadow:inset 0 0 0 1px rgba(60,51,54,.07);will-change:transform}
.hero-door::after{content:"";position:absolute;top:50%;width:5px;height:36px;border-radius:999px;background:#1f1d20;opacity:.72}
.hero-door-left{transform-origin:left center;animation:hero-door-left .82s .12s cubic-bezier(.7,0,.18,1) both}
.hero-door-left::after{right:12px}
.hero-door-right{transform-origin:right center;animation:hero-door-right .82s .12s cubic-bezier(.7,0,.18,1) both}
.hero-door-right::after{left:12px}
.hero-photo-note{
  position:absolute;
  z-index:3;
  top:18px;
  right:14px;
  max-width:116px;
  padding:10px 12px;
  color:#242125;
  background:#ffe99a;
  box-shadow:0 10px 24px rgba(78,61,24,.12);
  font-family:"Segoe Print","Bradley Hand",cursive;
  font-size:12px;
  font-weight:700;
  line-height:1.3;
  transform:rotate(3deg);
}
.hero-color-ticket{
  position:absolute;
  z-index:3;
  left:14px;
  top:18px;
  padding:8px 10px;
  border-radius:999px;
  color:#2a2730;
  background:#e5dcff;
  font-size:9px;
  font-weight:800;
  letter-spacing:.12em;
}
.demo-home .guest-hero-copy{
  position:absolute;
  z-index:4;
  left:12px;
  right:12px;
  bottom:12px;
  padding:20px 18px 16px;
  border-radius:16px;
  background:rgba(255,251,246,.96);
  box-shadow:0 18px 36px rgba(41,35,42,.15);
  backdrop-filter:blur(10px);
}
.demo-home .guest-hero-copy h1{
  max-width:100%;
  margin:0 0 10px;
  color:var(--ink);
  font-family:"DM Sans","Noto Sans TC",sans-serif;
  font-size:clamp(33px,9.5vw,40px);
  font-weight:800;
  letter-spacing:-.035em;
  line-height:1.03;
  text-wrap:balance;
}
.demo-home .guest-hero-copy h1 span{font-size:.77em;font-weight:730;letter-spacing:-.02em}
.demo-home .guest-hero-copy>p:not(.hero-trust-line){max-width:36em;margin:0;color:#635a60;font-size:14px;line-height:1.55}
.demo-home .guest-hero .hero-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:16px}
.demo-home .guest-hero .hero-actions>*{width:auto;min-width:0;min-height:46px;padding:0 12px;font-size:13px;white-space:nowrap}
.hero-trust-line{margin:12px 0 0!important;color:#766d73!important;font-size:11px!important;font-weight:650;letter-spacing:.02em;text-align:center}

@keyframes hero-door-left{0%{transform:translateX(0)}100%{transform:translateX(-103%)}}
@keyframes hero-door-right{0%{transform:translateX(0)}100%{transform:translateX(103%)}}
@keyframes hero-photo-settle{0%{transform:scale(1.035);filter:saturate(.86)}100%{transform:scale(1);filter:saturate(1)}}

@media(min-width:680px){
  .demo-home .guest-hero{
    display:grid;
    grid-template-columns:minmax(0,1fr) minmax(360px,430px);
    gap:clamp(38px,5vw,78px);
    align-items:center;
    min-height:660px;
    padding:36px clamp(34px,5vw,74px);
    border-radius:30px;
    background:linear-gradient(125deg,#fff0f3 0%,#fff8df 48%,#e7f5fb 100%);
    overflow:hidden;
  }
  .demo-home .guest-hero::after{
    content:"";
    position:absolute;
    width:180px;
    height:180px;
    right:-65px;
    bottom:-70px;
    border-radius:50%;
    background:#ddd1ff;
    opacity:.5;
  }
  .demo-home .guest-hero-visual{grid-column:2;grid-row:1;width:min(100%,430px);border-radius:18px}
  .demo-home .guest-hero-copy{
    position:relative;
    grid-column:1;
    grid-row:1;
    left:auto;
    right:auto;
    bottom:auto;
    max-width:620px;
    padding:0;
    border-radius:0;
    background:transparent;
    box-shadow:none;
    backdrop-filter:none;
  }
  .demo-home .guest-hero-copy h1{margin-bottom:22px;font-size:clamp(54px,5.5vw,78px);line-height:.98}
  .demo-home .guest-hero-copy h1 span{font-size:.72em}
  .demo-home .guest-hero-copy>p:not(.hero-trust-line){font-size:17px;line-height:1.72}
  .demo-home .guest-hero .hero-actions{display:flex;gap:10px;margin-top:26px}
  .demo-home .guest-hero .hero-actions>*{min-width:184px;min-height:50px;padding:0 22px;font-size:14px}
  .hero-trust-line{text-align:left;margin-top:17px!important;font-size:12px!important}
  .hero-photo-note{top:24px;right:-10px;font-size:13px}
  .hero-color-ticket{top:auto;bottom:20px;left:18px}
}

@media(min-width:680px) and (max-width:1024px){
  .demo-home .guest-hero{grid-template-columns:minmax(0,1fr) 340px;gap:28px;padding:32px;min-height:590px}
  .demo-home .guest-hero-copy h1{font-size:50px}
  .demo-home .guest-hero .hero-actions{display:grid;grid-template-columns:1fr}
}

@media(max-width:350px){
  .demo-home .guest-hero-copy{padding:17px 15px 14px}
  .demo-home .guest-hero-copy h1{font-size:31px}
  .demo-home .guest-hero .hero-actions{grid-template-columns:1fr}
  .hero-color-ticket{display:none}
}

/* Member home keeps the fashion content open and uses dividers instead of a card wall. */
.member-greeting{margin:0 0 8px;color:var(--muted);font-size:14px;font-weight:700}
.member-summary-row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));margin:8px 0 30px;border-block:1px solid var(--line)}
.summary-item{min-width:0;display:grid;gap:4px;padding:20px 22px;border-right:1px solid var(--line);transition:background var(--motion-fast) ease}
.summary-item:last-child{border-right:0}
.summary-item:hover{background:rgba(255,255,255,.55)}
.summary-item span,.summary-item small{color:var(--muted);font-size:12px}
.summary-item strong{font:750 25px/1.15 "DM Sans",sans-serif;letter-spacing:-.025em}
.member-ai-card{margin:0 0 52px;padding:32px;border-radius:16px;box-shadow:none}
.member-ai-card h2{margin-bottom:10px;font-size:clamp(26px,3vw,38px);letter-spacing:-.035em}

@media(max-width:620px){
  .member-home-header{gap:18px}
  .member-summary-row{margin-top:0}
  .summary-item{padding:16px 10px}
  .summary-item strong{font-size:20px}
  .summary-item small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .member-ai-card{padding:24px 20px;border-radius:14px}
}

@media(prefers-reduced-motion:reduce){
  .hero-wardrobe-doors{display:none}
  .hero-photo img{animation:none}
}
</style>
