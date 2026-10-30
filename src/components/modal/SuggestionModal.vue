<template>
  <div v-if="appStore.isSuggestionFormOpen && targetPost" class="modal-backdrop open" @click.self="close">
    <section v-accessible-modal class="modal suggestion-form-modal">
      <button class="modal-close" :aria-label="$t(&quot;關閉&quot;)" @click="close">×</button>
      <h2>{{ t("提供穿搭建議") }}</h2>
      <p class="suggestion-intro">
        {{ tf('為 {user} 的「{title}」提案', { user: targetPost.display_name || targetPost.username, title: targetPost.title }) }}<br />
        <span style="font-size:12px; color:var(--sage-dark);">
          {{ tf('僅顯示本次公開的 {count} 件衣物', { count: availableItems.length }) }}
        </span>
      </p>

      <form @submit.prevent="handleSubmit">
        <div class="form-field">
          <label>{{ t("選擇單品") }}</label>
          <div v-if="availableItems.length" class="sos-selection-grid suggestion-items">
            <label
              v-for="item in availableItems"
              :key="item.id"
              :class="['suggestion-item', 'sos-selection-card', { selected: selectedIds.includes(item.id) }]"
            >
              <input
                type="checkbox"
                :value="item.id"
                v-model="selectedIds"
                :aria-label="tf('搭配 {name}', { name: item.name_zh || item.name })"
              />
              <MediaImage class="product-image" :src="item.photo" :alt="item.name_zh || item.name" />
              <span class="sos-selection-card-name">{{ item.name_zh || item.name }}</span>
              <span v-if="selectedIds.includes(item.id)" class="sos-selection-check" aria-hidden="true">✓</span>
            </label>
          </div>
          <div v-else style="padding: 16px; border: 1px dashed var(--line); border-radius: 8px; color: var(--muted); font-size: 12px; text-align: center;">
            {{ t("這是歷史求救貼文，當時公開的衣物清單未被保存。") }}
          </div>

          <p class="suggestion-selected">{{ tf('已選 {count} 件', { count: selectedIds.length }) }}</p>

          <div :class="['current-outfit', { visible: selectedItems.length > 0 }]">
            <div class="current-outfit-title">{{ t("目前搭配") }}</div>
            <div class="current-outfit-images">
              <template v-for="(item, idx) in selectedItems" :key="item.id">
                <span v-if="idx > 0" class="outfit-plus">＋</span>
                <MediaImage class="product-image" :src="item.photo" :alt="item.name_zh || item.name" />
              </template>
            </div>
            <p class="current-outfit-names">
              {{ selectedItems.map((i) => i.name_zh || i.name).join(' ＋ ') }}
            </p>
          </div>
        </div>

        <div class="form-field" style="margin-top:18px">
          <label for="suggestionMessage">{{ t("你的搭配建議") }}</label>
          <textarea
            id="suggestionMessage"
            v-model="message"
            required
            :placeholder="t('說說你為什麼這樣搭，或提醒她一些小細節')"
          ></textarea>
        </div>

        <div class="form-actions">
          <button type="button" class="secondary" @click="close">{{ $t("取消") }}</button>
          <button type="submit" class="primary">{{ t("送出建議") }}</button>
        </div>
      </form>
    </section>
  </div>
</template>

<script setup>
import MediaImage from '@/components/ui/MediaImage.vue';
import { t, tf } from '@/i18n';
import { ref, computed, watch } from 'vue';
import { useAppStore } from '@/stores/app';
import { useSosStore } from '@/stores/sos';

const appStore = useAppStore();
const sosStore = useSosStore();

const targetPost = computed(() => {
  return sosStore.sosPosts.find((p) => p.id === appStore.activeSosId);
});

// Restrict items ONLY to target SOS's closet_item_ids
const availableItems = computed(() => {
  if (!targetPost.value) return [];
  const sharedIds = targetPost.value.closet_item_ids;
  if (!Array.isArray(sharedIds) || sharedIds.length === 0) {
    return [];
  }
  const sharedIdSet = new Set(sharedIds.map((id) => String(id)));
  return sosStore.getPublicItemsForSos(sharedIds).filter((item) => sharedIdSet.has(String(item.id)));
});

const selectedIds = ref([]);
const message = ref('');

const selectedItems = computed(() => {
  const selectedIdSet = new Set(selectedIds.value.map((id) => String(id)));
  return availableItems.value.filter((item) => selectedIdSet.has(String(item.id)));
});

watch(
  () => appStore.isSuggestionFormOpen,
  (open) => {
    if (!open) return;
    selectedIds.value = [];
    message.value = '';
  },
  { immediate: true }
);

const close = () => {
  appStore.isSuggestionFormOpen = false;
};

const handleSubmit = async () => {
  const availableIdSet = new Set(availableItems.value.map((item) => String(item.id)));
  const validSelectedIds = selectedIds.value.filter((id) => availableIdSet.has(String(id)));
  if (validSelectedIds.length !== selectedIds.value.length) {
    selectedIds.value = validSelectedIds;
    appStore.showToast(t('只能選擇這筆求救公開的衣物。'));
    return;
  }
  if (!validSelectedIds.length) {
    appStore.showToast(t('至少選一件衣物來搭配'));
    return;
  }
  const success = await sosStore.submitSuggestion({
    sosId: appStore.activeSosId,
    selectedIds: validSelectedIds,
    message: message.value
  });
  if (success) {
    close();
  }
};
</script>
