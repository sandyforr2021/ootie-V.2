<template>
  <div v-if="appStore.isSosFormOpen" class="modal-backdrop open" @click.self="close">
    <section v-accessible-modal class="modal sos-form-modal">
      <button class="modal-close" :aria-label="$t(&quot;關閉&quot;)" @click="close">×</button>
      <p class="eyebrow">Style SOS</p>
      <h2>{{ t("請衣友幫忙搭配") }}</h2>
      <p v-if="contextItem" class="sos-item-context">
        {{ tf('已帶入單品：{name}', { name: contextItem.name_zh || contextItem.name }) }}
      </p>

      <p v-if="loadingCloset" role="status">{{ t('正在讀取衣櫥…') }}</p>
      <p v-if="closetLoadFailed" role="alert">{{ t('衣櫥無法載入，請關閉後重新開啟。') }}</p>
      <form :aria-busy="loadingCloset" @submit.prevent="handleSubmit">
        <fieldset :disabled="loadingCloset || closetLoadFailed" class="sos-form-fields">
        <div class="form-field">
          <label for="sosTitle">{{ t("標題") }}</label>
          <input
            id="sosTitle"
            v-model="title"
            required
            :placeholder="t('例如：明天第一次約會，我該穿什麼？')"
          />
        </div>

        <div class="form-field" style="margin-top:16px">
          <label for="sosDetails">{{ t("告訴衣友更多") }}</label>
          <textarea
            id="sosDetails"
            v-model="details"
            required
            :placeholder="t('描述你的行程、期待的感覺或穿搭困擾')"
          ></textarea>
        </div>

        <div class="form-grid" style="margin-top:16px">
          <div class="form-field">
            <label for="sosOccasion">{{ t("場合") }}</label>
            <select id="sosOccasion" v-model="occasion">
              <option value="約會">{{ t("約會") }}</option>
              <option value="工作">{{ t("工作") }}</option>
              <option value="上課">{{ t("上課") }}</option>
              <option value="聚餐">{{ t("聚餐") }}</option>
              <option value="戶外活動">{{ t("戶外活動") }}</option>
              <option value="旅行">{{ t("旅行") }}</option>
            </select>
          </div>
          <div class="form-field">
            <label for="sosWeather">{{ t("預期天氣") }}</label>
            <select id="sosWeather" v-model="weather">
              <option value="晴天">{{ t("晴天") }}</option>
              <option value="涼爽">{{ t("涼爽") }}</option>
              <option value="炎熱">{{ t("炎熱") }}</option>
              <option value="下雨">{{ t("下雨") }}</option>
              <option value="微涼有風">{{ t("微涼有風") }}</option>
            </select>
          </div>
          <div class="form-field">
            <label for="sosWhen">{{ t("穿著時機") }}</label>
            <select id="sosWhen" v-model="whenLabel">
              <option value="今晚">{{ t("今晚") }}</option>
              <option value="明天">{{ t("明天") }}</option>
              <option value="週末">{{ t("週末") }}</option>
              <option value="下週">{{ t("下週") }}</option>
            </select>
          </div>
        </div>

        <div class="form-field" style="margin-top:16px">
          <label>{{ t("想呈現的風格") }}</label>
          <div class="vibe-options">
            <label
              v-for="vibe in availableVibes"
              :key="vibe"
              :class="['vibe-option', { selected: selectedVibes.includes(vibe) }]"
            >
              <input type="checkbox" :value="vibe" v-model="selectedVibes" />
              {{ t(vibe) }}
            </label>
          </div>
        </div>

        <!-- Public Closet Items Selection -->
        <div class="form-field" style="margin-top:20px">
          <label>{{ t("本次公開給衣友的衣物") }}</label>
          <p class="sos-share-help">
            {{ t("只有你勾選的衣物會出現在這筆求救中，其他衣櫥內容不會公開。衣友只能使用你本次公開的衣物幫你搭配。") }}
          </p>

          <div class="sos-share-tools">
            <span class="suggestion-selected">{{ tf('已選 {count} 件', { count: selectedClosetItemIds.length }) }}</span>
            <div>
              <button type="button" @click="selectAllClosetItems">{{ t("全選") }}</button>
              <span style="margin:0 4px; color:var(--muted);">|</span>
              <button type="button" @click="clearClosetItems">{{ t("取消全選") }}</button>
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
                :aria-label="tf('公開 {name}', { name: item.name_zh || item.name })"
              />
              <img class="product-image" :src="item.photo" :alt="item.name_zh || item.name" />
              <span class="sos-selection-card-name">{{ item.name_zh || item.name }}</span>
              <span class="sos-selection-check" aria-hidden="true">✓</span>
            </label>
          </div>
          <p v-if="showValidation && !selectedClosetItemIds.length" class="sos-share-validation">
            {{ t("請至少選擇 1 件要公開給衣友的衣物。") }}
          </p>
        </div>

        <div class="form-actions">
          <button type="button" class="secondary" @click="close">{{ $t("取消") }}</button>
          <button type="submit" class="primary">{{ $t("發布求救") }}</button>
        </div>
        </fieldset>
      </form>
    </section>
  </div>
</template>

<script setup>
import { t, tf } from '@/i18n';
import { ref, computed, watch } from 'vue';
import { useAppStore } from '@/stores/app';
import { useSosStore } from '@/stores/sos';
import { useAuthStore } from '@/stores/auth';
import { useClosetStore } from '@/stores/closet';

const appStore = useAppStore();
const sosStore = useSosStore();
const authStore = useAuthStore();
const closetStore = useClosetStore();

const availableVibes = ['Soft', 'Elegant', 'Smart Casual', 'Relaxed', 'Confident', 'Playful'];

const title = ref('');
const details = ref('');
const occasion = ref('約會');
const weather = ref('涼爽');
const whenLabel = ref('明天');
const selectedVibes = ref([]);
const selectedClosetItemIds = ref([]);
const showValidation = ref(false);
const loadingCloset = ref(false);
const closetLoadFailed = ref(false);
let openVersion = 0;

const contextItem = computed(() => {
  return appStore.sosTargetItemId ? appStore.items.find((i) => i.id === appStore.sosTargetItemId) : null;
});

watch(
  () => appStore.isSosFormOpen,
  async (open) => {
    const version = ++openVersion;
    if (!open) return;
    const profileId = authStore.profileId;
    title.value = '';
    details.value = '';
    occasion.value = '約會';
    weather.value = '涼爽';
    whenLabel.value = '明天';
    selectedVibes.value = ['Soft'];
    selectedClosetItemIds.value = [];
    showValidation.value = false;
    closetLoadFailed.value = false;
    loadingCloset.value = authStore.isMember && !!profileId;
    if (loadingCloset.value) {
      let result;
      try { result = await closetStore.loadRemoteItems(profileId); }
      catch { result = { ok: false }; }
      if (version !== openVersion) return;
      loadingCloset.value = false;
      closetLoadFailed.value = !result?.ok;
    }
    if (!appStore.isSosFormOpen || profileId !== authStore.profileId || closetLoadFailed.value) return;
    selectedClosetItemIds.value = appStore.items.map((i) => i.id);

    if (contextItem.value) {
      const item = contextItem.value;
      const name = item.name_zh || item.name || '這件單品';
      title.value = tf('這件{name}，想請衣友幫忙搭配', { name });
      details.value = tf('我很少穿這件{name}，想請衣友幫我找找適合的搭配。', { name });
      if (!selectedClosetItemIds.value.includes(item.id)) {
        selectedClosetItemIds.value.push(item.id);
      }
    }
  },
  { immediate: true }
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
  if (loadingCloset.value || closetLoadFailed.value) return;
  if (!selectedVibes.value.length) {
    appStore.showToast(t('至少選一個想呈現的風格'));
    return;
  }
  if (!selectedClosetItemIds.value.length) {
    showValidation.value = true;
    appStore.showToast(t('請至少選擇 1 件要公開給衣友的衣物。'));
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

