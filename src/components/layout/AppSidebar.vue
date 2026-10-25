<template>
  <aside :class="['sidebar', { collapsed: appStore.isSidebarCollapsed }]">
    <div class="brand-row">
      <BrandMark class="brand" />
      <button
        type="button"
        class="sidebar-toggle"
        @click="appStore.toggleSidebar()"
        :aria-label="appStore.isSidebarCollapsed ? $t('展開側欄') : $t('收合側欄')"
        :aria-expanded="!appStore.isSidebarCollapsed"
      >
        <AppIcon :name="appStore.isSidebarCollapsed ? 'expand' : 'collapse'" :size="18" />
      </button>
    </div>
    <nav class="nav" :aria-label="$t(&quot;主選單&quot;)">
      <router-link
        v-for="item in sidebarItems"
        :key="item.routeName"
        :to="item.path"
        :title="$t(item.label)"
        :class="{ 'nav-group-start': ['Closet','Settings'].includes(item.routeName), active: route.name === item.routeName || (item.routeName === 'Explore' && route.name === 'OotdDetail') }"
        active-class=""
        exact-active-class=""
      >
        <AppIcon class="nav-icon" :name="item.routeName" /><span class="nav-text">{{ $t(item.label) }}</span>
      </router-link>
    </nav>
    <div class="sidebar-footer" v-if="!appStore.isSidebarCollapsed">{{ $t("你的衣櫥，是每天選擇穿搭的") }}<br />{{ $t("專屬空間。") }}</div>
  </aside>
</template>

<script setup>
import { useAppStore } from '@/stores/app';
import { NAVIGATION_ITEMS } from '@/router/navigation';
import { useRoute } from 'vue-router';
import BrandMark from './BrandMark.vue';
import AppIcon from '@/components/ui/AppIcon.vue';

const appStore = useAppStore();
const route = useRoute();
const sidebarItems = ['Home','Explore','Profile','Sos','Closet','Shop','Stats','Settings'].map(name=>NAVIGATION_ITEMS.find(item=>item.routeName===name));
</script>

<style scoped>.nav-group-start{margin-top:18px!important;border-top:1px solid var(--line);padding-top:18px!important}</style>
