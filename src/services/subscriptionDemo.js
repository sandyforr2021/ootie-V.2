import { supabase } from './supabase';
import { CHECKOUT_KIND, PAYMENT_STATUS, createCheckoutOrder, withPaymentStatus } from '@/contracts/commerce';

export const DEMO_PLANS = Object.freeze([
  { id: 'FREE', name: 'OOTIE Free', monthlyPrice: 0, monthlyPoints: 10, description: '衣櫥、社群與每月少量 AI 點數。' },
  { id: 'PLUS', name: 'OOTIE Plus', monthlyPrice: 190, monthlyPoints: 50, description: '適合固定使用 AI 穿搭與試穿的方案。' },
  { id: 'PRO', name: 'OOTIE Pro', monthlyPrice: 390, monthlyPoints: 120, description: '為高頻造型探索準備的進階方案。' }
]);

export const DEMO_CREDIT_PACKS = Object.freeze([
  { id: 'STARTER', name: '靈感小包', price: 90, points: 20 },
  { id: 'STYLE', name: '造型補給', price: 220, points: 60 },
  { id: 'STUDIO', name: '創作工作室', price: 490, points: 150 }
]);

export const AI_POINT_COSTS = Object.freeze({ single_try_on: 8, outfit_preview: 12 });

export class PaymentProvider {
  createCheckout() { throw new Error('PaymentProvider.createCheckout must be implemented'); }
  confirmCheckout() { throw new Error('PaymentProvider.confirmCheckout must be implemented'); }
  cancelCheckout() { throw new Error('PaymentProvider.cancelCheckout must be implemented'); }
  subscribe() { throw new Error('PaymentProvider.subscribe must be implemented'); }
  cancelSubscription() { throw new Error('PaymentProvider.cancelSubscription must be implemented'); }
  purchaseCredits() { throw new Error('PaymentProvider.purchaseCredits must be implemented'); }
  getSubscriptionStatus() { throw new Error('PaymentProvider.getSubscriptionStatus must be implemented'); }
}

export class DemoPaymentProvider extends PaymentProvider {
  createCheckout(kind, itemId, operationId) {
    return createCheckoutOrder({ kind, itemId, plans: DEMO_PLANS, creditPacks: DEMO_CREDIT_PACKS, operationId });
  }

  cancelCheckout(order) {
    return withPaymentStatus(order, PAYMENT_STATUS.CANCELLED);
  }

  async confirmCheckout(order) {
    const pending = withPaymentStatus(order, PAYMENT_STATUS.PENDING);
    try {
      const result = order.kind === CHECKOUT_KIND.SUBSCRIPTION
        ? await this.subscribe(order.itemId, order.id)
        : await this.purchaseCredits(order.itemId, order.id);
      return { order: withPaymentStatus(pending, PAYMENT_STATUS.SUCCEEDED), result };
    } catch (error) {
      error.order = withPaymentStatus(pending, PAYMENT_STATUS.FAILED);
      throw error;
    }
  }

  async subscribe(plan, operationId = crypto.randomUUID()) {
    const { data, error } = await supabase.rpc('ootie_demo_subscribe', { p_plan: plan, p_operation_id: operationId });
    if (error) throw error;
    return data;
  }

  async cancelSubscription() {
    const { data, error } = await supabase.rpc('ootie_demo_cancel_subscription');
    if (error) throw error;
    return data;
  }

  async purchaseCredits(pack, operationId = crypto.randomUUID()) {
    const { data, error } = await supabase.rpc('ootie_demo_purchase_credits', { p_pack: pack, p_operation_id: operationId });
    if (error) throw error;
    return data;
  }

  async getSubscriptionStatus(profileId) {
    const [subscriptionResult, balanceResult, transactionsResult] = await Promise.all([
      supabase.from('ootie_demo_subscriptions').select('*').eq('profile_id', profileId).maybeSingle(),
      supabase.rpc('ootie_my_point_balance'),
      supabase.from('ootie_point_transactions').select('*').eq('profile_id', profileId).order('created_at', { ascending: false }).limit(50)
    ]);
    if (subscriptionResult.error) throw subscriptionResult.error;
    if (balanceResult.error) throw balanceResult.error;
    if (transactionsResult.error) throw transactionsResult.error;
    return {
      subscription: subscriptionResult.data || { plan: 'FREE', status: 'ACTIVE', monthly_points: 10 },
      balance: Number(balanceResult.data || 0),
      transactions: transactionsResult.data || []
    };
  }
}

export const demoPaymentProvider = new DemoPaymentProvider();

