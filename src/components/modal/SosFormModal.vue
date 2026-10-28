<template>
  <div v-if="appStore.isSosFormOpen" class="modal-backdrop open" @click.self="close">
    <section v-accessible-modal class="modal sos-form-modal">
      <button class="modal-close" :aria-label="$t(&quot;關閉&quot;)" @click="close">×</button>
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
            <input id="sosOccasion" v-model.trim="occasion" list="sos-occasions" maxlength="80" required />
            <datalist id="sos-occasions">
              <option value="約會">{{ t("約會") }}</option>
              <option value="工作">{{ t("工作") }}</option>
              <option value="上課">{{ t("上課") }}</option>
              <option value="聚餐">{{ t("聚餐") }}</option>
              <option value="戶外活動">{{ t("戶外活動") }}</option>
              <option value="旅行">{{ t("旅行") }}</option>
            </datalist>
          </div>
          <div class="form-field">
            <label for="sosWeather">{{ t("預期天氣") }}</label>
            <input id="sosWeather" v-model.trim="weather" list="sos-weather-options" maxlength="80" required />
            <datalist id="sos-weather-options">
              <option value="晴天">{{ t("晴天") }}</option>
              <option value="涼爽">{{ t("涼爽") }}</option>
              <option value="炎熱">{{ t("炎熱") }}</option>
              <option value="下雨">{{ t("下雨") }}</option>
              <option value="微涼有風">{{ t("微涼有風") }}</option>
            </datalist>
          </div>

        </div>

        <p class="sos-closet-notice" v-if="!appStore.profile.public_closet">
          {{ t('請先開啟「公開衣櫥」功能，才能發布求救。') }}
          <router-link to="/closet" @click="close">{{ t('前往我的衣櫥') }}</router-link>
        </p>
        <p class="sos-closet-notice" v-else>{{ t('目前已公開衣櫥，衣友可以從你的衣櫥提供搭配建議。') }}</p>

        <div class="form-field sos-cover-choice">
          <label for="sosCoverMode">{{ t('求救主圖（選填）') }}</label>
          <select id="sosCoverMode" v-model="coverMode">
            <option value="none">{{ t('不使用主圖') }}</option>
            <option value="upload">{{ t('上傳圖片') }}</option>
            <option value="closet">{{ t('從公開衣物選擇') }}</option>
          </select>
          <input v-if="coverMode==='upload'" type="file" accept="image/jpeg,image/png,image/webp" @change="chooseCover" />
          <select v-if="coverMode==='closet'" v-model="coverItemId" :aria-label="t('選擇主圖衣物')">
            <option value="">{{ t('選擇主圖衣物') }}</option>
            <option v-for="item in appStore.items.filter(i=>selectedClosetItemIds.includes(i.id))" :key="item.id" :value="item.id">{{ item.name_zh || item.name }}</option>
          </select>
          <p v-if="coverMode !== 'none'">{{ t('發布後，選用的主圖會公開顯示。') }}</p>
        </div>

        <div class="form-actions">
          <button type="button" class="secondary" @click="close">{{ $t("取消") }}</button>
          <button type="submit" class="primary" :disabled="!appStore.profile.public_closet || submitting">{{ $t("發布求救") }}</button>
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
import { uploadOotdImage, validateOotdImage } from '@/services/ootdMedia';

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
const coverMode=ref('none'), coverFile=ref(null), coverItemId=ref(''), submitting=ref(false);
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
    coverMode.value='none'; coverFile.value=null; coverItemId.value='';
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
    selectedClosetItemIds.value = appStore.items.filter(i => !i.hidden && i.owner_id === profileId).map(i => i.id);

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
  if (submitting.value) return;
  appStore.isSosFormOpen = false;
  appStore.sosTargetItemId = null;
};

const chooseCover = (event) => {
  const file=event.target.files?.[0]; coverFile.value=null;
  if (!file) return;
  try { validateOotdImage(file); coverFile.value=file; }
  catch (error) { appStore.showToast(error?.userMessage || t('照片處理失敗，請重新選擇。'), {type:'error'}); event.target.value=''; }
};

// Publish a separate copy of the selected display photo. Closet originals and
// their private storage paths never become the public SOS cover.
const selectedCoverFile = async (profileId) => {
  const item = appStore.items.find(entry => String(entry.id) === String(coverItemId.value));
  if (!item?.photo || item.owner_id !== profileId) throw new Error('COVER_UNAVAILABLE');
  const response = await fetch(item.photo);
  if (!response.ok) throw new Error('COVER_UNAVAILABLE');
  const blob = await response.blob();
  const file = new File([blob], 'sos-cover', { type: blob.type });
  validateOotdImage(file);
  return file;
};

const handleSubmit = async () => {
  if (loadingCloset.value || closetLoadFailed.value || !appStore.profile.public_closet || submitting.value) return;
  const userId=authStore.user?.id, profileId=authStore.profileId, version=openVersion;
  if(!userId || !profileId || !authStore.isMember)return;
  const stillCurrent=()=>authStore.user?.id===userId && authStore.profileId===profileId && version===openVersion && appStore.isSosFormOpen;

  if (!selectedClosetItemIds.value.length) {
    appStore.showToast(t('請先在衣櫥加入至少一件衣物。'));
    return;
  }

  if ((coverMode.value==='upload' && !coverFile.value) || (coverMode.value==='closet' && !selectedClosetItemIds.value.includes(coverItemId.value))) {
    appStore.showToast(t('請選擇主圖或改為不使用主圖。'), {type:'warning'}); return;
  }
  submitting.value=true; let uploaded=null; let success=false;
  try {
    if (coverMode.value !== 'none') {
      const file = coverMode.value === 'upload' ? coverFile.value : await selectedCoverFile(profileId);
      if(!stillCurrent())return;
      uploaded = await uploadOotdImage(file, userId);
    }
    if(!stillCurrent())return;
    success = await sosStore.createSosPost({
    title: title.value,
    details: details.value,
    occasion: occasion.value,
    weather: weather.value,
    when_label: null,
    vibes: [],
    closet_item_ids: selectedClosetItemIds.value,
    cover_url:uploaded?.publicUrl || null, cover_path:uploaded?.path || null,
    cover_item_id:coverMode.value==='closet' ? coverItemId.value : null
  });
    // A network failure can happen after the server commits the post. Do not
    // remove the uploaded cover on an ambiguous result and break a published post.
  } catch { appStore.showToast(t('主圖上傳失敗，請再試一次。'), {type:'error'}); }
  finally { submitting.value=false; }

  if (success) {
    close();
  }
};
</script>

