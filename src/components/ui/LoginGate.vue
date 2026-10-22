<template>
  <BaseModal
    :open="appStore.isLoginGateOpen"
    title-id="login-gate-title"
    content-class="login-gate-modal"
    @close="appStore.closeLoginGate()"
  >
    <p class="eyebrow">OOTie Member Access</p>
    <h2 id="login-gate-title">{{ copy.title }}</h2>
    <p class="login-gate-copy">{{ copy.body }}</p>
    <div class="login-gate-actions">
      <button type="button" class="primary" @click="openLogin">{{ $t("登入／註冊") }}</button>
      <button type="button" class="secondary" @click="appStore.closeLoginGate()">{{ $t("稍後") }}</button>
    </div>
  </BaseModal>
</template>

<script setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAppStore } from '@/stores/app';
import { useAuthStore } from '@/stores/auth';
import BaseModal from './BaseModal.vue';

const appStore = useAppStore();
const authStore = useAuthStore();
const router = useRouter();

const copy = computed(() => {
  const messages = {
    CLOSET_LIMIT: {
      title: '登入後繼續建立你的衣櫥',
      body: '你已使用 2 件免費試用額度。登入會員即可繼續新增衣物。'
    },
    AI_GUEST_LIMIT: {
      title: '登入會員後繼續使用 OOTie AI',
      body: '你已使用訪客試用次數。登入會員即可繼續取得穿搭提案。'
    },
    TRYON_AUTH_REQUIRED: {
      title: '登入後使用虛擬試穿',
      body: '建立你的個人衣櫥，就能選擇衣物進行虛擬試穿。'
    },
    OOTD_PUBLISH_AUTH_REQUIRED: {
      title: '登入後發布 OOTD',
      body: '登入會員即可使用自己的身分發布穿搭，並標註遠端衣櫥中的單品。'
    },
    AUTH_REQUIRED: {
      title: '登入後繼續使用 OOTie',
      body: '登入會員即可保留你的個人資料並使用這項功能。'
    }
  };
  return messages[appStore.loginGateReason] || messages.AUTH_REQUIRED;
});

const openLogin = () => {
  const returnTo = appStore.loginGateReturnTo || '/';
  appStore.closeLoginGate();
  authStore.openAuthModal('login', () => router.push(returnTo), returnTo);
};
</script>

<style scoped>
.login-gate-modal {
  width: min(440px, calc(100vw - 32px));
  padding: 30px;
}

.login-gate-modal h2 {
  margin: 8px 0 12px;
  font-family: "Playfair Display", serif;
  font-size: 28px;
}

.login-gate-copy {
  color: var(--muted);
  line-height: 1.6;
  margin-bottom: 24px;
}

.login-gate-actions {
  display: flex;
  gap: 10px;
}

.login-gate-actions button {
  flex: 1;
}
</style>
