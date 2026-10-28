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
        <svg class="sidebar-chevron" viewBox="0 0 24 24" aria-hidden="true">
          <path :d="appStore.isSidebarCollapsed ? 'm9 5 7 7-7 7' : 'm15 5-7 7 7 7'" />
        </svg>
      </button>
    </div>
    <nav class="nav" :aria-label="$t(&quot;主選單&quot;)">
      <router-link
        v-for="item in NAVIGATION_ITEMS"
        :key="item.routeName"
        :to="item.path"
        :title="$t(item.label)"
        :class="{ active: route.name === item.routeName || (item.routeName === 'Explore' && route.name === 'OotdDetail') }"
        active-class=""
        exact-active-class=""
      >
        <AppIcon class="nav-icon" :name="item.routeName" /><span class="nav-text">{{ displayLabel(item) }}</span>
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
import { locale, t } from '@/i18n';

const appStore = useAppStore();
const route = useRoute();
// Short Spanish navigation labels keep every target the same height without truncating the full title.
const displayLabel = (item) => locale.value === 'es'
  ? ({ Shop: 'Probador', Stats: 'Estadísticas' }[item.routeName] || t(item.label))
  : t(item.label);
</script>

<style scoped>
.sidebar-toggle { width: 44px; height: 44px; flex: 0 0 44px; }
.sidebar-chevron { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
/* Keep the divider outside the link so its selected area matches its neighbours. */
.sidebar .nav a:nth-child(5) { position: relative; border: 0; border-radius: 7px; padding: 12px 14px; }
.sidebar .nav a:nth-child(5)::before { content: ''; position: absolute; top: -15px; left: 0; right: 0; border-top: 1px solid var(--line); pointer-events: none; }
.sidebar.collapsed .nav a:nth-child(5) { padding-inline: 8px; }
.sidebar.collapsed .nav a:nth-child(5)::before { top: -10px; }
</style>
