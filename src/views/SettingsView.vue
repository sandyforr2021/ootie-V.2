<template>
  <section class="page active settings-page" aria-labelledby="settings-title">
    <template v-if="authStore.isMember">
      <div class="settings-hero">
        <div>
          <h1 id="settings-title">{{ $t("帳號設定") }}</h1>
          <p>{{ $t("管理公開資料、私人偏好與帳號安全。私人資料不會顯示在公開個人檔案。") }}</p>
        </div>
        <router-link class="secondary settings-profile-link" to="/profile">{{ $t("查看個人檔案") }}</router-link>
      </div>

      <div class="settings-layout">
        <section class="settings-panel" aria-labelledby="account-heading">
          <div class="settings-panel-heading">
            <div><h2 id="account-heading">{{ $t("帳號") }}</h2><p>{{ $t("登入身分與目前工作階段") }}</p></div>
            <span class="settings-security-badge">{{ $t("已驗證") }}</span>
          </div>
          <dl class="settings-details">
            <div><dt>{{ $t("電子郵件") }}</dt><dd>{{ authStore.user?.email }}</dd></div>
            <div><dt>{{ $t("登入方式") }}</dt><dd>{{ providerLabel }}</dd></div>
            <div><dt>{{ $t("最近登入") }}</dt><dd>{{ lastSignIn }}</dd></div>
          </dl>
        </section>

        <section class="settings-panel" aria-labelledby="security-heading">
          <div class="settings-panel-heading">
            <div><h2 id="security-heading">{{ $t("安全性") }}</h2><p>{{ $t("密碼重設與登入安全") }}</p></div>
          </div>
          <div class="settings-actions">
            <button type="button" class="secondary" :disabled="authStore.loading" @click="sendReset">{{ $t("寄送密碼重設信") }}</button>
            <button v-if="hasPasswordIdentity" type="button" class="text-button" @click="showPasswordForm = !showPasswordForm">{{ showPasswordForm ? '收起密碼變更' : '直接變更密碼' }}</button>
          </div>
          <form v-if="showPasswordForm" class="settings-password-form" @submit.prevent="changePassword">
            <label for="settingsCurrentPassword">目前密碼</label>
            <input id="settingsCurrentPassword" v-model="currentPassword" type="password" autocomplete="current-password" required />
            <label for="settingsPassword">新密碼</label>
            <input id="settingsPassword" v-model="password" type="password" minlength="8" autocomplete="new-password" required aria-describedby="settingsPasswordHint" />
            <label for="settingsPasswordConfirm">再次輸入新密碼</label>
            <input id="settingsPasswordConfirm" v-model="passwordConfirm" type="password" minlength="8" autocomplete="new-password" required />
            <small id="settingsPasswordHint">至少 8 個字元。儲存後請使用新密碼登入。</small>
            <button type="submit" class="primary" :disabled="authStore.loading">更新密碼</button>
          </form>
          <p v-if="authStore.errorMsg" class="form-error" role="alert">{{ authStore.errorMsg }}</p>
        </section>

        <section class="settings-panel" aria-labelledby="profile-heading">
          <div class="settings-panel-heading"><div><h2 id="profile-heading">個人資料</h2><p>公開暱稱與私人帳號資料分開保存</p></div></div>
          <dl class="settings-details">
            <div><dt>顯示暱稱</dt><dd>{{ profileName }}</dd></div>
            <div><dt>帳號 ID</dt><dd>{{ appStore.profile.username }}</dd></div>
            <div><dt>個人 Slogan</dt><dd>{{ appStore.profile.bio || '尚未設定' }}</dd></div>
          </dl>
          <button type="button" class="secondary" @click="appStore.isProfileEditOpen = true">編輯個人資料</button>
        </section>

        <section class="settings-panel" aria-labelledby="weather-heading">
          <div class="settings-panel-heading"><div><h2 id="weather-heading">{{ $t("偏好設定") }}</h2><p>{{ $t("你的城市偏好，不會公開顯示。") }}</p></div></div>
          <form class="settings-city-form" @submit.prevent="saveWeatherCity">
            <label for="settingsWeatherCity">{{ $t("城市") }}</label>
            <input id="settingsWeatherCity" v-model.trim="weatherCity" maxlength="80" :placeholder="$t(&quot;例如：台北&quot;)" />
            <button type="submit" class="secondary" :disabled="savingCity">{{ $t("儲存城市") }}</button>
          </form>
        </section>

        <section class="settings-panel settings-membership" aria-labelledby="membership-heading">
          <div class="settings-panel-heading"><div><h2 id="membership-heading">{{ $t("購物足跡") }}</h2><p>{{ $t("查看收藏、試穿與前往商家的紀錄。") }}</p></div></div>
          <router-link class="primary" to="/shop?tab=activity">{{ $t("前往購物足跡") }}</router-link>
        </section>

        <section class="settings-panel"><ExtensionGuide /></section>

        <section v-if="canInstallApp" class="settings-panel settings-install" aria-labelledby="install-heading">
          <div class="settings-panel-heading"><div><h2 id="install-heading">{{ $t("加入主畫面") }}</h2><p>{{ $t("加入主畫面，以獨立視窗快速開啟") }}</p></div><span class="settings-security-badge">PWA</span></div>
          <p class="settings-install-copy">安裝不會把私人衣櫥、AI 圖片或登入資料存進離線快取。</p>
          <button type="button" class="secondary" @click="installApp">{{ $t("加入這台裝置") }}</button>
        </section>

        <section class="settings-panel settings-legal" aria-labelledby="legal-heading">
          <div class="settings-panel-heading"><div><h2 id="legal-heading">{{ $t("資訊與法律") }}</h2><p>{{ $t("查看隱私、使用條款與 AI 圖像說明") }}</p></div></div>
          <nav :aria-label="$t(&quot;資訊與法律&quot;)">
            <router-link to="/legal/privacy">{{ $t("隱私權說明") }}</router-link>
            <router-link to="/legal/terms">{{ $t("使用條款") }}</router-link>
            <router-link to="/legal/ai">{{ $t("AI 圖像使用說明") }}</router-link>
          </nav>
        </section>
      </div>

      <div class="settings-footer-actions">
        <p>{{ $t("私人資料只在登入後顯示，登出後即停止存取。") }}</p>
        <button type="button" class="secondary" @click="logout">{{ $t("登出") }}</button>
      </div>
    </template>

    <div v-else class="settings-guest-state">
      <h1 id="settings-title">登入後管理帳號設定</h1>
      <p>帳號、安全與私人偏好只對本人開放。</p>
      <button type="button" class="primary" @click="authStore.openAuthModal('login', null, '/settings')">會員登入</button>
    </div>
  </section>
</template>

<script setup>
import ExtensionGuide from '@/components/bookmarks/ExtensionGuide.vue';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useAppStore } from '@/stores/app';
import { upsertPrivateProfile } from '@/services/profileRepository';
import { requestPwaInstall, subscribeToInstallAvailability } from '@/services/pwa';

const authStore = useAuthStore();
const appStore = useAppStore();
const router = useRouter();
const showPasswordForm = ref(false);
const currentPassword = ref('');
const password = ref('');
const passwordConfirm = ref('');
const weatherCity = ref('');
const savingCity = ref(false);
const canInstallApp = ref(false);
let unsubscribeInstall;
const profileName = computed(() => appStore.profile.name || appStore.profile.display_name || '尚未設定');
const providerLabel = computed(() => authStore.user?.app_metadata?.provider === 'google' ? 'Google' : '電子郵件與密碼');
const hasPasswordIdentity = computed(() => (authStore.user?.identities || []).some((identity) => identity.provider === 'email'));
const lastSignIn = computed(() => authStore.user?.last_sign_in_at ? new Date(authStore.user.last_sign_in_at).toLocaleString('zh-TW') : '目前工作階段');

onMounted(async () => {
  unsubscribeInstall = subscribeToInstallAvailability((available) => { canInstallApp.value = available; });
  const privateProfile = await authStore.loadPrivateAccount();
  weatherCity.value = privateProfile?.weather_city || '';
});
onBeforeUnmount(() => unsubscribeInstall?.());

const installApp = async () => {
  const result = await requestPwaInstall();
  if (result === 'ACCEPTED') appStore.showToast('OOTIE 已加入這台裝置。', { type: 'success' });
};

const sendReset = async () => {
  if (await authStore.requestPasswordReset()) appStore.showToast('密碼重設信已寄出，請查看信箱。', { type: 'success' });
};
const changePassword = async () => {
  if (password.value !== passwordConfirm.value) {
    authStore.errorMsg = '兩次輸入的新密碼不一致。';
    return;
  }
  if (await authStore.updatePassword(password.value, currentPassword.value)) {
    currentPassword.value = '';
    password.value = '';
    passwordConfirm.value = '';
    showPasswordForm.value = false;
    appStore.showToast('密碼已更新。', { type: 'success' });
  }
};
const saveWeatherCity = async () => {
  if (!authStore.profileId) return;
  savingCity.value = true;
  try {
    const current = authStore.accountPrivate || {};
    await upsertPrivateProfile(authStore.profileId, { ...current, weather_city: weatherCity.value || null });
    await authStore.loadPrivateAccount();
    appStore.showToast('天氣城市已儲存。', { type: 'success', syncStatus: 'SYNCED' });
  } catch (error) {
    appStore.showToast(error?.userMessage || '城市偏好儲存失敗。', { type: 'error' });
  } finally {
    savingCity.value = false;
  }
};
const logout = async () => {
  await authStore.logout();
  await router.replace('/');
  appStore.showToast('已登出');
};
</script>

<style scoped>
.settings-page{max-width:1160px}.settings-hero{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;margin-bottom:28px}.settings-hero h1{margin:0 0 8px;font-size:clamp(36px,5vw,64px);letter-spacing:-.04em}.settings-hero p{max-width:60ch;margin:0;color:var(--muted);line-height:1.7}.settings-profile-link{flex:none}.settings-layout{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.settings-panel{min-width:0;padding:24px;border-radius:var(--radius-card);background:var(--surface-raised);box-shadow:var(--shadow-soft)}.settings-panel-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:20px}.settings-panel h2{margin:0 0 5px;font-size:22px}.settings-panel-heading p{margin:0;color:var(--muted);font-size:14px}.settings-security-badge{padding:6px 10px;border-radius:999px;background:var(--accent-blue-soft);font-size:11px;font-weight:800}.settings-details{display:grid;margin:0 0 20px}.settings-details div{display:grid;grid-template-columns:120px minmax(0,1fr);gap:16px;padding:12px 0;border-bottom:1px solid var(--line)}.settings-details dt{color:var(--muted);font-size:13px}.settings-details dd{min-width:0;margin:0;overflow-wrap:anywhere;font-weight:650}.settings-actions{display:flex;flex-wrap:wrap;gap:10px}.text-button{min-height:44px;border:0;background:transparent;color:var(--accent-violet-ink);font-weight:750}.settings-password-form,.settings-city-form{display:grid;gap:10px;margin-top:18px}.settings-password-form input,.settings-city-form input{width:100%;min-height:48px;padding:0 14px;border:1px solid var(--line);border-radius:var(--radius-control);background:#fff}.settings-password-form small{color:var(--muted)}.settings-password-form button,.settings-city-form button{justify-self:start}.settings-membership{background:linear-gradient(130deg,var(--accent-yellow-soft),#fff 72%)}.settings-membership .primary{display:inline-flex}.settings-footer-actions{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-top:24px;padding:20px 0}.settings-footer-actions nav{display:flex;flex-wrap:wrap;gap:18px}.settings-footer-actions a{text-decoration:underline;text-underline-offset:4px}.settings-guest-state{max-width:720px;margin:10vh auto;padding:40px;text-align:center;border-radius:var(--radius-card);background:var(--surface-raised);box-shadow:var(--shadow-soft)}.settings-guest-state h1{font-size:clamp(32px,6vw,54px);letter-spacing:-.04em}.settings-guest-state p{color:var(--muted)}@media(max-width:760px){.settings-hero{align-items:flex-start;flex-direction:column}.settings-layout{grid-template-columns:1fr}.settings-panel{padding:20px}.settings-details div{grid-template-columns:1fr;gap:4px}.settings-footer-actions{align-items:stretch;flex-direction:column}.settings-footer-actions .secondary{width:100%}}
.settings-install{background:linear-gradient(130deg,var(--accent-blue-soft),#fff 74%)}
.settings-install-copy{color:var(--muted);line-height:1.65}
.settings-legal nav{display:flex;flex-wrap:wrap;gap:10px}.settings-legal a{min-height:44px;display:inline-flex;align-items:center;padding:0 14px;border:1px solid var(--line);border-radius:var(--radius-control);background:#fff;font-weight:700}.settings-footer-actions p{margin:0;color:var(--muted);font-size:13px}
</style>
