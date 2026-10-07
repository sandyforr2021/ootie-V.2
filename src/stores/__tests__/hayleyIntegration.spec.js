import { describe, it, expect, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useAppStore } from '@/stores/app';
import { useOotdStore } from '@/stores/ootd';

describe('Hayley Features Integration Tests', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it('handles follow and unfollow logic and syncs with ootd posts', () => {
    const appStore = useAppStore();
    const ootdStore = useOotdStore();

    expect(appStore.isFollowingUser('@sofia')).toBe(false);

    // Follow @sofia
    appStore.setFollowingUser('@sofia', true);
    expect(appStore.isFollowingUser('@sofia')).toBe(true);
    expect(appStore.followingUsers).toContain('@sofia');

    // Unfollow @sofia
    appStore.setFollowingUser('@sofia', false);
    expect(appStore.isFollowingUser('@sofia')).toBe(false);
    expect(appStore.followingUsers).not.toContain('@sofia');
  });

  it('persists sidebar collapsed state', () => {
    const appStore = useAppStore();
    expect(appStore.isSidebarCollapsed).toBe(false);

    appStore.toggleSidebar();
    expect(appStore.isSidebarCollapsed).toBe(true);
    expect(localStorage.getItem('ootie-sidebar-collapsed')).toBe('true');

    appStore.toggleSidebar();
    expect(appStore.isSidebarCollapsed).toBe(false);
    expect(localStorage.getItem('ootie-sidebar-collapsed')).toBe('false');
  });

  it('adds structured notifications with deep link metadata', () => {
    const appStore = useAppStore();
    appStore.addNotification('@minji 回覆了你的留言。', 'explore', {
      type: 'comment-reply',
      postId: 'post-01',
      commentId: 'comment-03',
      userId: '@minji'
    });

    const firstNotif = appStore.notifications[0];
    expect(firstNotif.type).toBe('comment-reply');
    expect(firstNotif.postId).toBe('post-01');
    expect(firstNotif.commentId).toBe('comment-03');
    expect(firstNotif.userId).toBe('@minji');
  });
});
