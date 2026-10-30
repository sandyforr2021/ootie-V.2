<template>
  <div v-if="appStore.isNotificationOpen" class="modal-backdrop open" @click.self="close">
    <section v-accessible-modal class="modal notification-modal">
      <button class="modal-close" :aria-label="$t(&quot;關閉&quot;)" @click="close">×</button>
      <div class="notification-heading">
        <div><h2>{{ $t("通知") }}</h2><span v-if="socialStore.unreadCount" class="unread-summary">{{ socialStore.unreadCount }} 則未讀</span></div>
        <button v-if="socialStore.unreadCount" type="button" class="text-button" @click="markAllRead">全部標為已讀</button>
      </div>

      <div v-if="socialStore.loading" class="notification-state" role="status">正在載入通知…</div>
      <div v-else-if="socialStore.error" class="notification-state error" role="alert">{{ socialStore.error }}</div>
      <div v-else-if="!socialStore.notifications.length" class="notification-state">目前沒有新通知。</div>
      <div v-else class="notification-list">
        <div
          v-for="notification in socialStore.notifications"
          :key="notification.id"
          :class="['notification-item', { unread: !notification.read }]"
          role="button"
          tabindex="0"
          @click="handleNotificationClick(notification, $event)"
          @keydown.enter.prevent="handleNotificationClick(notification, $event)"
          @keydown.space.prevent="handleNotificationClick(notification, $event)"
        >
          <button v-if="notification.actor" type="button" class="notification-actor" :aria-label="`查看 ${notification.actor.display_name || notification.actor.username} 的個人檔案`" @click.stop="openActor(notification.actor)">
            <img v-if="notification.actor.avatar_url" :src="notification.actor.avatar_url" alt="" />
            <span v-else aria-hidden="true">{{ notificationIcon(notification) }}</span>
          </button>
          <span v-else :class="['notification-icon', `is-${notificationKind(notification)}`]" aria-hidden="true">{{ notificationIcon(notification) }}</span>
          <span class="notification-copy">
            <span class="notification-message">
              <template v-for="(part, index) in notificationParts(notification)" :key="`${notification.id}-${index}`">
                <button v-if="part.user" type="button" class="notification-user-link" :data-user="part.text" @click.stop="openUser(part.text)">{{ part.text }}</button>
                <span v-else>{{ part.text }}</span>
              </template>
            </span>
            <span class="notification-time">{{ notification.time }}</span>
          </span>
          <span v-if="!notification.read" class="unread-dot"><span class="sr-only">未讀</span></span>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router';
import { useAppStore } from '@/stores/app';
import { useSocialStore } from '@/stores/social';
import { resolveNotificationTarget } from '@/services/notificationNavigation';

const appStore = useAppStore();
const socialStore = useSocialStore();
const router = useRouter();

const close = () => {
  appStore.isNotificationOpen = false;
};

const notificationKind = (notification) => {
  const source = `${notification?.event_type || notification?.type || ''} ${notification?.text || ''} ${notification?.target || ''} ${notification?.target_path || ''}`.toLowerCase();
  if (source.includes('sos') || source.includes('建議') || source.includes('求救')) return 'sos';
  if (source.includes('follow') || source.includes('追蹤')) return 'follow';
  if (source.includes('like') || source.includes('喜歡')) return 'like';
  if (source.includes('point') || source.includes('點數') || source.includes('方案')) return 'points';
  if (source.includes('ai') || source.includes('預覽')) return 'ai';
  return 'community';
};
const notificationLabels = { sos: 'SOS', follow: '追蹤', like: '喜歡', points: '點數', ai: 'AI', community: '社群' };
const notificationIcons = { sos: '✦', follow: '+', like: '♡', points: 'P', ai: '✧', community: '•' };
const notificationLabel = (notification) => notificationLabels[notificationKind(notification)];
const notificationIcon = (notification) => notificationIcons[notificationKind(notification)];
const notificationParts = (notification) => String(notification?.text || '').split(/(@[a-zA-Z0-9_-]+)/g).filter(Boolean).map((text) => ({ text, user: /^@[a-zA-Z0-9_-]+$/.test(text) }));

const openUser = (username) => {
  close();
  router.push({ path: '/profile', query: { user: username } });
};
const openActor = (actor) => openUser(actor?.username || '');

const markAllRead = async () => {
  try {
    await socialStore.markAllRead();
    appStore.showToast('通知已全部標為已讀', { type: 'success', syncStatus: 'SYNCED' });
  } catch (error) {
    appStore.showToast(error?.userMessage || '通知狀態更新失敗，請稍後再試。', { type: 'error', syncStatus: 'REMOTE_FAILED' });
  }
};

const handleNotificationClick = async (notification, event) => {
  try {
    await socialStore.markRead(notification.id);
  } catch (error) {
    appStore.showToast(error?.userMessage || '通知狀態更新失敗。', { type: 'error', syncStatus: 'REMOTE_FAILED' });
    return;
  }
  // Check if clicked element was a user link
  const userLink = event.target.closest?.('.notification-user-link');
  if (userLink && userLink.dataset.user) {
    event.stopPropagation();
    close();
    router.push({ path: '/profile', query: { user: userLink.dataset.user } });
    return;
  }

  close();

  const resolvedTarget = resolveNotificationTarget(notification);
  if (notification.target_path || notification.event_type) {
    if (resolvedTarget) router.push(resolvedTarget);
    else {
      appStore.showToast('這則通知的內容已無法開啟，已帶你回到通知來源。', { type: 'warning' });
      router.push('/profile');
    }
    return;
  }

  if (notification.postId) {
    const post = appStore.ootdPosts.find((p) => String(p.id) === String(notification.postId));
    if (!post) {
      appStore.showToast('找不到這則通知對應的貼文');
      return;
    }
    appStore.activeCommentPostId = post.id;
    appStore.highlightedCommentId = notification.commentId || null;
    appStore.isCommentOpen = true;
    router.push({ path: '/explore', query: { post: post.id, comment: notification.commentId } });
    return;
  }

  if (notification.sosId) {
    const sos = appStore.sosPosts.find((s) => String(s.id) === String(notification.sosId));
    if (!sos) {
      appStore.showToast('找不到這則通知對應的求救');
      return;
    }
    appStore.activeSosDetailId = sos.id;
    appStore.isSosDetailOpen = true;
    router.push({ path: '/sos', query: { sos: sos.id } });
    return;
  }

  const target = notification.target ? `/${notification.target}` : '/profile';
  router.push(target);
};
</script>

<style scoped>
.notification-modal { width:min(calc(100vw - 28px),560px); max-height:min(82dvh,720px); overflow:auto; padding:30px; border-radius:28px; background:var(--surface-raised); }
.notification-heading { display:flex; align-items:flex-end; justify-content:space-between; gap:16px; margin-bottom:18px; }
.notification-heading h2 { margin:0; font-size:32px; letter-spacing:-.04em; }
.unread-summary { display:block; margin-top:2px; color:var(--muted); font-size:12px; }
.text-button { min-height:44px; border:0; background:transparent; color:var(--accent-violet-ink); font-weight:700; cursor:pointer; }
.notification-state { min-height:190px; display:grid; place-items:center; padding:28px 12px; border:1px dashed var(--line); border-radius:18px; color:var(--muted); text-align:center; }
.notification-state.error { color:#92564f; }
.notification-list { display:grid; gap:9px; }
.notification-item { position:relative; display:grid; grid-template-columns:42px minmax(0,1fr) 8px; gap:12px; align-items:center; min-height:76px; padding:12px 14px; border:1px solid var(--line); border-radius:18px; background:rgba(255,255,255,.72); cursor:pointer; transition:transform var(--motion-fast) var(--ease-out),background var(--motion-fast) ease; }
.notification-item:hover { transform:translateY(-1px); background:#fff; }
.notification-item.unread { border-color:rgba(200,183,239,.72); background:linear-gradient(110deg,var(--accent-lavender-soft),#fff 70%); }
.notification-icon { display:grid; place-items:center; width:42px; height:42px; border-radius:14px; background:var(--accent-blue-soft); color:var(--ink); font-weight:850; }
.notification-actor{width:42px;height:42px;padding:0;overflow:hidden;border:0;border-radius:14px;background:var(--accent-blue-soft);cursor:pointer}.notification-actor img{width:100%;height:100%;object-fit:cover}.notification-actor span{display:grid;place-items:center;width:100%;height:100%;font-weight:850}
.notification-icon.is-like { background:var(--accent-pink-soft); }
.notification-icon.is-points { background:var(--accent-yellow-soft); }
.notification-icon.is-sos { background:var(--accent-lavender-soft); }
.notification-copy { min-width:0; display:grid; gap:4px; }
.notification-badge { color:var(--accent-violet-ink); font-size:10px; font-weight:850; letter-spacing:.08em; }
.notification-message { color:var(--ink); line-height:1.5; overflow-wrap:anywhere; }
.notification-user-link { min-height:44px; padding:0 2px; border:0; background:none; color:var(--accent-violet-ink); font:inherit; font-weight:800; cursor:pointer; }
.notification-time { color:var(--muted); font-size:11px; }
.unread-dot { width:8px; height:8px; border-radius:50%; background:var(--accent-violet-ink); }
.notification-item:focus-visible { outline:3px solid var(--focus-ring, #6f63a5); outline-offset:3px; }
@media(max-width:480px) { .notification-modal { padding:26px 18px 18px; border-radius:22px; }.notification-heading { align-items:flex-start; }.notification-item { grid-template-columns:38px minmax(0,1fr) 8px; padding:11px; }.notification-icon { width:38px; height:38px; } }
</style>
