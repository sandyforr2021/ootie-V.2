import { describe, expect, it } from 'vitest';
import { CHECKOUT_KIND, PAYMENT_STATUS, createCheckoutOrder, normalizePointTransaction, withPaymentStatus } from '../commerce';

const plans = [{ id: 'PLUS', name: 'OOTIE Plus', monthlyPrice: 190, monthlyPoints: 50 }];
const creditPacks = [{ id: 'STYLE', name: '造型補給', price: 220, points: 60 }];

describe('commerce contracts', () => {
  it('creates a subscription order summary without payment credentials', () => {
    const order = createCheckoutOrder({ kind: CHECKOUT_KIND.SUBSCRIPTION, itemId: 'PLUS', plans, creditPacks, operationId: 'operation-1' });
    expect(order).toMatchObject({ id: 'operation-1', title: 'OOTIE Plus', amount: 190, points: 50, status: PAYMENT_STATUS.DRAFT, billingPeriod: 'MONTHLY' });
    expect(order).not.toHaveProperty('card');
    expect(order).not.toHaveProperty('paymentToken');
  });

  it('models pending, success and cancellation explicitly', () => {
    const order = createCheckoutOrder({ kind: CHECKOUT_KIND.CREDIT_PACK, itemId: 'STYLE', plans, creditPacks, operationId: 'operation-2' });
    expect(withPaymentStatus(order, PAYMENT_STATUS.PENDING).status).toBe('PENDING');
    expect(withPaymentStatus(order, PAYMENT_STATUS.SUCCEEDED).status).toBe('SUCCEEDED');
    expect(withPaymentStatus(order, PAYMENT_STATUS.CANCELLED).status).toBe('CANCELLED');
  });

  it('normalizes point ledger entries without creating a second wallet', () => {
    expect(normalizePointTransaction({ id: 'tx', type: 'CREDIT_PURCHASE', amount: '60', created_at: '2026-10-01T00:00:00Z' })).toMatchObject({ id: 'tx', amount: 60, createdAt: '2026-10-01T00:00:00Z' });
  });
});
