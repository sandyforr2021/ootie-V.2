<script setup>
import MediaImage from '@/components/ui/MediaImage.vue';
import { genuineContent } from '@/services/contentAuthenticity';
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAppStore } from '@/stores/app';
import { useAuthStore } from '@/stores/auth';
import { useClosetStore } from '@/stores/closet';
import { useSocialStore } from '@/stores/social';
import { uniquePostsById, useOotdStore } from '@/stores/ootd';
import AppIcon from '@/components/ui/AppIcon.vue';
import BrandHome from '@/components/home/BrandHome.vue';
import { itemName, itemPhoto } from '@/services/itemPresentation';
import WeatherWardrobe from '@/components/closet/WeatherWardrobe.vue';
import HomeWeather from '@/components/home/HomeWeather.vue';
import TranslatedText from '@/components/ootd/TranslatedText.vue';
import { locale } from '@/i18n';
const router = useRouter();
const appStore = useAppStore();
const authStore = useAuthStore();
const closetStore = useClosetStore();
const ootdStore = useOotdStore();
const socialStore = useSocialStore();
const isMember = computed(() => authStore.isMember);
const firstName = computed(() => (appStore.profile.name || '').split(' ')[0]);
const recentItems = computed(() => appStore.items.slice(0, 4));
const followingPosts = computed(() => uniquePostsById(genuineContent(appStore.ootdPosts))
  .filter(post => post.image && socialStore.isFollowing({id: post.user_id, username: post.username}))
  .sort((a,b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)).slice(0, 4));
const discoveryPosts = computed(() => {
  const authors = new Set();
  return uniquePostsById(genuineContent(appStore.ootdPosts)).filter(post => {
    if (!post.image || !post.username || !post.user_id || post.user_id === authStore.profileId || authors.has(post.user_id)) return false;
    authors.add(post.user_id);
    return true;
  }).slice(0, 3);
});
const homePosts = computed(() => followingPosts.value.length ? followingPosts.value : discoveryPosts.value);
const isDiscovery = computed(() => !followingPosts.value.length);
const followAuthor = post => socialStore.toggleFollow({ id: post.user_id, username: post.username,
  display_name: post.display_name, initials: post.initials, avatar_url: post.avatar_url });
const clock=ref(new Date());
const clockTimer=setInterval(()=>{clock.value=new Date();},1000);
const clockParts = computed(() => [clock.value.getHours(), clock.value.getMinutes(), clock.value.getSeconds()].map(value => String(value).padStart(2, '0')));
const clockDate = computed(() => new Intl.DateTimeFormat(locale.value, { month: 'short', day: 'numeric', weekday: 'short' }).format(clock.value));
onBeforeUnmount(()=>clearInterval(clockTimer));
const openPost = post => router.push({ name: 'OotdDetail', params: { id: post.id }, query: { user: post.username, from: 'home' } });
const openDetail = id => { appStore.selectedItemId = id; appStore.isDetailOpen = true; };
watch(() => authStore.profileId, id => {
  if (id) { void closetStore.loadRemoteItems(id); void ootdStore.loadRemotePosts({unfiltered:true}); }
}, { immediate: true });
</script>

<template>
  <BrandHome v-if="!authStore.isLoggedIn" />
  <section v-else class="page active atelier-home app-page" id="homePage">
    <p v-if="!isMember" role="status">{{ $t('正在開啟頁面…') }}</p>
    <header v-if="isMember" class="member-dashboard-heading ootie-page-heading">
      <h1>{{ $t('歡迎回來，') }} {{ firstName }}</h1>
      <div class="home-now"><HomeWeather/><time class="dashboard-clock" :datetime="clock.toISOString()">
        <span class="clock-date">{{ clockDate }}</span>
        <span class="clock-digits"><template v-for="(part, index) in clockParts" :key="index"><span v-if="index" class="clock-colon">:</span><span :class="{ 'clock-seconds': index === 2 }">{{ part }}</span></template></span>
      </time></div>
    </header>

    <WeatherWardrobe v-if="isMember" />

    <section v-if="isMember && homePosts.length" class="home-section">
      <div class="section-heading"><h2>{{ $t(isDiscovery ? '發現穿搭' : '追蹤中的貼文') }}</h2><router-link class="atelier-text-link" to="/explore">{{ $t('探索更多') }}<AppIcon name="Explore" :size="19" /></router-link></div>
      <div class="following-journal" :class="{ 'discovery-journal': isDiscovery }">
        <article v-for="post in homePosts" :key="post.id" class="following-card">
          <button class="following-photo" :aria-label="$t('查看貼文')" @click="openPost(post)"><MediaImage :src="post.image" :alt="post.caption || post.username" loading="lazy" /></button>
          <div class="following-author"><MediaImage v-if="post.avatar_url" :src="post.avatar_url" alt="" loading="lazy" /><span v-else class="author-initials" aria-hidden="true">{{ (post.display_name || post.username || '').slice(0, 2).toUpperCase() }}</span><span>{{ post.display_name || post.username }}</span></div>
          <button v-if="isDiscovery" class="discovery-follow" :disabled="socialStore.pendingProfileIds.includes(post.user_id)" @click="followAuthor(post)">{{ $t('追蹤') }}</button>
          <TranslatedText :content-id="post.id" :text="post.caption" :source-language="post.caption_language" compact understated hide-source-selector />
          <button class="following-open" @click="openPost(post)"><AppIcon name="comment" :size="17" /><span>{{ $t('查看貼文') }}</span></button>
        </article>
      </div>
    </section>

    <section v-if="isMember" class="home-section">
      <div class="section-heading"><div><h2>{{ $t('最近加入衣櫥') }}</h2></div><router-link class="atelier-text-link" to="/closet">{{ $t('查看全部 →') }}</router-link></div>
      <div v-if="recentItems.length" class="atelier-recent"><button v-for="item in recentItems" :key="item.id" class="recent-card" @click="openDetail(item.id)"><div class="item-image"><MediaImage class="product-image" :src="itemPhoto(item)" :alt="itemName(item)" loading="lazy" /></div><h3>{{ itemName(item) }}</h3></button></div>
      <div v-else class="atelier-wardrobe-empty"><AppIcon name="Closet" :size="36" /><div><h3>{{ $t('從你已經擁有的衣服開始。') }}</h3><p>{{ $t('加入幾件常穿的衣服，讓每件新衣都有搭配的可能。') }}</p></div><router-link class="secondary" to="/closet?quick=add-item">{{ $t('加入第一件衣服') }}<AppIcon name="plus" :size="17" /></router-link></div>
    </section>


  </section>
</template>

<style scoped>
.home-now{display:flex;align-items:center;gap:24px;flex-wrap:wrap}.home-now .dashboard-clock{border-left:1px solid var(--line);padding-left:22px}@media(max-width:700px){.home-now{width:100%;justify-content:space-between;gap:12px}.home-now .dashboard-clock{padding-left:12px}.member-dashboard-heading{padding:24px!important}}

.member-dashboard-heading{margin:24px 0 36px;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:20px}.member-dashboard-heading h1{margin:0}.dashboard-clock{display:grid;grid-template-rows:16px 30px;align-items:center;justify-items:end;gap:6px;color:var(--ink)}.clock-date{line-height:16px;font-size:11px;color:var(--muted)}.clock-digits{display:flex;align-items:baseline;gap:3px;font-family:'Consolas','SFMono-Regular',monospace;font-size:30px;font-weight:500;line-height:30px;font-variant-numeric:tabular-nums;letter-spacing:-.03em}.clock-colon{color:var(--muted);font-size:22px}.clock-seconds{font-size:18px;color:var(--muted)}
.following-journal{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:20px;align-items:stretch}.following-card{min-width:0;display:flex;flex-direction:column;background:#fff;border-radius:14px;padding-bottom:12px;box-shadow:0 5px 20px #4934560d,0 1px 4px #49345606}.following-card>:not(.following-photo){margin-inline:14px}.following-card .following-photo{border-radius:14px 14px 0 0}.following-photo{display:block;width:100%;aspect-ratio:3/4;overflow:hidden;padding:0;border:0;border-radius:12px;background:#f2e9ee;cursor:pointer}.following-photo img{display:block;width:100%;height:100%;object-fit:contain}.following-author{display:flex;align-items:center;gap:9px;margin:14px 0 4px;min-height:34px;font-size:12px;font-weight:600}.following-author>img,.author-initials{width:32px;height:32px;flex:0 0 32px;border-radius:50%;object-fit:cover}.author-initials{display:grid;place-items:center;background:var(--accent-lavender-soft);font-size:10px}.following-author>span:last-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.following-card :deep(.content-copy){height:calc(3 * 1.7 * 13px)}.following-card :deep(.translation-actions){min-height:28px;margin:4px 0 8px}.following-open{display:flex;align-items:center;gap:7px;align-self:flex-start;margin-top:auto;padding:8px 0;border:0;background:none;font-size:12px;color:var(--muted);cursor:pointer}.following-open:hover{color:var(--ink)}.following-photo:focus-visible,.following-open:focus-visible{outline:2px solid var(--accent);outline-offset:4px}.atelier-recent .item-image{display:grid;place-items:center;padding:16px;overflow:hidden;background:#fff}.atelier-recent .item-image :deep(img.product-image){background:#fff;display:block;position:static;width:100%;height:100%;min-height:0;object-fit:contain;transform:none}
.discovery-journal{grid-template-columns:repeat(3,minmax(0,1fr))}.discovery-follow{align-self:flex-start;border:1px solid var(--line);border-radius:999px;background:transparent;color:var(--ink);padding:7px 16px;margin:6px 0 12px;font-size:12px;cursor:pointer}.discovery-follow:disabled{opacity:.5;cursor:wait}.discovery-follow:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
@media(max-width:900px){.following-journal{grid-template-columns:repeat(2,minmax(0,1fr));gap:28px 16px}}@media(max-width:600px){.member-dashboard-heading{align-items:flex-start;gap:16px}.dashboard-clock{justify-items:start}.clock-digits{font-size:26px}.member-dashboard-heading h1{flex-basis:100%}.following-author{gap:6px}.following-open{min-height:44px}.atelier-recent .item-image{padding:10px}}
</style>
