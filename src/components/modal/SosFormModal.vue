<template>
  <div v-if="appStore.isSosFormOpen" class="modal-backdrop open" @click.self="close">
    <section v-accessible-modal class="modal sos-form-modal">
      <button class="modal-close" :aria-label="$t(&quot;關閉&quot;)" @click="close">×</button>
      <p class="eyebrow">Style SOS</p>
      <h2>請衣友幫忙搭配</h2>
      <p v-if="contextItem" class="sos-item-context">
        已帶入單品：{{ contextItem.name_zh || contextItem.name }}
      </p>

      <form @submit.prevent="handleSubmit">
        <div class="form-field">
          <label for="sosTitle">標題</label>
          <input
            id="sosTitle"
            v-model="title"
            required
            placeholder="例如：明天第一次約會，我該穿什麼？"
          />
        </div>

        <div class="form-field" style="margin-top:16px">
          <label for="sosDetails">告訴衣友更多</label>
          <textarea
            id="sosDetails"
            v-model="details"
            required
            placeholder="描述你的行程、期待的感覺或穿搭困擾"
          ></textarea>
        </div>

        <div class="form-grid" style="margin-top:16px">
          <div class="form-field">
            <label for="sosOccasion">場合</label>
            <select id="sosOccasion" v-model="occasion">
              <option>約會</option>
              <option>工作</option>
              <option>上課</option>
              <option>聚餐</option>
              <option>戶外活動</option>
              <option>旅行</option>
            </select>
          </div>
          <div class="form-field">
            <label for="sosWeather">預期天氣</label>
            <select id="sosWeather" v-model="weather">
              <option>晴天</option>
              <option>涼爽</option>
              <option>炎熱</option>
              <option>下雨</option>
              <option>微涼有風</option>
            </select>
          </div>
          <div class="form-field">
            <label for="sosWhen">穿著時機</label>
            <select id="sosWhen" v-model="whenLabel">
              <option>今晚</option>
              <option>明天</option>
              <option>週末</option>
              <option>下週</option>
            </select>
          </div>
        </div>

        <div class="form-field" style="margin-top:16px">
          <label>想呈現的風格</label>
          <div class="vibe-options">
            <label
              v-for="vibe in availableVibes"
              :key="vibe"
              :class="['vibe-option', { selected: selectedVibes.includes(vibe) }]"
            >
              <input type="checkbox" :value="vibe" v-model="selectedVibes" />
              {{ vibe }}
            </label>
          </div>
        </div>

        <!-- Public Closet Items Selection -->
        <div class="form-field" style="margin-top:20px">
          <label>本次公開給衣友的衣物</label>
          <p class="sos-share-help">
            只有你勾選的衣物會出現在這筆求救中，其他衣櫥內容不會公開。衣友只能使用你本次公開的衣物幫你搭配。
          </p>

          <div class="sos-share-tools">
            <span class="suggestion-selected">已選 {{ selectedClosetItemIds.length }}{{ $t("件") }}</span>
            <div>
              <button type="button" @click="selectAllClosetItems">全選</button>
              <span style="margin:0 4px; color:var(--muted);">|</span>
              <button type="button" @click="clearClosetItems">取消全選</button>
            </div>
          </div>

          <div class="sos-selection-grid sos-share-items">
            <label
              v-for="item in appStore.items"
              :key="item.id"
              :class="['suggestion-item', 'sos-selection-card', { selected: selectedClosetItemIds.includes(item.id) }]"
            >
              <input
                type="checkbox"
                :value="item.id"
                v-model="selectedClosetItemIds"
                :aria-label="`公開 ${item.name_zh || item.name}`"
              />
              <img class="product-image" :src="item.photo" :alt="item.name_zh || item.name" />
              <span class="sos-selection-card-name">{{ item.name_zh || item.name }}</span>
              <span class="sos-selection-check" aria-hidden="true">✓</span>
            </label>
          </div>
          <p v-if="showValidation && !selectedClosetItemIds.length" class="sos-share-validation">
            請至少選擇 1 件要公開給衣友的衣物。
          </p>
        </div>

        <div class="form-actions">
          <button type="button" class="secondary" @click="close">{{ $t("取消") }}</button>
          <button type="submit" class="primary">{{ $t("發布求救") }}</button>
        </div>
      </form>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useAppStore } from '@/stores/app';
import { useSosStore } from '@/stores/sos';

const appStore = useAppStore();
const sosStore = useSosStore();

const availableVibes = ['Soft', 'Elegant', 'Smart Casual', 'Relaxed', 'Confident', 'Playful'];

const title = ref('');
const details = ref('');
const occasion = ref('約會');
const weather = ref('涼爽');
const whenLabel = ref('明天');
const selectedVibes = ref([]);
const selectedClosetItemIds = ref([]);
const showValidation = ref(false);

const contextItem = computed(() => {
  return appStore.sosTargetItemId ? appStore.items.find((i) => i.id === appStore.sosTargetItemId) : null;
});

watch(
  () => appStore.isSosFormOpen,
  (open) => {
    if (!open) return;
    title.value = '';
    details.value = '';
    occasion.value = '約會';
    weather.value = '涼爽';
    whenLabel.value = '明天';
    selectedVibes.value = ['Soft'];
    // Default to select all user's closet items
    selectedClosetItemIds.value = appStore.items.map((i) => i.id);
    showValidation.value = false;

    if (contextItem.value) {
      const item = contextItem.value;
      const name = item.name_zh || item.name || '這件單品';
      title.value = `這件${name}，想請衣友幫忙搭配`;
      details.value = `我很少穿這件${name}，想請衣友幫我找找適合的搭配。`;
      if (!selectedClosetItemIds.value.includes(item.id)) {
        selectedClosetItemIds.value.push(item.id);
      }
    }
  }
);

const selectAllClosetItems = () => {
  selectedClosetItemIds.value = appStore.items.map((i) => i.id);
};

const clearClosetItems = () => {
  selectedClosetItemIds.value = [];
};

const close = () => {
  appStore.isSosFormOpen = false;
  appStore.sosTargetItemId = null;
};

const handleSubmit = async () => {
  if (!selectedVibes.value.length) {
    appStore.showToast('至少選一個想呈現的風格');
    return;
  }
  if (!selectedClosetItemIds.value.length) {
    showValidation.value = true;
    appStore.showToast('請至少選擇 1 件要公開給衣友的衣物。');
    return;
  }

  const success = await sosStore.createSosPost({
    title: title.value,
    details: details.value,
    occasion: occasion.value,
    weather: weather.value,
    when_label: whenLabel.value,
    vibes: selectedVibes.value,
    closet_item_ids: selectedClosetItemIds.value
  });

  if (success) {
    close();
  }
};
</script>

