export type QuoteBill={subtotalPaise:number;deliveryFeePaise:number;platformFeePaise:number;discountPaise:number;walletCreditPaise:number;bonusCreditPaise:number;payablePaise:number};
export function validateBillingQuote(q:any){
 const keys=['subtotalPaise','deliveryFeePaise','platformFeePaise','discountPaise','walletCreditPaise','bonusCreditPaise','payablePaise'] as const;
 if(!q?.quoteId||!q.bill||!q.distance||!q.delivery||!Number.isFinite(Date.parse(q.expiresAt)))throw new Error('The service returned an incomplete bill. Please retry.');
 for(const key of keys)if(!Number.isSafeInteger(q.bill[key])||q.bill[key]<0)throw new Error('The service returned an invalid bill.');
 const b=q.bill as QuoteBill;
 if(Math.max(0,b.subtotalPaise+b.deliveryFeePaise+b.platformFeePaise-b.discountPaise-b.walletCreditPaise-b.bonusCreditPaise)!==b.payablePaise)throw new Error('Your bill does not reconcile. Please retry.');
 if(q.distance.method!=='haversine_multiplier'||!Number.isFinite(q.distance.billingDistanceKm)||q.distance.billingDistanceKm<0)throw new Error('Delivery pricing distance is unavailable.');
 return q;
}
function comparable(value: unknown): string | undefined {
 return JSON.stringify(value, (_key, entry) => {
  if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
   return Object.fromEntries(Object.keys(entry).sort().map(key => [key, entry[key]]));
  }
  return entry;
 });
}
export function assertReviewedBill(reviewed:any,current:any){
 if(!reviewed||comparable(reviewed.bill)!==comparable(current.bill)||comparable(reviewed.distance)!==comparable(current.distance))throw new Error('Your bill changed. Review the updated charges and continue.');
}
