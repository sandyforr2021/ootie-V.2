<template>
  <BaseModal
    :open="authStore.isAuthModalOpen"
    title-id="auth-modal-title"
    content-class="auth-modal"
    @close="close"
  >
      <div class="auth-header">
        <h2 id="auth-modal-title">{{ isLoginMode ? $t('歡迎回來') : $t('建立 OOTIE 帳號') }}</h2>
        <p class="auth-subtitle">
          {{ isLoginMode ? $t('登入後繼續整理衣櫥與收藏穿搭。') : $t('從自己的衣服開始，慢慢整理出喜歡的風格。') }}
        </p>
      </div>

      <div class="auth-tabs">
        <button
          type="button"
          class="auth-tab"
          :class="{ active: isLoginMode }"
          @click="switchMode('login')"
        >{{ $t("登入") }}</button>
        <button
          type="button"
          class="auth-tab"
          :class="{ active: !isLoginMode }"
          @click="switchMode('register')"
        >{{ $t("註冊") }}</button>
      </div>

      <form @submit.prevent="handleSubmit" class="auth-form">
        <div v-if="authStore.errorMsg" class="auth-error-alert" role="alert" aria-live="assertive">
          <span>{{ $t(authStore.errorMsg) }}</span>
        </div>

        <div class="oauth-actions" :aria-label="$t(&quot;第三方登入&quot;)">
          <BaseButton type="button" variant="ghost" class="google-auth-button" :disabled="authStore.loading" :aria-label="isLoginMode ? $t('使用 Google 帳號登入') : $t('使用 Google 建立帳號')" @click="handleProviderLogin('google')">
            <svg class="google-mark" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.19-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.41Z"/>
              <path fill="#34A853" d="M12 22c2.7 0 4.98-.9 6.64-2.43l-3.24-2.53c-.9.6-2.05.96-3.4.96-2.61 0-4.82-1.76-5.61-4.13H3.05v2.62A10 10 0 0 0 12 22Z"/>
              <path fill="#FBBC05" d="M6.39 13.87A6.02 6.02 0 0 1 6.08 12c0-.65.11-1.28.31-1.87V7.51H3.05A10 10 0 0 0 2 12c0 1.61.39 3.13 1.05 4.49l3.34-2.62Z"/>
              <path fill="#EA4335" d="M12 6c1.47 0 2.79.5 3.82 1.49l2.87-2.87A9.63 9.63 0 0 0 12 2a10 10 0 0 0-8.95 5.51l3.34 2.62C7.18 7.76 9.39 6 12 6Z"/>
            </svg>
            <span>{{ isLoginMode ? $t('使用 Google 登入') : $t('使用 Google 建立帳號') }}</span>
          </BaseButton>
        </div>

        <p v-if="!isLoginMode" class="auth-subtitle">{{ $t('使用 Google 即可建立帳號。已有帳號可切換至登入。') }}</p>
        <template v-if="isLoginMode">
        <div class="auth-divider"><span>{{ $t("或使用電子郵件") }}</span></div>

        <BaseInput
            id="authEmail"
            v-model="form.email"
            :label="$t(&quot;電子郵件&quot;)"
            type="email"
            required
            placeholder="name@example.com"
        />

        <BaseInput
            id="authPassword"
            v-model="form.password"
            :label="$t(&quot;密碼&quot;)"
            type="password"
            required
            minlength="6"
            :placeholder="$t(&quot;請輸入至少 6 位字元密碼&quot;)"
        />

        <div class="form-actions">
          <BaseButton variant="ghost" @click="close">{{ $t("取消") }}</BaseButton>
          <BaseButton type="submit" :loading="authStore.loading">
            {{ isLoginMode ? $t('立即登入') : $t('完成註冊') }}
          </BaseButton>
        </div>
        </template>
      </form>
  </BaseModal>
</template>

<script setup>
import { t } from '@/i18n';
import { reactive, computed } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useAppStore } from '@/stores/app';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseInput from '@/components/ui/BaseInput.vue';
import BaseModal from '@/components/ui/BaseModal.vue';

const authStore = useAuthStore();
const appStore = useAppStore();
const route = useRoute();

const isLoginMode = computed(() => authStore.authMode === 'login');

const form = reactive({
  email: '',
  password: ''
});

const switchMode = (mode) => {
  authStore.authMode = mode;
  authStore.errorMsg = '';
};

const close = () => {
  authStore.closeAuthModal();
};

const handleSubmit = async () => {
  if (!isLoginMode.value) return;
  if (isLoginMode.value) {
    const success = await authStore.login(form.email, form.password);
    if (success) {
      appStore.showToast(t('登入成功！歡迎回來'), { type: 'success' });
    }
  }
};

const handleProviderLogin = async (provider) => {
  const success = await authStore.signInWithProvider(provider, authStore.oauthReturnTo || route.fullPath || '/');
  if (success) appStore.showToast(t('正在前往登入服務…'), { type: 'info' });
};
</script>

<style scoped>
:deep(.auth-modal) {
  width: min(calc(100vw - 32px), 480px);
  max-width: 480px;
  max-height: min(92dvh, 720px);
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  border-radius: 20px;
  background: var(--surface-raised, #fffdf8);
  border: 1px solid rgba(35, 33, 39, 0.08);
  padding: 34px 34px 30px;
  box-shadow: 0 24px 70px rgba(44, 38, 48, 0.16);
}

.auth-header {
  margin-bottom: 24px;
  padding-right: 34px;
}

.auth-header h2 {
  font-size: clamp(1.55rem, 4vw, 1.85rem);
  font-weight: 700;
  line-height: 1.2;
  margin: 0 0 8px;
  overflow-wrap: anywhere;
}

.auth-subtitle {
  font-size: 0.875rem;
  color: var(--muted, #69656d);
  line-height: 1.65;
  margin: 0;
  overflow-wrap: anywhere;
}

.auth-tabs {
  display: flex;
  gap: 24px;
  margin-bottom: 22px;
  border-bottom: 1px solid var(--line);
}

.auth-tab {
  flex: 1;
  min-height: 44px;
  padding: 8px 2px 10px;
  border: none;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--muted, #69656d);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: color 0.18s ease, border-color 0.18s ease;
}

.auth-tab.active {
  border-bottom-color: var(--ink, #1d1c1f);
  color: var(--ink, #1d1c1f);
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.oauth-actions {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
  margin-bottom: 4px;
}

.google-auth-button {
  width: 100%;
  border-color: var(--line);
  color: var(--ink);
  background: #fff;
}

.google-auth-button:hover { border-color: var(--ink); }

.google-auth-button :deep(> span:not(.base-button__spinner)) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.google-mark { width: 20px; height: 20px; flex: 0 0 20px; }

.auth-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--muted);
  font-size: 12px;
  text-align: center;
}

.auth-divider::before,
.auth-divider::after {
  content: "";
  height: 1px;
  flex: 1;
  background: var(--line);
}

.auth-error-alert {
  background: #fff3f1;
  border: 1px solid #e7bbb5;
  color: #8e3f3b;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 0.85rem;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-field label {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--text-main, #e0e0e0);
}

.form-field input {
  width: 100%;
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(0, 0, 0, 0.3);
  color: #fff;
  font-size: 0.95rem;
  outline: none;
  transition: border-color 0.2s;
}

.form-field input:focus {
  border-color: var(--accent, #c9a96e);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 12px;
}

.form-actions :deep(button),
.oauth-actions :deep(button) {
  min-height: 46px;
  line-height: 1.35;
  white-space: normal;
}

@media (max-width: 480px) {
  :deep(.auth-modal) {
    width: min(calc(100vw - 24px), 480px);
    max-height: calc(100dvh - 24px);
    padding: 28px 20px 22px;
    border-radius: 18px;
  }

  .auth-header {
    margin-bottom: 20px;
    padding-right: 28px;
  }

  .auth-subtitle {
    font-size: 0.84rem;
  }

  .auth-form {
    gap: 13px;
  }

  .oauth-actions {
    grid-template-columns: 1fr;
  }

  .form-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    margin-top: 6px;
  }
}
</style>
