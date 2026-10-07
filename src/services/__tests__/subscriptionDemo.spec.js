import { beforeEach, describe, expect, it, vi } from 'vitest';

const remote = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('../supabase', () => ({ supabase: { rpc: remote.rpc, from: vi.fn() } }));

import { AI_POINT_COSTS, DEMO_CREDIT_PACKS, DEMO_PLANS, DemoPaymentProvider } from '../subscriptionDemo';
import { CHECKOUT_KIND, PAYMENT_STATUS } from '@/contracts/commerce';

describe('Development Demo payment provider', () => {
  beforeEach(() => remote.rpc.mockReset());

  it('keeps plan and AI point costs explicit and separate from daily quota', () => {
    expect(DEMO_PLANS.map((plan) => plan.id)).toEqual(['FREE', 'PLUS', 'PRO']);
    expect(DEMO_CREDIT_PACKS.map((pack) => pack.points)).toEqual([20, 60, 150]);
    expect(AI_POINT_COSTS).toEqual({ single_try_on: 8, outfit_preview: 12 });
  });

  it('subscribes through the Demo RPC with an idempotency operation ID', async () => {
    remote.rpc.mockResolvedValue({ data: { plan: 'PLUS', granted: true }, error: null });
    const provider = new DemoPaymentProvider();
    await expect(provider.subscribe('PLUS', '11111111-1111-4111-8111-111111111111')).resolves.toMatchObject({ plan: 'PLUS' });
    expect(remote.rpc).toHaveBeenCalledWith('ootie_demo_subscribe', { p_plan: 'PLUS', p_operation_id: '11111111-1111-4111-8111-111111111111' });
  });

  it('purchases a Demo credit pack without contacting a payment gateway', async () => {
    remote.rpc.mockResolvedValue({ data: { pack: 'STYLE', granted: true, balance: 80 }, error: null });
    const provider = new DemoPaymentProvider();
    await expect(provider.purchaseCredits('STYLE', '22222222-2222-4222-8222-222222222222')).resolves.toMatchObject({ balance: 80 });
    expect(remote.rpc).toHaveBeenCalledTimes(1);
    expect(remote.rpc).toHaveBeenCalledWith('ootie_demo_purchase_credits', { p_pack: 'STYLE', p_operation_id: '22222222-2222-4222-8222-222222222222' });
  });

  it('confirms a checkout through the existing idempotent RPC and returns a final state', async () => {
    remote.rpc.mockResolvedValue({ data: { plan: 'PLUS', granted: true }, error: null });
    const provider = new DemoPaymentProvider();
    const order = provider.createCheckout(CHECKOUT_KIND.SUBSCRIPTION, 'PLUS', '33333333-3333-4333-8333-333333333333');
    const response = await provider.confirmCheckout(order);
    expect(response.order.status).toBe(PAYMENT_STATUS.SUCCEEDED);
    expect(remote.rpc).toHaveBeenCalledWith('ootie_demo_subscribe', { p_plan: 'PLUS', p_operation_id: order.id });
  });
});
