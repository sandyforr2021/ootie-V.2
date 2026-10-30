// Display catalogue only. Paid activation requires a verified payment webhook.
// Fixed USD preview prices; checkout remains disabled. TWD is an internal cost comparison.
// Bank of Taiwan spot selling rate, 2026-10-29 22:41 (Asia/Taipei).
export const USD_TWD_REFERENCE_RATE = 32.565;
export const USD_RATE_SOURCE = "https://rate.bot.com.tw/xrt?Lang=en-US";
export const formatPlanUsd = usd => `US$ ${usd.toFixed(0)}`;
export const MEMBERSHIP_PLANS = Object.freeze([
  Object.freeze({id:'plus',name:'OOTIE Plus',priceUsd:6,priceTwd:195.39,points:30}),
  Object.freeze({id:'pro',name:'OOTIE Pro',priceUsd:12,priceTwd:390.78,points:70}),
]);
export const POINT_TOPUP = Object.freeze({id:'topup-12',priceUsd:3,priceTwd:97.70,points:12});
export const POINTS_PER_GARMENT = 2;
export const PAID_CHECKOUT_ENABLED = false;
