<template>
  <div v-if="appStore.isSosFormOpen" class="modal-backdrop open" @click.self="close">
    <section v-accessible-modal class="modal sos-form-modal">
      <button class="modal-close" :aria-label="$t(&quot;關閉&quot;)" @click="close">×</button>
      <p class="eyebrow">Style SOS</p>
      <h2>{{ t("請衣友幫忙搭配") }}</h2>
      <p v-if="contextItem" class="sos-item-context">
        <img v-if="contextItem.photo" :src="contextItem.photo" :alt="contextItem.name_zh || contextItem.name" style="width:72px;height:90px;object-fit:contain" />{{ tf('已帶入單品：{name}', { name: contextItem.name_zh || contextItem.name }) }}
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
        </div>

        <p v-if="!appStore.profile.public_closet" role="alert">{{ t('請先在我的衣櫥開啟公開衣櫥，才能發布求救。', 'Make your wardrobe public in My wardrobe before posting a request.') }} <router-link to="/closet" @click="close">{{ t('我的衣櫥') }}</router-link></p>
        <p v-else>{{ t('衣友可以從你的公開衣櫥提供搭配建議。', 'People can suggest outfits from your public wardrobe.') }}</p>
        <div class="form-actions">
          <button type="button" class="secondary" @click="close">{{ $t("取消") }}</button>
          <button type="submit" class="primary" :disabled="!appStore.profile.public_closet">{{ $t("發布求救") }}</button>
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


const title = ref('');
const details = ref('');
const occasion = ref('約會');
const weather = ref('涼爽');
const selectedClosetItemIds = ref([]);
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
    selectedClosetItemIds.value = [];
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

const close = () => {
  appStore.isSosFormOpen = false;
  appStore.sosTargetItemId = null;
};

const handleSubmit = async () => {
  if (loadingCloset.value || closetLoadFailed.value || !appStore.profile.public_closet) return;
  selectedClosetItemIds.value=appStore.items.filter(item=>!item.hidden).map(item=>item.id);
  if (!selectedClosetItemIds.value.length) {
    appStore.showToast(t('請先在衣櫥加入至少一件衣物。'));
    return;
  }

  const success = await sosStore.createSosPost({
    title: title.value,
    details: details.value,
    occasion: occasion.value,
    weather: weather.value,
    when_label: '',
    vibes: [],
    closet_item_ids: selectedClosetItemIds.value
  });

  if (success) {
    close();
  }
};
</script>

