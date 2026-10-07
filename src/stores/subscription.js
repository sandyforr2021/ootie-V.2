import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { demoPaymentProvider, DEMO_PLANS, DEMO_CREDIT_PACKS, AI_POINT_COSTS } from '@/services/subscriptionDemo';
import { CHECKOUT_KIND, PAYMENT_STATUS } from '@/contracts/commerce';
import { useAuthStore } from './auth';
import { useAppStore } from './app';

export const useSubscriptionStore = defineStore('subscription', () => {
  const subscription = ref(null);
  const pointsBalance = ref(0);
  const transactions = ref([]);
  const loading = ref(false);
  const error = ref('');
  const checkout = ref(null);
  const currentPlan = computed(() => subscription.value?.plan || 'FREE');

  const refresh = async () => {
    const auth = useAuthStore();
    if (!auth.isMember || !auth.profileId) return false;
    loading.value = true;
    error.value = '';
    try {
      const status = await demoPaymentProvider.getSubscriptionStatus(auth.profileId);
      subscription.value = status.subscription;
      pointsBalance.value = status.balance;
      transactions.value = status.transactions;
      return true;
    } catch (cause) {
      error.value = cause?.message || '暫時無法讀取 OOTIE 點數。';
      return false;
    } finally {
      loading.value = false;
    }
  };

  const subscribe = async (plan, operationId) => {
    loading.value = true;
    try {
      const result = await demoPaymentProvider.subscribe(plan, operationId);
      useAppStore().showToast(`方案已更新為 ${plan}`, { type: 'success' });
      await refresh();
      return result;
    } finally { loading.value = false; }
  };

  const purchaseCredits = async (pack, operationId) => {
    loading.value = true;
    try {
      const result = await demoPaymentProvider.purchaseCredits(pack, operationId);
      useAppStore().showToast('點數已加入', { type: 'success' });
      await refresh();
      return result;
    } finally { loading.value = false; }
  };

  const cancel = async () => {
    loading.value = true;
    try {
      const result = await demoPaymentProvider.cancelSubscription();
      useAppStore().showToast('方案已取消', { type: 'info' });
      await refresh();
      return result;
    } finally { loading.value = false; }
  };

  const openCheckout = (kind, itemId) => {
    checkout.value = demoPaymentProvider.createCheckout(kind, itemId);
    error.value = '';
    return checkout.value;
  };

  const confirmCheckout = async () => {
    if (!checkout.value || checkout.value.status !== PAYMENT_STATUS.DRAFT) return false;
    loading.value = true;
    error.value = '';
    const draft = checkout.value;
    checkout.value = { ...draft, status: PAYMENT_STATUS.PENDING };
    try {
      const response = await demoPaymentProvider.confirmCheckout(draft);
      checkout.value = response.order;
      useAppStore().showToast(draft.kind === CHECKOUT_KIND.SUBSCRIPTION ? '方案已更新' : '點數已加入', { type: 'success' });
      await refresh();
      return true;
    } catch (cause) {
      checkout.value = cause?.order || { ...draft, status: PAYMENT_STATUS.FAILED };
      error.value = cause?.message || '目前無法完成此操作。';
      return false;
    } finally { loading.value = false; }
  };

  const closeCheckout = () => {
    if (checkout.value?.status === PAYMENT_STATUS.PENDING) return false;
    if (checkout.value?.status === PAYMENT_STATUS.DRAFT) checkout.value = demoPaymentProvider.cancelCheckout(checkout.value);
    checkout.value = null;
    return true;
  };

  return { subscription, pointsBalance, transactions, loading, error, checkout, currentPlan, plans: DEMO_PLANS, creditPacks: DEMO_CREDIT_PACKS, aiPointCosts: AI_POINT_COSTS, refresh, subscribe, purchaseCredits, cancel, openCheckout, confirmCheckout, closeCheckout };
});

