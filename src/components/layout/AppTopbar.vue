<template>
  <header class="topbar">
    <BrandMark class="mobile-brand" />
    <div class="top-actions">
      <LanguageSelect />
      <button class="icon-button" :aria-label="$t(&quot;通知&quot;)" :disabled="!authStore.initialized" :aria-busy="!authStore.initialized" @click="openNotifications">
        <svg class="bell-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
        </svg>
        <span
          v-if="unreadCount > 0"
          class="notification-badge"
        >{{ unreadCount }}</span>
      </button>

      <!-- Auth State Indicator -->
      <button v-if="authStore.initialized && !authStore.isLoggedIn" class="btn-primary auth-btn-sm" @click="authStore.openAuthModal('login')">{{ $t("登入 / 註冊") }}</button>

      <div v-else-if="authStore.isLoggedIn" class="avatar-group">
        <button
          type="button"
          class="account-trigger"
          :aria-expanded="isProfileMenuOpen"
          aria-haspopup="dialog"
          :aria-label="$t(&quot;會員功能&quot;)"
          @click="toggleProfileMenu"
        >
          <span class="avatar is-logged-in" :class="{ 'has-image': appStore.profile.avatar_url }">
            <img v-if="appStore.profile.avatar_url" :src="appStore.profile.avatar_url" :alt="`${appStore.profile.name} 的大頭貼`" />
            <span v-else>{{ appStore.profile.initials || 'O' }}</span>
          </span>
          <span class="account-name">{{ appStore.profile.name || appStore.profile.username || $t('我的帳號') }}</span>
          <svg class="account-chevron" viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg>
        </button>
      </div>
    </div>

    <!-- Profile Popover Menu (legacy/qingnian integration) -->
    <div v-if="isProfileMenuOpen" class="popover-backdrop open" @click.self="closeProfileMenu">
      <section class="popover profile-popover">
        <button class="popover-close" :aria-label="$t(&quot;關閉&quot;)" @click="closeProfileMenu">×</button>
        <div class="popover-avatar">
          <img v-if="appStore.profile.avatar_url" :src="appStore.profile.avatar_url" :alt="appStore.profile.name" />
          <template v-else>{{ appStore.profile.initials || 'O' }}</template>
        </div>
        <div class="popover-copy">
          <strong>{{ appStore.profile.name || $t('我的帳號') }}</strong>
          <span>{{ appStore.profile.username || '' }}</span>
        </div>
        <div class="popover-stats">
          <div class="popover-stat">
            <strong>{{ appStore.profile.hearts || 0 }}</strong>
            <span>Hearts</span>
          </div>
          <div class="popover-stat">
            <strong>{{ appStore.profile.helped || 0 }}</strong>
            <span>{{ $t("幫助衣友") }}</span>
          </div>
          <div class="popover-stat">
            <strong>{{ appStore.profile.likes || 0 }}</strong>
            <span>{{ $t("獲得讚數") }}</span>
          </div>
        </div>
        <div class="popover-actions">
          <router-link to="/profile" class="btn-primary popover-btn" @click="closeProfileMenu">{{ $t("前往個人檔案") }}</router-link>
          <router-link to="/settings" class="btn-secondary popover-btn" @click="closeProfileMenu">{{ $t("帳號設定") }}</router-link>
          <button class="btn-secondary popover-btn" @click="handleLogout">{{ $t("登出") }}</button>
        </div>
      </section>
    </div>
  </header>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAppStore } from '@/stores/app';
import { useAuthStore } from '@/stores/auth';
import { useSocialStore } from '@/stores/social';
import BrandMark from './BrandMark.vue';
import LanguageSelect from './LanguageSelect.vue';

const appStore = useAppStore();
const authStore = useAuthStore();
const socialStore = useSocialStore();
const router = useRouter();
const isProfileMenuOpen = ref(false);

const unreadCount = computed(() => {
  return authStore.isMember ? socialStore.unreadCount : 0;
});

const openNotifications = () => {
  if (!authStore.initialized) return;
  if (!authStore.isMember) {
    authStore.openAuthModal('login', null, '/');
    return;
  }
  appStore.isNotificationOpen = true;
};

const toggleProfileMenu = () => {
  isProfileMenuOpen.value = !isProfileMenuOpen.value;
};

const closeProfileMenu = () => {
  isProfileMenuOpen.value = false;
};

const handleLogout = async () => {
  closeProfileMenu();
  await authStore.logout();
  appStore.showToast('已登出');
};

onMounted(() => {
  authStore.initAuth().then(() => {
    if (authStore.profileId) socialStore.refresh(authStore.profileId);
    const returnTo = authStore.consumeOAuthReturnTo();
    if (returnTo && returnTo !== '/') router.replace(returnTo);
  });
});

watch(() => authStore.profileId, (profileId) => {
  if (profileId) socialStore.refresh(profileId);
  else socialStore.clear();
});
</script>

<style scoped>
.top-actions{gap:14px;display:flex;align-items:center}.popover-copy{flex-direction:column;gap:5px;padding-right:30px;overflow-wrap:anywhere}

.auth-btn-sm {
  border: 1px solid var(--ink);
  padding: 9px 17px;
  background: var(--ink);
  color: #fff;
  font-size: 0.85rem;
  font-weight: 600;
  border-radius: 999px;
  box-shadow: 0 8px 18px rgba(31,30,33,.14);
  transition: transform .18s ease,box-shadow .18s ease;
}

.auth-btn-sm:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 24px rgba(31,30,33,.2);
}

.avatar-group {
  display: flex;
  align-items: center;
}

.account-trigger {
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  gap: 9px;
  padding: 2px 6px 2px 2px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--ink);
  user-select: none;
}

.account-trigger:hover .avatar,
.account-trigger:focus-visible .avatar {
  box-shadow: 0 0 0 3px var(--accent-yellow);
}

.avatar {
  width: 40px;
  height: 40px;
  aspect-ratio: 1;
  flex: 0 0 40px;
  overflow: hidden;
  border-radius: 50%;
  transition: box-shadow .18s ease;
}

.avatar img {
  width: 100%;
  height: 100%;
  display: block;
  border-radius: inherit;
  object-fit: cover;
}

.account-name {
  max-width: 150px;
  overflow: hidden;
  font-size: 13px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.account-chevron {
  width: 15px;
  height: 15px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.6;
}

.bell-icon {
  width: 19px;
  height: 19px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.7;
}

.popover-backdrop {
  position: fixed;
  inset: 0;
  z-index: 999;
  background: rgba(31, 30, 33, 0.24);
  backdrop-filter: blur(4px);
  display: flex;
  justify-content: flex-end;
  align-items: flex-start;
  padding-top: 60px;
  padding-right: 20px;
}

.profile-popover {
  width: min(320px, calc(100vw - 32px));
  background: var(--surface-raised);
  border: 1px solid var(--line);
  border-radius: 20px;
  box-shadow: var(--shadow);
  padding: 24px 20px;
  position: relative;
  color: var(--ink);
}

.popover-close {
  position: absolute;
  right: 14px;
  top: 14px;
  width: 44px;
  height: 44px;
  border: none;
  background: var(--accent-pink-soft);
  color: var(--ink);
  border-radius: 50%;
  font-size: 16px;
  cursor: pointer;
  display: grid;
  place-items: center;
}

.popover-avatar {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--accent-yellow-soft);
  color: #111;
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 14px;
  overflow: hidden;
}
.popover-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.popover-copy {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 18px;
}
.popover-copy strong {
  font-size: 1rem;
  font-weight: 700;
}
.popover-copy span {
  color: var(--muted);
  font-size: 0.8rem;
}

.popover-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--line);
}

.popover-stat {
  text-align: center;
}
.popover-stat strong {
  display: block;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--accent-violet-ink);
}
.popover-stat span {
  color: var(--muted);
  font-size: 0.72rem;
}

.popover-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.popover-btn {
  text-align: center;
  border-radius: 10px;
  padding: 10px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
}

.popover-actions .btn-primary {
  border: 1px solid var(--ink);
  background: var(--ink);
  color: #fff;
}

.popover-actions .btn-secondary {
  border: 1px solid var(--line);
  background: var(--white);
  color: var(--ink);
}

@media (max-width: 620px) {
  .account-trigger { padding-right: 2px; }
  .account-name, .account-chevron { display: none; }
  .avatar { width: 34px; height: 34px; flex-basis: 34px; }
}
</style>
