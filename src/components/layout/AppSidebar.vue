<template>
  <aside :class="['sidebar', { collapsed: appStore.isSidebarCollapsed }]">
    <div class="brand-row">
      <BrandMark class="brand" />
      <button
        type="button"
        class="sidebar-toggle"
        @click="appStore.toggleSidebar()"
        :aria-label="appStore.isSidebarCollapsed ? '展開側欄' : '收合側欄'"
        :aria-expanded="!appStore.isSidebarCollapsed"
      >
        <span class="toggle-icon">{{ appStore.isSidebarCollapsed ? '❯' : '❮' }}</span>
      </button>
    </div>
    <nav class="nav" aria-label="主選單">
      <router-link
        v-for="item in NAVIGATION_ITEMS"
        :key="item.routeName"
        :to="item.path"
        :title="item.label"
        :class="{ active: route.name === item.routeName || (item.routeName === 'Explore' && route.name === 'OotdDetail') }"
        active-class=""
        exact-active-class=""
      >
        <span class="nav-icon" aria-hidden="true">{{ item.icon }}</span><span class="nav-text">{{ item.label }}</span>
      </router-link>
    </nav>
    <div class="sidebar-footer" v-if="!appStore.isSidebarCollapsed">
      你的衣櫥，是每天選擇穿搭的<br />專屬空間。
    </div>
  </aside>
</template>

<script setup>
import { useAppStore } from '@/stores/app';
import { NAVIGATION_ITEMS } from '@/router/navigation';
import { useRoute } from 'vue-router';
import BrandMark from './BrandMark.vue';

const appStore = useAppStore();
const route = useRoute();
</script>
