export const BIRTHDAY_BONUS_POINTS = Object.freeze({
  enabled: true,
  amount: 25,
  sourcePrefix: 'birthday:',
  annualIdempotency: true
});

export const POINT_TRANSACTION_TYPES = Object.freeze({
  BIRTHDAY_BONUS: 'BIRTHDAY_BONUS',
  AI_USAGE: 'AI_USAGE',
  TRYON_USAGE: 'TRYON_USAGE',
  MANUAL_ADJUSTMENT: 'MANUAL_ADJUSTMENT',
  SUBSCRIPTION_GRANT: 'SUBSCRIPTION_GRANT',
  CREDIT_PURCHASE: 'CREDIT_PURCHASE',
  PROMOTIONAL_REWARD: 'PROMOTIONAL_REWARD'
});

export const createBirthdaySourceKey = (year = new Date().getUTCFullYear()) => `${BIRTHDAY_BONUS_POINTS.sourcePrefix}${year}`;

export const birthdayBonusContract = Object.freeze({
  type: POINT_TRANSACTION_TYPES.BIRTHDAY_BONUS,
  enabled: BIRTHDAY_BONUS_POINTS.enabled,
  amount: BIRTHDAY_BONUS_POINTS.amount,
  annualIdempotency: BIRTHDAY_BONUS_POINTS.annualIdempotency,
  createSourceKey: createBirthdaySourceKey
});
