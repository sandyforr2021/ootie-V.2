<script setup>
import {ref,computed} from 'vue';
import {useAppStore} from '@/stores/app';
import {useAuthStore} from '@/stores/auth';
import {updatePublicProfile} from '@/services/profileRepository';
import {hasOpenSosPost} from '@/services/supabase';
import {t} from '@/i18n';
import BaseModal from '@/components/ui/BaseModal.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
const appStore=useAppStore(),authStore=useAuthStore();
defineProps({ compact: Boolean });
const isMember=computed(()=>authStore.isMember);
const openLoginGate=()=>appStore.openLoginGate('SOCIAL_AUTH_REQUIRED','/closet');
const changingVisibility = ref(false);
const visibilityBlockMessage = ref('');
const closeVisibilityNotice = () => { visibilityBlockMessage.value = ''; };
const togglePublicCloset = async () => {
  if (!isMember.value || !authStore.profileId) { openLoginGate(); return; }
  if (changingVisibility.value) return;
  const profileId = authStore.profileId;
  const next = !appStore.profile.public_closet;
  changingVisibility.value = true;
  try {
    if (!next) {
      let hasOpenPost;
      try {
        hasOpenPost = await hasOpenSosPost(profileId);
      } catch {
        visibilityBlockMessage.value = t('無法確認進行中的求救貼文，請稍後再試。');
        return;
      }
      if (profileId !== authStore.profileId) return;
      if (hasOpenPost) {
        visibilityBlockMessage.value = t('目前還有進行中的 SOS 求救貼文，請先結束所有求救貼文，才能關閉公開衣櫥。');
        return;
      }
    }
    if (profileId !== authStore.profileId) return;
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
<template>
    <section :class="['profile-settings', { compact }]" v-if="isMember">
      <div class="setting-row">
        <div>
          <strong>{{ $t("設定公開") }}</strong>
        </div>
        <button
          :class="['switch', { on: appStore.profile.public_closet }]"
          :aria-pressed="appStore.profile.public_closet"
          :disabled="changingVisibility"
          :aria-label="t('切換公開衣櫥')"
          @click="togglePublicCloset"
        ></button>
      </div>
    </section>
    <BaseModal
      :open="Boolean(visibilityBlockMessage)"
      title-id="closet-visibility-alert-title"
      content-class="closet-visibility-alert"
      @close="closeVisibilityNotice"
    >
      <h2 id="closet-visibility-alert-title">{{ t('無法關閉公開衣櫥') }}</h2>
      <p role="alert">{{ visibilityBlockMessage }}</p>
      <div class="form-actions">
        <BaseButton @click="closeVisibilityNotice">{{ t('知道了') }}</BaseButton>
      </div>
    </BaseModal>
</template>
<style scoped>.profile-settings{max-width:none;margin:24px 0;padding:16px 20px;border:1px solid var(--line);border-radius:16px}.setting-row{padding:0;border:0;display:flex;align-items:center;justify-content:space-between;gap:20px}.setting-row strong{margin:0}.switch{width:48px;height:28px;padding:4px;background:#b6ada5;border-radius:20px;border:0;flex-shrink:0}.switch:after{content:"";display:block;width:20px;height:20px;margin:0;flex:0 0 20px;border-radius:50%;background:white;transform:translateX(0)}.switch.on{background:#5c7561}.switch.on:after{transform:translateX(20px)}</style>
