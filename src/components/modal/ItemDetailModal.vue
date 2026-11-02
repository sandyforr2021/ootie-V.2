<template>
  <div v-if="appStore.isDetailOpen && item" class="modal-backdrop open" @click.self="close">
    <article v-accessible-modal class="modal detail-layout">
      <button class="modal-close" :aria-label="$t(&quot;關閉&quot;)" @click="close">×</button>
      <div class="detail-photo">
        <WardrobeCutout full class="product-image" :src="itemPhoto(item)" :category="item.category" :alt="itemName(item)" />
      </div>
      <div class="detail-content">
        <template v-if="isWishlist && editingWishlist">
          <h2>{{ $t('編輯商品') }}</h2>
          <p v-if="wishlistEditError" role="alert">{{ wishlistEditError }}</p>
          <form class="wishlist-edit-form" @submit.prevent="saveWishlistEdit">
            <label>{{ $t('商品名稱') }}<input v-model.trim="wishlistEditForm.title" maxlength="160" required></label>
            <label>{{ $t('類別') }}<select v-model="wishlistEditForm.category"><option value="upper_body">{{ $t('上衣') }}</option><option value="outer">{{ $t('外套') }}</option><option value="lower_body">{{ $t('下身') }}</option><option value="full_body">{{ $t('連身服飾') }}</option><option value="shoes">{{ $t('鞋子') }}</option><option value="auto">{{ $t('自動辨識') }}</option></select></label>
            <label>{{ $t('主要顏色') }}<input v-model="wishlistEditForm.color" type="color"></label>
            <label>{{ $t('商品購買連結（可稍後補）') }}<input v-model.trim="wishlistEditForm.sourceUrl" type="url" placeholder="https://…"></label>
            <div class="modal-actions"><button class="primary" type="submit" :disabled="wishlistEditBusy">{{ $t(wishlistEditBusy ? '儲存中…' : '儲存修改') }}</button><button class="secondary" type="button" :disabled="wishlistEditBusy" @click="editingWishlist=false">{{ $t('取消') }}</button></div>
          </form>
        </template>
        <template v-else>
        <h2>{{ itemName(item) }}</h2>
        <p v-if="!isWishlist && (item.brand || item.title)" class="detail-category">{{ item.brand || item.title }}</p>
        <dl class="detail-fields">
          <div v-for="field in details" :key="field.label">
            <dt>{{ $t(field.label) }}</dt><dd>{{ field.value }}</dd>
          </div>
        </dl>
        <p v-if="item.notes" class="detail-notes">{{ item.notes }}</p>
        <div class="modal-actions">
          <template v-if="isWishlist">
            <button class="secondary" @click="addToCloset">{{ $t('加入衣櫥') }}</button>
            <button class="secondary" @click="startWishlistEdit">{{ $t("編輯") }}</button>
            <button class="danger" @click="deleteItem">{{ $t('刪除') }}</button>
          </template>
          <template v-else>
            <button class="secondary" @click="closetStore.toggleFavorite(item.id)">
              {{ $t(item.favorite ? '移除最愛' : '加入最愛') }}
            </button>
            <button class="secondary" @click="editItem">{{ $t("編輯") }}</button>
            <button class="danger" @click="deleteItem">{{ $t("刪除") }}</button>
          </template>
        </div>
        </template>
      </div>
    </article>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { itemName, itemPhoto } from '@/services/itemPresentation';
import WardrobeCutout from '@/components/closet/WardrobeCutout.vue';
import { safeCommerceUrl, commerceClient } from '@/services/commerce';
import { t } from '@/i18n';
import { useAppStore } from '@/stores/app';
import { useAuthStore } from '@/stores/auth';
import { useClosetStore, CLOSET_DATA_MODE } from '@/stores/closet';
import { labels } from '@/constants';

const appStore = useAppStore();
const authStore = useAuthStore();
const closetStore = useClosetStore();
const router = useRouter();
const editingWishlist = ref(false), wishlistEditBusy = ref(false), wishlistEditError = ref('');
const wishlistEditForm = ref({title:'',category:'upper_body',color:'#c8bba9',sourceUrl:''});

const isWishlist = computed(() => {
  return (appStore.wishlistProducts || []).some(p => p.id === appStore.selectedItemId) && !appStore.items.some(i => i.id === appStore.selectedItemId);
});

const item = computed(() => {
  return appStore.items.find((i) => i.id === appStore.selectedItemId) || (appStore.wishlistProducts || []).find((p) => p.id === appStore.selectedItemId);
});

watch([item, isWishlist], ([product, wishlist]) => {
  if (!wishlist || !product) return;
  wishlistEditForm.value = {
    title: product.title || '',
    category: product.outfit_layer === 'outer' ? 'outer' : product.category || 'upper_body',
    color: product.color || '#c8bba9',
    sourceUrl: product.source_url || ''
  };
  editingWishlist.value = false;
  wishlistEditError.value = '';
}, { immediate: true });

const details = computed(() => {
  const i = item.value || {};
  if (isWishlist.value) {
    const category = i.outfit_layer === 'outer' ? 'Outerwear' : ({
      upper_body:'Tops', lower_body:'Bottoms', full_body:'Dress', shoes:'Shoes', auto:'自動辨識'
    })[i.category] || i.category;
    return [
      ['分類', i.category && t(labels[category] || category)],
      ['主要顏色', i.color && t(labels[i.color] || i.color)],
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
  editingWishlist.value = false;
  appStore.isDetailOpen = false;
};

const startWishlistEdit = () => {
  wishlistEditError.value = '';
  editingWishlist.value = true;
};

const saveWishlistEdit = async () => {
  if (!item.value || wishlistEditBusy.value) return;
  const sourceUrlValue = wishlistEditForm.value.sourceUrl.trim();
  const sourceUrl = sourceUrlValue ? safeCommerceUrl(sourceUrlValue) : '';
  if (sourceUrlValue && !sourceUrl) {
    wishlistEditError.value = t('請輸入有效的商品網址。');
    return;
  }
  wishlistEditBusy.value = true;
  wishlistEditError.value = '';
  try {
    const data = await commerceClient.request(`products/${item.value.id}/state`, authStore.session?.access_token, {
      title: wishlistEditForm.value.title,
      category: wishlistEditForm.value.category,
      color: wishlistEditForm.value.color,
      sourceUrl
    });
    appStore.wishlistProducts = (appStore.wishlistProducts || []).map(product =>
      product.id === item.value.id ? { ...data.product, photo: product.photo || '' } : product);
    editingWishlist.value = false;
  } catch (error) {
    wishlistEditError.value = error?.userMessage || t('暫時無法完成，請稍後再試。');
  } finally {
    wishlistEditBusy.value = false;
  }
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
    if (!profileId) throw new Error(t('請先登入並載入遠端衣櫥。'));
    const result = await closetStore.loadRemoteItems(profileId);
    if (!result?.ok || closetStore.dataMode !== CLOSET_DATA_MODE.REMOTE) {
      throw result?.error || new Error(t('衣櫥無法載入，請稍後再試。'));
    }

    await router.push('/closet');
    appStore.itemFormSourceProduct = {
      id: product.id,
      ownerProfileId: profileId,
      title: product.title || '',
      category: product.category || '',
      outfit_layer: product.outfit_layer || '',
      color: product.color || '',
      image_path: product.image_path || '',
      source_url: safeCommerceUrl(product.source_url)
    };
    appStore.editingItemId = null;
    appStore.isDetailOpen = false;
    appStore.isItemFormOpen = true;
  } catch (err) {
    appStore.showToast(err?.userMessage || t('暫時無法完成，請稍後再試。'), { type: 'error' });
  }
};
</script>
<style scoped>
.wishlist-edit-form,.wishlist-edit-form label{display:grid;gap:8px}.wishlist-edit-form{gap:14px}.wishlist-edit-form input:not([type=color]),.wishlist-edit-form select{width:100%;min-height:44px;padding:10px;border:1px solid var(--line);border-radius:8px;background:var(--white);font:inherit;color:var(--ink)}.wishlist-edit-form input[type=color]{width:100%;min-height:44px;padding:4px;border:1px solid var(--line);border-radius:8px;background:var(--white)}
</style>
