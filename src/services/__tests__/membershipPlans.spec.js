import {describe,it,expect} from 'vitest';
import {MEMBERSHIP_PLANS,POINT_TOPUP,PAID_CHECKOUT_ENABLED,formatPlanUsd} from '../membershipPlans';
import {BASE_COSTS,projectMembership} from '../../../scripts/lib/membership-economics.mjs';
describe('membership pricing guardrails',()=>{
 it('uses the approved fixed USD prices consistently',()=>{
  expect(MEMBERSHIP_PLANS.map(plan=>formatPlanUsd(plan.priceUsd))).toEqual(['US$ 6','US$ 12']);
  expect(formatPlanUsd(POINT_TOPUP.priceUsd)).toBe('US$ 3');
 });
 it('covers full point redemption with at least 40% contribution under the stated assumptions',()=>{
  for(const offer of [...MEMBERSHIP_PLANS,POINT_TOPUP]){
   expect(offer.points%2).toBe(0);
   expect(projectMembership(offer).contributionRate).toBeGreaterThan(.4);
  }
 });
 it('keeps subscriptions better value than top-ups and stays positive under higher API and FX costs',()=>{
  const [plus,pro]=MEMBERSHIP_PLANS;
  expect(pro.priceTwd/pro.points).toBeLessThan(plus.priceTwd/plus.points);
  expect(plus.priceTwd/plus.points).toBeLessThan(POINT_TOPUP.priceTwd/POINT_TOPUP.points);
  for(const offer of [...MEMBERSHIP_PLANS,POINT_TOPUP])expect(projectMembership(offer,{...BASE_COSTS,usdTwd:38,apiUsdPerGarment:.11*1.3,retryReserve:.35}).contribution).toBeGreaterThan(0);
  expect(PAID_CHECKOUT_ENABLED).toBe(false);
 });
});
