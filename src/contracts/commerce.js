export const CHECKOUT_KIND = Object.freeze({
  SUBSCRIPTION: 'SUBSCRIPTION',
  CREDIT_PACK: 'CREDIT_PACK'
});

export const PAYMENT_STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  PENDING: 'PENDING',
  SUCCEEDED: 'SUCCEEDED',
  CANCELLED: 'CANCELLED',
  FAILED: 'FAILED'
});

const requireCatalogItem = (items, id, label) => {
  const item = items.find((entry) => entry.id === id);
  if (!item) throw new Error(`找不到指定的${label}。`);
  return item;
};

export const createCheckoutOrder = ({ kind, itemId, plans, creditPacks, operationId = crypto.randomUUID() }) => {
  if (!Object.values(CHECKOUT_KIND).includes(kind)) throw new Error('不支援的結帳類型。');
  const source = kind === CHECKOUT_KIND.SUBSCRIPTION ? plans : creditPacks;
  const item = requireCatalogItem(source, itemId, kind === CHECKOUT_KIND.SUBSCRIPTION ? '方案' : '點數包');
  return Object.freeze({
    id: operationId,
    kind,
    itemId: item.id,
    title: item.name,
    amount: kind === CHECKOUT_KIND.SUBSCRIPTION ? item.monthlyPrice : item.price,
    currency: 'TWD',
    points: kind === CHECKOUT_KIND.SUBSCRIPTION ? item.monthlyPoints : item.points,
    billingPeriod: kind === CHECKOUT_KIND.SUBSCRIPTION ? 'MONTHLY' : null,
    status: PAYMENT_STATUS.DRAFT,
    createdAt: new Date().toISOString()
  });
};

export const withPaymentStatus = (order, status) => {
  if (!order || !Object.values(PAYMENT_STATUS).includes(status)) throw new Error('無效的訂單狀態。');
  return Object.freeze({ ...order, status, updatedAt: new Date().toISOString() });
};

export const normalizePointTransaction = (entry) => ({
  id: entry.id,
  type: entry.type,
  amount: Number(entry.amount || 0),
  createdAt: entry.created_at || entry.createdAt,
  metadata: entry.metadata || {}
});
