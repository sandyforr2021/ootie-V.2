<template>
  <div v-if="appStore.isDetailOpen && item" class="modal-backdrop open" @click.self="close">
    <article v-accessible-modal class="modal detail-layout">
      <button class="modal-close" :aria-label="$t(&quot;關閉&quot;)" @click="close">×</button>
      <div class="detail-photo">
        <WardrobeCutout full class="product-image" :src="itemPhoto(item)" :category="item.category" :alt="itemName(item)" />
      </div>
      <div class="detail-content">
        <h2>{{ itemName(item) }}</h2>
        <p v-if="item.brand || item.title" class="detail-category">{{ item.brand || item.title }}</p>
        <dl class="detail-fields">
          <div v-for="field in details" :key="field.label">
            <dt>{{ $t(field.label) }}</dt><dd>{{ field.value }}</dd>
          </div>
        </dl>
        <p v-if="item.notes" class="detail-notes">{{ item.notes }}</p>
        <div v-if="sourceUrl" class="detail-source-links">
          <a :href="sourceUrl" target="_blank" rel="noopener noreferrer">{{ $t('前往商品頁面') }} <AppIcon name="ExternalLink" :size="15" /></a>
          <a v-if="!isWishlist" href="https://lens.google/" target="_blank" rel="noopener noreferrer">{{ $t('到 Google Lens 找相似款') }} <AppIcon name="Search" :size="15" /></a>
        </div>

        <div class="modal-actions">
          <template v-if="isWishlist">
            <button class="primary" @click="addToCloset">{{ $t('放入我的衣櫥') }}</button>
            <button class="secondary" @click="deleteItem">{{ $t('刪除') }}</button>
          </template>
          <template v-else>
            <button class="secondary" @click="closetStore.toggleFavorite(item.id)">
              {{ $t(item.favorite ? '移除最愛' : '加入最愛') }}
            </button>
            <button class="secondary" @click="editItem">{{ $t("編輯") }}</button>
            <button class="danger" @click="deleteItem">{{ $t("刪除") }}</button>
          </template>
        </div>
      </div>
    </article>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import { itemName, itemPhoto } from '@/services/itemPresentation';
import WardrobeCutout from '@/components/closet/WardrobeCutout.vue';
import { safeCommerceUrl, commerceClient } from '@/services/commerce';
import { t } from '@/i18n';
import { useAppStore } from '@/stores/app';
import { useAuthStore } from '@/stores/auth';
import { useClosetStore } from '@/stores/closet';
import { labels } from '@/constants';

const appStore = useAppStore();
const authStore = useAuthStore();
const closetStore = useClosetStore();

const isWishlist = computed(() => {
  return (appStore.wishlistProducts || []).some(p => p.id === appStore.selectedItemId) && !appStore.items.some(i => i.id === appStore.selectedItemId);
});

const item = computed(() => {
  return appStore.items.find((i) => i.id === appStore.selectedItemId) || (appStore.wishlistProducts || []).find((p) => p.id === appStore.selectedItemId);
});

const sourceUrl = computed(() => safeCommerceUrl(item.value?.source_url));
const details = computed(() => {
  const i = item.value || {};
  if (isWishlist.value) {
    return [
      ['分類', i.category && t(labels[i.category] || i.category)],
      ['狀態', i.state === 'kept' ? t('保留候選') : t('想買')]
    ].filter(([,value]) => value !== '' && value != null).map(([label,value]) => ({label,value}));
  }
  return [
    ['分類', i.category && t(labels[i.category] || i.category)],
    ['主要顏色', i.primary_color && t(labels[i.primary_color] || i.primary_color)],
    ['風格', i.style && t(labels[i.style] || i.style)],
    ['適合季節', i.season && t(labels[i.season] || i.season)],
    ['穿著次數', `${i.wear_count || 0}`],
    ['上次穿著', i.last_worn]
  ].filter(([,value]) => value !== '' && value != null).map(([label,value]) => ({label,value}));
});

const close = () => {
  appStore.isDetailOpen = false;
};

const editItem = () => {
  appStore.isDetailOpen = false;
  appStore.editingItemId = item.value.id;
  appStore.isItemFormOpen = true;
};

const deleteItem = async () => {
  if (!item.value) return;
  if (isWishlist.value) {
    try {
      await commerceClient.request(`products/${item.value.id}/state`, authStore.session?.access_token, { state: 'dismissed' });
      appStore.wishlistProducts = (appStore.wishlistProducts || []).filter(p => p.id !== item.value.id);
      close();
    } catch {
      appStore.showToast(t('暫時無法完成，請稍後再試。'), { type: 'error' });
    }
  } else {
    closetStore.deleteItem(item.value.id);
    close();
  }
};

const addToCloset = async () => {
  if (!item.value) return;
  const product = item.value;
  try {
    const profileId = authStore.profileId;
    if (profileId) {
      await closetStore.loadRemoteItems(profileId);
    }
    await closetStore.addItem({
      id: product.id,
      name: product.title,
      name_zh: product.title,
      category: ({upper_body:'Tops',lower_body:'Bottoms',full_body:'Dresses',shoes:'Shoes',auto:'Other'})[product.category] || 'Other',
      color_hex: product.color || '#c8bba9',
      source_url: product.source_url
    });
    await commerceClient.request(`products/${product.id}/state`, authStore.session?.access_token, { state: 'purchased' });
    appStore.wishlistProducts = (appStore.wishlistProducts || []).filter(p => p.id !== product.id);
    appStore.showToast(t('已加入衣櫥。'), { type: 'success' });
    close();
  } catch (err) {
    appStore.showToast(err?.userMessage || t('暫時無法完成，請稍後再試。'), { type: 'error' });
  }
};
</script>
