// Display catalogue only. Paid activation requires a verified payment webhook.
// TWD remains the settlement currency in every UI language.
export const MEMBERSHIP_PLANS = Object.freeze([
  Object.freeze({id:'plus',name:'OOTIE Plus',priceTwd:190,points:30}),
  Object.freeze({id:'pro',name:'OOTIE Pro',priceTwd:390,points:70}),
]);
export const POINT_TOPUP = Object.freeze({id:'topup-12',priceTwd:99,points:12});
export const POINTS_PER_GARMENT = 2;
export const PAID_CHECKOUT_ENABLED = false;
