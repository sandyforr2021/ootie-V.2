<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import {useAppStore} from '@/stores/app';
import BrandMark from '@/components/layout/BrandMark.vue';
import LanguageSelect from '@/components/layout/LanguageSelect.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import BrandProductPreview from './BrandProductPreview.vue';
import HeroEditorial from './HeroEditorial.vue';
const auth = useAuthStore();
const app=useAppStore();
const router = useRouter();
const mobileMenu = ref(null);
const closeMenu = () => { if (mobileMenu.value) mobileMenu.value.open = false; };
const replayOpening = () => window.dispatchEvent(new Event('ootie:replay-opening'));
function signIn(mode = 'login') {
  closeMenu();
  if (auth.isLoggedIn) return router.push('/');
  auth.openAuthModal(mode, null, '/');
}
const features = [
  { id:'digital-wardrobe', kind:'closet', icon:'Closet', label:'數位衣櫥', summary:'整理已有的衣服', title:'每一件衣服，都值得被看見。', description:'把上衣、外套、鞋包放進數位衣櫥。搜尋、分類、加入最愛，重新發現衣服之間的搭配。', points:['衣物分類與管理','搜尋單品與加入最愛','從 OOTD 看衣櫥統計'], action:'打開數位衣櫥', path:'/closet' },
  { id:'style-community', kind:'community', icon:'Explore', label:'穿搭社群', summary:'遇見新的穿搭靈感', title:'靈感，來自不同的日常。', description:'分享今天的 OOTD、追蹤喜歡的衣友，或在不知道怎麼搭時，向社群尋求建議。', points:['探索穿搭與分享 OOTD','追蹤喜歡的衣友','穿搭求救與交流'], action:'走進穿搭社群', path:'/explore' },
  { id:'virtual-try-on', kind:'studio', icon:'sparkle', label:'AI 虛擬試穿', summary:'買之前，先試穿', title:'把新衣，放進自己的生活。', description:'從想買清單或自己的衣櫥挑選單品，選一張人物照片，完成後到私人相簿查看與比較。', points:['挑選想試穿的單品','選擇人物照片','在私人相簿查看結果'], action:'走進試穿工作室', path:'/shop' },
  { id:'shopping-management', kind:'shopping', icon:'Wishlist', label:'購物管理', summary:'把心動整理好', title:'心動不必散落在每個分頁。', description:'保存商品圖片、資訊與購買連結。想買清單幫你整理選擇，購物足跡留下收藏、試穿與商店造訪紀錄。', points:['想買清單','商品資訊與購買連結','購物足跡'], action:'查看想買清單', path:'/closet?tab=wishlist' }
];
</script>

<template>
  <div id="brand-top" class="brand-home">
    <header class="brand-header">
      <div class="brand-header-inner">
        <a :class="['brand-home-logo',{'brand-home-logo-hidden':!app.isSidebarCollapsed}]" href="#brand-top" :aria-label="$t('回到頁首')"><BrandMark/></a>
        <nav class="brand-desktop-nav" :aria-label="$t('核心功能導覽')"><a v-for="feature in features" :key="feature.id" :href="`#${feature.id}`">{{ $t(feature.label) }}</a></nav>
        <div class="brand-header-actions">
          <LanguageSelect class="brand-desktop-language"/>
          <details ref="mobileMenu" class="brand-mobile-menu"><summary :aria-label="$t('核心功能導覽')"><AppIcon name="menu" :size="23"/></summary><div class="brand-mobile-menu-content"><nav :aria-label="$t('核心功能導覽')"><a v-for="feature in features" :key="feature.id" :href="`#${feature.id}`" @click="closeMenu">{{ $t(feature.label) }}<AppIcon name="chevron" :size="16"/></a></nav><LanguageSelect/></div></details>
          <button class="brand-login" type="button" :aria-label="$t('登入')" @click="signIn()"><span>{{ $t('登入') }}</span><AppIcon class="brand-login-icon" name="Profile" :size="20"/></button>
          <button class="brand-join" type="button" @click="signIn('register')">{{ $t('加入 OOTie') }}</button>
        </div>
      </div>
    </header>

    <section class="brand-hero brand-container" aria-labelledby="brand-hero-title">
      <div class="brand-hero-copy"><h1 id="brand-hero-title"><span>{{ $t('你的衣櫥，') }}</span><span>{{ $t('更多穿搭可能。') }}</span></h1>
       <div class="brand-hero-icons"><a v-for="feature in features" :key="feature.id" :href="`#${feature.id}`"><span class="brand-soft-icon"><AppIcon :name="feature.icon" :size="25"/></span><span>{{ $t(feature.label) }}</span></a></div>
       <div class="brand-hero-actions"><button class="brand-join" type="button" @click="signIn('register')">{{ $t('加入 OOTie') }}<AppIcon name="chevron" :size="18"/></button><a class="brand-feature-link" href="#core-experiences">{{ $t('探索核心功能') }}<AppIcon name="Explore" :size="18"/></a></div>
      </div>
      <div class="brand-hero-visual"><HeroEditorial/></div>
    </section>

    <section id="core-experiences" class="brand-overview brand-container" aria-labelledby="brand-overview-title"><h2 id="brand-overview-title">{{ $t('你的穿搭日常，都在這裡。') }}</h2><div class="brand-core-grid"><a v-for="feature in features" :key="feature.id" :href="`#${feature.id}`"><AppIcon :name="feature.icon" :size="24"/><h3>{{ $t(feature.label) }}</h3><p>{{ $t(feature.summary) }}</p><AppIcon class="brand-core-arrow" name="chevron" :size="19"/></a></div></section>

    <section v-for="(feature,index) in features" :id="feature.id" :key="feature.id" :class="['brand-feature',`brand-feature-${feature.kind}`]" :aria-labelledby="`${feature.id}-title`"><div :class="['brand-feature-inner','brand-container',{reverse:index%2===1}]"><div class="brand-feature-visual"><BrandProductPreview :kind="feature.kind"/></div><div class="brand-feature-copy"><h2 :id="`${feature.id}-title`">{{ $t(feature.label) }}</h2><h3>{{ $t(feature.title) }}</h3><ul><li v-for="(point,pointIndex) in feature.points" :key="point"><span class="brand-soft-icon"><AppIcon :name="({closet:['Closet','search','Stats'],community:['Explore','Profile','Sos'],studio:['Shop','Profile','album'],shopping:['Wishlist','link','Activity']})[feature.kind][pointIndex]" :size="22"/></span><span>{{ $t(point) }}</span></li></ul><router-link class="brand-feature-link" :to="feature.path">{{ $t(feature.action) }}<AppIcon name="chevron" :size="18"/></router-link></div></div></section>

    <section class="brand-final-cta" aria-labelledby="brand-final-title"><div class="brand-container"><h2 id="brand-final-title">{{ $t('穿搭的可能，不只一種。') }}</h2><p>{{ $t('從你已經擁有的衣服開始。') }}</p><button class="brand-join" type="button" @click="signIn('register')">{{ $t('加入 OOTie') }}<AppIcon name="chevron" :size="18"/></button><div class="brand-final-login">{{ $t('已經有帳號？') }} <button type="button" @click="signIn()">{{ $t('登入') }}</button></div></div></section>

    <footer class="brand-footer brand-container"><div><BrandMark/><p>{{ $t('你的衣櫥，') }} {{ $t('更多穿搭可能。') }}</p></div><nav :aria-label="$t('資訊與條款')"><router-link to="/legal/privacy">{{ $t('隱私權說明') }}</router-link><router-link to="/legal/terms">{{ $t('使用條款') }}</router-link><router-link to="/legal/ai">{{ $t('AI 使用說明') }}</router-link></nav><div class="brand-footer-bottom"><span>© {{ new Date().getFullYear() }} OOTie</span><button type="button" @click="replayOpening">{{ $t('再開一次衣櫥') }}</button></div><!-- Contact area is planned; no unconfirmed contact details are published. --></footer>
  </div>
</template>

<style scoped src="./brand-home.css"></style>
