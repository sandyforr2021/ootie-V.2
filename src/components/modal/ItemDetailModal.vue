<template>
  <div v-if="appStore.isDetailOpen && item" class="modal-backdrop open" @click.self="close">
    <article v-accessible-modal class="modal detail-layout">
      <button class="modal-close" :aria-label="$t(&quot;關閉&quot;)" @click="close">×</button>
      <div class="detail-photo">
        <img class="product-image" :src="item.photo" :alt="itemName(item)" />
      </div>
      <div class="detail-content">
        <h2>{{ itemName(item) }}</h2>
        <p v-if="item.brand" class="detail-category">{{ item.brand }}</p>
        <dl class="detail-fields">
          <div v-for="field in details" :key="field.label">
            <dt>{{ $t(field.label) }}</dt><dd>{{ field.value }}</dd>
          </div>
        </dl>
        <p v-if="item.notes" class="detail-notes">{{ item.notes }}</p>
        <div v-if="sourceUrl" class="detail-source-links">
          <a :href="sourceUrl" target="_blank" rel="noopener noreferrer">{{ $t('查看原商品') }} <AppIcon name="ExternalLink" :size="15" /></a>
          <a href="https://lens.google/" target="_blank" rel="noopener noreferrer">{{ $t('到 Google Lens 找相似款') }} <AppIcon name="Search" :size="15" /></a>
          <small>{{ $t('在 Google Lens 選擇要搜尋的圖片。') }}</small>
        </div>

        <div class="modal-actions">
          <button class="primary" @click="addToOutfit">{{ $t("用這件分享穿搭") }}</button>
          <button class="secondary" @click="sendToSos">{{ $t("丟到 SOS 求救") }}</button>
          <button
            :class="['secondary', { 'is-marked': isMarkedClearance }]"
            :disabled="isMarkedClearance"
            @click="closetStore.markItemForClearance(item.id)"
          >
            {{ $t(isMarkedClearance ? '已標記待出清' : '標記為考慮出清') }}
          </button>
          <button class="secondary" @click="closetStore.toggleFavorite(item.id)">
            {{ $t(item.favorite ? '已收藏' : '加入收藏') }}
          </button>
          <button class="secondary" @click="editItem">{{ $t("編輯") }}</button>
          <button class="danger" @click="deleteItem">{{ $t("刪除") }}</button>
        </div>
      </div>
    </article>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import { itemName } from '@/services/itemPresentation';
import { safeCommerceUrl } from '@/services/commerce';
import { useOotdStore } from '@/stores/ootd';
import { t } from '@/i18n';
import { useRouter } from 'vue-router';
import { useAppStore } from '@/stores/app';
import { useClosetStore } from '@/stores/closet';
import { labels } from '@/constants';

const appStore = useAppStore();
const closetStore = useClosetStore();
const router = useRouter();

const item = computed(() => {
  return appStore.items.find((i) => i.id === appStore.selectedItemId);
});

const sourceUrl = computed(() => safeCommerceUrl(item.value?.source_url));
const details = computed(() => {
  const i = item.value || {};
  return [
    ['分類', i.category && t(labels[i.category] || i.category)],
    ['主要顏色', i.primary_color && t(labels[i.primary_color] || i.primary_color)],
    ['風格', i.style && t(labels[i.style] || i.style)],
    ['適合季節', i.season && t(labels[i.season] || i.season)],
    ['版型', i.shape],
    ['購入價格', i.price != null ? `NT$ ${Number(i.price).toLocaleString()}` : ''],
    ['購買日期', i.purchase_date],
    ['穿著次數', `${i.wear_count || 0}`],
    ['上次穿著', i.last_worn]
  ].filter(([,value]) => value !== '' && value != null).map(([label,value]) => ({label,value}));
});

const isMarkedClearance = computed(() => {
  return String(item.value?.notes || '').includes('[待出清]');
});

const close = () => {
  appStore.isDetailOpen = false;
};

const editItem = () => {
  appStore.isDetailOpen = false;
  appStore.editingItemId = item.value.id;
  appStore.isItemFormOpen = true;
};

const sendToSos = () => {
  if (!item.value) return;
  const itemId = item.value.id;
  close();
  router.push({ path: '/sos', query: { item_id: itemId } });
};

const deleteItem = () => {
  if (item.value) {
    closetStore.deleteItem(item.value.id);
  }
};

const addToOutfit = () => {
  useOotdStore().editingPostId = null;
  appStore.ootdDraftItemIds = [item.value.id];
  close();
  appStore.isOotdFormOpen = true;
};
</script>

