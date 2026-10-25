<script setup>
import {ref,computed} from 'vue';
import {useAppStore} from '@/stores/app';
import {useAuthStore} from '@/stores/auth';
import {updatePublicProfile} from '@/services/profileRepository';
import {t} from '@/i18n';
const appStore=useAppStore(),authStore=useAuthStore();
const isMember=computed(()=>authStore.isMember);
const openLoginGate=()=>appStore.openLoginGate('SOCIAL_AUTH_REQUIRED','/closet');
const changingVisibility = ref(false);
const togglePublicCloset = async () => {
  if (!isMember.value || !authStore.profileId) { openLoginGate(); return; }
  if (changingVisibility.value) return;
  const profileId = authStore.profileId;
  const next = !appStore.profile.public_closet;
  changingVisibility.value = true;
  try {
    const row = await updatePublicProfile(profileId, { public_closet: next });
    if (row?.public_closet !== next) throw new Error('PROFILE_UPDATE_NOT_CONFIRMED');
    if (profileId !== authStore.profileId) return;
    appStore.profile.public_closet = next;
    authStore.profileIdentity = { ...authStore.profileIdentity, profile: { ...authStore.profile, public_closet: next } };
    appStore.showToast(t(next ? '衣櫥已設為公開' : '衣櫥已設為私人'), { type: 'success', syncStatus: 'SYNCED' });
  } catch {
    appStore.showToast(t('衣櫥設定未儲存，請重試。'), { type: 'error', syncStatus: 'REMOTE_FAILED' });
  } finally { changingVisibility.value = false; }
};

</script>
<template>    <section class="profile-settings" v-if="isMember">
      <h2>{{ $t("衣櫥設定") }}</h2>
      <div class="setting-row">
        <div>
          <strong>{{ $t("公開我的衣櫥") }}</strong>
          <p>{{ $t("讓衣友可以查看你的單品並提供穿搭建議。") }}</p>
        </div>
        <button
          :class="['switch', { on: appStore.profile.public_closet }]"
          :aria-pressed="appStore.profile.public_closet"
          :disabled="changingVisibility"
          :aria-label="t('切換公開衣櫥')"
          @click="togglePublicCloset"
        ></button>
      </div>
    </section></template>
<style scoped>.profile-settings{margin:24px 0;padding:20px;border:1px solid var(--line);border-radius:16px}.setting-row{display:flex;align-items:center;justify-content:space-between;gap:20px}.setting-row p{font-size:13px;line-height:1.6}.switch{width:48px;height:28px;background:#b6ada5;border-radius:20px;border:0;flex-shrink:0}.switch:after{content:"";display:block;width:20px;height:20px;margin:4px;border-radius:50%;background:white}.switch.on{background:#5c7561}.switch.on:after{margin-left:24px}</style>