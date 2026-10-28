// Planning assumptions, not measured operating costs or a profit guarantee.
export const BASE_COSTS = Object.freeze({usdTwd:35,apiUsdPerGarment:.11,retryReserve:.20,infraTwdPerGarment:.60,paymentRate:.05,paymentFixedTwd:5,taxReserveRate:.05});
export function projectMembership(offer,costs=BASE_COSTS){
  const garments=offer.points/2;
  const api=garments*costs.apiUsdPerGarment*costs.usdTwd*(1+costs.retryReserve);
  const infrastructure=garments*costs.infraTwdPerGarment;
  const payment=offer.priceTwd*costs.paymentRate+costs.paymentFixedTwd;
  const taxReserve=offer.priceTwd-offer.priceTwd/(1+costs.taxReserveRate);
  const contribution=offer.priceTwd-api-infrastructure-payment-taxReserve;
  return {garments,api,infrastructure,payment,taxReserve,contribution,contributionRate:contribution/offer.priceTwd};
}
