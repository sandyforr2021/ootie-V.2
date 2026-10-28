<script setup>
import { genuineContent } from '@/services/contentAuthenticity';
import { computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAppStore } from '@/stores/app';
import { useAuthStore } from '@/stores/auth';
import { useClosetStore } from '@/stores/closet';
import { useSocialStore } from '@/stores/social';
import { uniquePostsById, useOotdStore } from '@/stores/ootd';
import AppIcon from '@/components/ui/AppIcon.vue';
import EditorialVisual from '@/components/ui/EditorialVisual.vue';
import { itemName } from '@/services/itemPresentation';
import WeatherWardrobe from '@/components/closet/WeatherWardrobe.vue';
const router = useRouter();
const replayOpening = () => window.dispatchEvent(new Event('ootie:replay-opening'));
const appStore = useAppStore();
const authStore = useAuthStore();
const closetStore = useClosetStore();
const ootdStore = useOotdStore();
const socialStore = useSocialStore();
const isMember = computed(() => authStore.isMember);
const firstName = computed(() => (appStore.profile.name || '').split(' ')[0]);
const recentItems = computed(() => appStore.items.slice(0, 4));
const trendingPosts = computed(() => uniquePostsById(genuineContent(appStore.ootdPosts)).filter(post => post.image).slice(0, 4));
const followingPosts = computed(() => uniquePostsById(genuineContent(appStore.ootdPosts))
  .filter(post => post.image && socialStore.isFollowing({id: post.user_id, username: post.username}))
  .sort((a,b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)).slice(0, 4));
const openPost = post => router.push({ name: 'OotdDetail', params: { id: post.id }, query: { user: post.username, from: 'home' } });
const openDetail = id => { appStore.selectedItemId = id; appStore.isDetailOpen = true; };
watch(() => authStore.profileId, id => { if (id) void closetStore.loadRemoteItems(id); }, { immediate: true });
onMounted(() => { void ootdStore.loadRemotePosts(); });
</script>

<template>
  <section class="page active atelier-home" id="homePage">
    <header class="home-edition"><span>{{ $t('每天，都更像自己。') }}</span><span>OOTIE</span></header>
    <section v-if="isMember" class="home-section">
      <div class="section-heading"><h2>{{ $t('追蹤中的貼文') }}</h2><router-link class="atelier-text-link" to="/explore">{{ $t('探索更多 →') }}</router-link></div>
      <div v-if="followingPosts.length" class="atelier-journal"><button v-for="post in followingPosts" :key="post.id" class="trending-card" @click="openPost(post)"><img :src="post.image" :alt="post.caption || post.username" loading="lazy" /><span>{{ post.display_name || post.username }}</span><strong>{{ $t(post.caption) }}</strong><AppIcon name="arrow" :size="18" /></button></div>
      <p v-else>{{ $t('追蹤衣友後，就能在這裡看到他們的貼文。') }}</p>
    </section>
    <section class="atelier-hero">
      <div class="atelier-hero-copy">
        <h1>{{ $t('買之前，') }}<em>{{ $t('先穿進自己的生活。') }}</em></h1>
        <p v-if="isMember" class="member-greeting">{{ $t('歡迎回來，') }} {{ firstName }}</p>
        <p class="atelier-lead">{{ $t('收藏想買的商品，用 OOTIE 看見本人試穿，再找到能一起穿的衣櫥舊愛。') }}</p>
        <router-link class="primary atelier-action" to="/shop">{{ $t('開始購物試穿') }}<AppIcon name="arrow" :size="19" /></router-link>
        <router-link class="atelier-text-link" to="/closet">{{ $t('查看我的衣櫥') }}<AppIcon name="chevron" :size="16" /></router-link>
        <p class="atelier-private"><AppIcon name="lock" :size="14" />{{ $t('照片只屬於你，分享由你決定。') }}</p>
      </div>
      <EditorialVisual />
    </section>

    <nav class="atelier-journey" :aria-label="$t('從收藏到穿搭')">
      <router-link to="/shop"><span>01</span><div><strong>{{ $t('收藏心動商品') }}</strong><small>{{ $t('商品連結或照片，都可以') }}</small></div><AppIcon name="arrow" :size="18" /></router-link>
      <router-link to="/shop"><span>02</span><div><strong>{{ $t('看見本人試穿') }}</strong><small>{{ $t('OOTIE 產生私人試穿預覽') }}</small></div><AppIcon name="arrow" :size="18" /></router-link>
      <router-link to="/closet"><span>03</span><div><strong>{{ $t('配上衣櫥舊愛') }}</strong><small>{{ $t('找到更多穿法，再做決定') }}</small></div><AppIcon name="arrow" :size="18" /></router-link>
    </nav>

    <WeatherWardrobe />

    <section v-if="isMember" class="home-section">
      <div class="section-heading"><div><h2>{{ $t('最近加入衣櫥') }}</h2></div><router-link class="atelier-text-link" to="/closet">{{ $t('查看全部 →') }}</router-link></div>
      <div v-if="recentItems.length" class="atelier-recent"><button v-for="item in recentItems" :key="item.id" class="recent-card" @click="openDetail(item.id)"><div class="item-image"><img class="product-image" :src="item.photo" :alt="itemName(item)" loading="lazy" /></div><h3>{{ itemName(item) }}</h3></button></div>
      <div v-else class="atelier-wardrobe-empty"><AppIcon name="Closet" :size="36" /><div><h3>{{ $t('從你已經擁有的衣服開始。') }}</h3><p>{{ $t('加入幾件常穿的衣服，讓每件新衣都有搭配的可能。') }}</p></div><router-link class="secondary" to="/closet?quick=add-item">{{ $t('加入第一件衣服') }}<AppIcon name="plus" :size="17" /></router-link></div>
    </section>

    <section class="home-section atelier-destinations">
      <router-link to="/shop?tab=album"><AppIcon name="album" :size="28" /><div><h2>{{ $t('私人試穿相簿') }}</h2><p>{{ $t('多筆工作背景處理，完成後回來並排比較，再做決定。') }}</p></div><AppIcon name="arrow" /></router-link>
      <router-link to="/shop?tab=community"><AppIcon name="Explore" :size="28" /><div><h2>{{ $t('穿搭分享') }}</h2><p>{{ $t('分享喜歡的穿搭，讓每次心動都有商品來源。') }}</p></div><AppIcon name="arrow" /></router-link>
    </section>

    <section v-if="trendingPosts.length" class="home-section">
      <div class="section-heading"><div><h2>{{ $t('穿搭靈感') }}</h2></div><router-link class="atelier-text-link" to="/explore">{{ $t('探索更多 →') }}</router-link></div>
      <div class="atelier-journal"><button v-for="post in trendingPosts" :key="post.id" class="trending-card" @click="openPost(post)"><img :src="post.image" :alt="post.caption || post.username" loading="lazy" /><span>{{ post.editorial ? $t('OOTIE 編輯精選') : post.username }}</span><strong>{{ $t(post.caption) }}</strong><AppIcon name="arrow" :size="18" /></button></div>
    </section>
    <footer class="atelier-footer"><button class="opening-replay" @click="replayOpening">{{ $t('再開一次衣櫥') }}</button><span>OOTIE</span><p>{{ $t('新衣，遇見舊愛。') }}</p><router-link to="/shop">{{ $t('開始購物試穿') }}<AppIcon name="arrow" :size="16" /></router-link></footer>
  </section>
</template>
