<template>
  <div v-if="appStore.isProfileEditOpen" class="modal-backdrop open" @click.self="close">
    <section v-accessible-modal class="modal profile-edit-modal">
      <button class="modal-close" :aria-label="$t(&quot;關閉&quot;)" @click="close">×</button>
      <p class="eyebrow">Profile</p><h2>{{ t("編輯個人資料", "Edit profile") }}</h2>
      <form @submit.prevent="handleSubmit">
        <h3>{{ t("公開個人資料", "Public profile") }}</h3>
        <div class="form-grid">
          <div class="form-field"><label for="editProfileName">{{ t("顯示暱稱", "Display name") }}</label><input id="editProfileName" v-model="form.display_name" :disabled="cooldown.locked" required maxlength="30" /><small v-if="cooldown.locked">{{ tf('下次可修改：{date}（還需等待 {days} 天）', { date: formatDate(cooldown.nextChangeAt), days: cooldown.daysRemaining }) }}</small></div>
          <div class="form-field"><label for="editProfileUsername">{{ t("帳號 ID", "Username") }}</label><input id="editProfileUsername" v-model="form.username" required placeholder="@yourname" /></div>
          <div class="form-field full"><label for="editProfileBio">{{ t("個人 Slogan", "Bio") }}</label><textarea id="editProfileBio" v-model="form.slogan" maxlength="120" :placeholder="t('用衣櫥記錄日常，也和衣友分享穿搭靈感。','Everyday outfits, little discoveries and shared inspiration.')"></textarea></div>
          <div class="form-field full"><label>{{ t("大頭貼", "Profile photo") }}</label><div class="avatar-upload-wrap"><label class="avatar-upload" for="avatarUploadFile"><span>{{ t("上傳大頭貼", "Upload photo") }}</span><input id="avatarUploadFile" type="file" accept="image/jpeg,image/png,image/webp" @change="handleAvatarFileSelect" /></label><div class="avatar-preview-shell"><img v-if="avatarPreview.value" class="avatar-preview visible" :src="avatarPreview.value" :alt="t('大頭貼預覽','Profile photo preview')" /></div></div><div v-if="avatarPreview.value" class="avatar-crop-controls"><span>{{ t("已選擇圖片，可在儲存前確認預覽。", "Review your photo before saving.") }}</span></div></div>
        </div>
        <h3>{{ t("私人帳號資料", "Private account details") }}</h3>
        <div class="form-grid">
          <div class="form-field"><label for="editProfileFullName">{{ t("姓名", "Full name") }}</label><input id="editProfileFullName" v-model="form.full_name" :disabled="privateDataPending" /></div>
          <div class="form-field"><label for="editProfileBirthDate">{{ t("生日", "Date of birth") }}</label><input id="editProfileBirthDate" v-model="form.birth_date" type="date" :disabled="privateDataPending" /></div>
          <div class="form-field"><label for="editProfilePhone">{{ t("電話", "Phone") }}</label><input id="editProfilePhone" v-model="form.phone" inputmode="tel" :disabled="privateDataPending" /></div>
          <div class="form-field"><label for="editProfileEmail">Email</label><input id="editProfileEmail" :value="authStore.user?.email || ''" readonly /></div>
        </div>
        <p v-if="authStore.errorMsg" class="form-error" role="alert">{{ t(authStore.errorMsg) }}</p>
        <p v-if="authStore.accountPrivateError" class="form-error" role="alert">{{ t(authStore.accountPrivateError) }} {{ t('請重新開啟編輯後再試。') }}</p>
        <div class="form-actions"><button type="button" class="secondary" @click="close">{{ $t("取消") }}</button><button type="submit" class="primary" :disabled="authStore.loading || privateDataPending || !!authStore.accountPrivateError">{{ t(privateDataPending ? '讀取資料中…' : '儲存資料') }}</button></div>
      </form>
    </section>
  </div>
</template>

<script setup>
import { t, tf, formatDate } from '@/i18n';
import { reactive, ref, computed, watch } from 'vue';
import { useAppStore } from '@/stores/app';
import { useAuthStore } from '@/stores/auth';
import { getDisplayNameCooldown, DEFAULT_PROFILE_SLOGAN } from '@/services/profileContract';
import { validateAvatarFile } from '@/services/avatarService';

const appStore = useAppStore();
const authStore = useAuthStore();
const form = reactive({ display_name: '', username: '', slogan: '', full_name: '', birth_date: '', phone: '' });
const avatarFile = reactive({ value: null });
const avatarPreview = reactive({ value: '' });
const privateDataPending = ref(false);
const cooldown = computed(() => getDisplayNameCooldown(authStore.profile || appStore.profile));

watch(() => appStore.isProfileEditOpen, async (open, _previous, onCleanup) => {
  if (!open) return;
  let cancelled = false;
  onCleanup(() => { cancelled = true; });
  const publicProfile = authStore.profile || appStore.profile;
  form.display_name = publicProfile.display_name || publicProfile.name || publicProfile.username || '';
  form.username = publicProfile.username || '';
  form.slogan = publicProfile.slogan || publicProfile.bio || '';
  avatarFile.value = null;
  avatarPreview.value = publicProfile.avatar_url || '';
  privateDataPending.value = true;
  const privateProfile = await authStore.loadPrivateAccount();
  if (cancelled) return;
  form.full_name = privateProfile?.full_name || '';
  form.birth_date = privateProfile?.birth_date || '';
  form.phone = privateProfile?.phone || '';
  privateDataPending.value = false;
}, { immediate: true });

const handleAvatarFileSelect = (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try { validateAvatarFile(file); } catch (error) { authStore.errorMsg = error.userMessage; return; }
  avatarFile.value = file;
  const reader = new FileReader();
  reader.onload = (evt) => { avatarPreview.value = evt.target.result; };
  reader.readAsDataURL(file);
};

const close = () => { appStore.isProfileEditOpen = false; };

const handleSubmit = async () => {
  if (authStore.loading || privateDataPending.value || authStore.accountPrivateError) return;
  const success = await authStore.saveProfileAccount({ display_name: form.display_name, username: form.username, slogan: form.slogan || DEFAULT_PROFILE_SLOGAN, full_name: form.full_name, birth_date: form.birth_date, phone: form.phone }, avatarFile.value);
  if (success) {
    appStore.setMemberProfile({ display_name: form.display_name, username: form.username, slogan: form.slogan || DEFAULT_PROFILE_SLOGAN, ...(avatarFile.value && !authStore.profile?.avatar_url ? { avatar_url: avatarPreview.value } : {}) });
    appStore.profile.name = form.display_name;
    appStore.profile.bio = form.slogan || DEFAULT_PROFILE_SLOGAN;
    appStore.profile.username = form.username.trim().startsWith('@') ? form.username.trim() : `@${form.username.trim()}`;
    appStore.showToast(t('個人資料已更新'), { type: 'success', syncStatus: 'SYNCED' });
    close();
  }
};
</script>

<style scoped>.profile-edit-modal>h2{padding-right:48px}.profile-edit-modal .form-grid{gap:18px}.profile-edit-modal .form-field{min-width:0}.profile-edit-modal .form-field input{width:100%;box-sizing:border-box}</style>
