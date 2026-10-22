import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import accessibleModal from './directives/accessibleModal';
import { monitoring } from '@/services/monitoring';
import { registerPwa } from '@/services/pwa';
import { updateDocumentMeta } from '@/services/documentMeta';
import { installImageFallback } from '@/services/imageFallback';
import { installI18n, locale, t } from '@/i18n';
import { watch } from 'vue';

import '@/assets/main.css';
import '@/assets/atelier.css';

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(router);
installI18n(app);
app.directive('accessible-modal', accessibleModal);

app.config.errorHandler = (error, instance, info) => {
  monitoring.capture(error, { source: 'vue', component: instance?.$options?.name || 'anonymous', info });
  window.dispatchEvent(new CustomEvent('ootie:service-error', { detail: { message: t('畫面發生未預期錯誤，請重試。') } }));
};

router.afterEach((to) => updateDocumentMeta(to));
watch(locale, () => updateDocumentMeta(router.currentRoute.value));

app.mount('#app');
installImageFallback();
registerPwa();
