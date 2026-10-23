import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '@/views/HomeView.vue';

const ExploreView = () => import('@/views/ExploreView.vue');
const ClosetView = () => import('@/views/ClosetView.vue');
const SosView = () => import('@/views/SosView.vue');
const ProfileView = () => import('@/views/ProfileView.vue');
const OotdDetailView = () => import('@/views/OotdDetailView.vue');
const StatsView = () => import('@/views/StatsView.vue');
const AiView = () => import('@/views/AiView.vue');
const TryonView = () => import('@/views/TryonView.vue');
const HelpHistoryView = () => import('@/views/HelpHistoryView.vue');
const SubscriptionView = () => import('@/views/SubscriptionView.vue');
const SettingsView = () => import('@/views/SettingsView.vue');
const LegalView = () => import('@/views/LegalView.vue');
const NotFoundView = () => import('@/views/NotFoundView.vue');
const ShopView = () => import('@/views/ShopView.vue');

const routes = [
  { path: '/', name: 'Home', component: HomeView },
  { path: '/home', redirect: '/' },
  { path: '/shop', name: 'Shop', component: ShopView },
  { path: '/closet', name: 'Closet', component: ClosetView },
  { path: '/bookmarks', name: 'Bookmarks', redirect: (to) => ({ path: '/shop', query: { ...to.query, tab: to.query.tab === 'outfits' ? 'saved' : 'links' } }) },
  { path: '/stats', name: 'Stats', component: StatsView },
  { path: '/explore', name: 'Explore', component: ExploreView },
  { path: '/sos', name: 'Sos', component: SosView },
  { path: '/ai', name: 'Ai', redirect: '/shop' },
  { path: '/tryon', name: 'Tryon', redirect: '/shop' },
  { path: '/profile', name: 'Profile', component: ProfileView },
  { path: '/profile/help-history', name: 'HelpHistory', component: HelpHistoryView },
  { path: '/membership', name: 'Membership', redirect: '/shop?tab=activity' },
  { path: '/settings', name: 'Settings', component: SettingsView },
  { path: '/legal/:document(privacy|terms|ai)', name: 'Legal', component: LegalView },
  { path: '/ootd/:id', name: 'OotdDetail', component: OotdDetailView },
  { path: '/:pathMatch(.*)*', name: 'NotFound', component: NotFoundView }
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 };
  }
});

router.onError((error) => {
  window.dispatchEvent(new CustomEvent('ootie:route-error', { detail: { message: error?.message || 'ROUTE_LOAD_FAILED' } }));
});

export default router;
