<template>
  <div v-if="appStore.isDetailOpen && item" class="modal-backdrop open" @click.self="close">
    <article v-accessible-modal class="modal detail-layout">
      <button class="modal-close" aria-label="關閉" @click="close">×</button>
      <div class="detail-photo">
        <img class="product-image" :src="item.photo" :alt="item.name_zh || item.name" />
      </div>
      <div class="detail-content">
        <p class="eyebrow">{{ labels[item.category] || item.category }}</p>
        <h2>{{ item.name_zh || item.name }}</h2>
        <p class="detail-category">
          {{ item.brand ? `品牌：${item.brand}` : '品牌未設定' }}
        </p>

        <dl class="detail-fields">
          <div>
            <dt>分類</dt>
            <dd>{{ labels[item.category] || item.category }}</dd>
          </div>
          <div>
            <dt>色系</dt>
            <dd>{{ labels[item.secondary_color] || item.secondary_color || '未設定' }}</dd>
          </div>
          <div>
            <dt>主要顏色</dt>
            <dd>{{ labels[item.primary_color] || item.primary_color || '未設定' }}</dd>
          </div>
          <div>
            <dt>品牌</dt>
            <dd>{{ item.brand || '未設定' }}</dd>
          </div>
          <div>
            <dt>風格</dt>
            <dd>{{ labels[item.style] || item.style }}</dd>
          </div>
          <div>
            <dt>適合季節</dt>
            <dd>{{ labels[item.season] || item.season }}</dd>
          </div>
          <div>
            <dt>版型</dt>
            <dd>{{ item.shape || '未設定' }}</dd>
          </div>
          <div>
            <dt>價格</dt>
            <dd>{{ item.price !== null && item.price !== undefined ? `${item.price} 元` : '未設定' }}</dd>
          </div>
          <div>
            <dt>每次穿著成本</dt>
            <dd>{{ closetStore.calculateCostPerWear(item) !== null ? `${closetStore.calculateCostPerWear(item)} 元 / 次` : '-' }}</dd>
          </div>
          <div>
            <dt>購買日期</dt>
            <dd>{{ item.purchase_date || '未設定' }}</dd>
          </div>
          <div>
            <dt>穿著次數</dt>
            <dd>{{ item.wear_count || 0 }} 次</dd>
          </div>
          <div>
            <dt>上次穿著</dt>
            <dd>{{ item.last_worn || '尚未穿著' }}</dd>
          </div>
        </dl>

        <p class="detail-notes">
          {{ item.notes || '這件單品還沒有備註。' }}
        </p>

        <div class="modal-actions">
          <button class="primary" @click="addToOutfit">加入穿搭</button>
          <button class="secondary" @click="sendToSos">丟到 SOS 求救</button>
          <button
            :class="['secondary', { 'is-marked': isMarkedClearance }]"
            :disabled="isMarkedClearance"
            @click="closetStore.markItemForClearance(item.id)"
          >
            {{ isMarkedClearance ? '已標記待出清' : '標記為考慮出清' }}
          </button>
          <button class="secondary" @click="closetStore.toggleFavorite(item.id)">
            {{ item.favorite ? '♥ 已收藏' : '♡ 加入收藏' }}
          </button>
          <button class="secondary" @click="editItem">編輯</button>
          <button class="danger" @click="deleteItem">刪除</button>
        </div>
      </div>
    </article>
  </div>
</template>

<script setup>
import { computed } from 'vue';
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
  appStore.showToast('穿搭建立功能尚未提供；這件單品沒有被加入', { type: 'info' });
};
</script>

