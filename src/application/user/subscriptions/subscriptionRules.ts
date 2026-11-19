import type {Category,CustomRequest,Plan,Subscription} from '../../../core/api/models';
import type {SubscriptionCreationAttempt} from '../../../core/storage/pendingPayment';
export function planRequiresSlot(plan:Plan|undefined,categories:Category[]=[]){const category=categories.find(c=>c.id===plan?.categoryId);return !!category&&(!!category.requiresDeliverySlot||category.name.toLowerCase().includes('roti'));}
export function activeCustomRequest(requests:CustomRequest[]=[]){return requests.find(r=>['pending_chef_assignment','approved','awaiting_payment','paid'].includes(r.status));}
export function customStatusLabel(status:string){return ({pending_chef_assignment:'Awaiting kitchen assignment',approved:'Approved',awaiting_payment:'Awaiting payment',paid:'Payment submitted · awaiting activation',converted:'Subscription active',rejected:'Request declined'} as Record<string,string>)[status]||status.replace(/_/g,' ');}
export function customPlanEstimate(count:number,duration:string,price:number){if(!Number.isInteger(count)||count<1||!['weekly','monthly'].includes(duration)||!Number.isInteger(price)||price<=0)throw new Error('Choose a valid quantity and load the current price.');return count*(duration==='weekly'?7:30)*price;}
const recent=(createdAt:string|undefined,attempt:SubscriptionCreationAttempt)=>!!createdAt&&Date.parse(createdAt)>=Date.parse(attempt.createdAt)-30000;
export function matchingCreatedPlans(attempt:SubscriptionCreationAttempt,records:Subscription[]){return records.filter(s=>s.id!==attempt.originalId&&s.planId===attempt.planId&&recent(s.createdAt,attempt));}
export function matchingCreatedRequests(attempt:SubscriptionCreationAttempt,records:CustomRequest[]){return records.filter(r=>r.rotiPerDay===attempt.rotiPerDay&&r.duration===attempt.duration&&r.deliverySlotId===attempt.deliverySlotId&&recent(r.createdAt,attempt));}

// Only wrap the creation POST: errors in later storage/navigation must retain recovery.
// These HTTP responses reject creation; timeouts, 5xx and malformed 2xx remain uncertain.
export async function submitSubscriptionRequest<T>(send:()=>Promise<T>,clearRejected:()=>Promise<void>):Promise<T>{
 try{return await send();}catch(error){
  const status=(error as {status?:number})?.status;
  if(status!==undefined&&[400,401,403,404,409,422,429].includes(status))await clearRejected();
  throw error;
 }
}
export function subscriptionPayable(subscription:Subscription){
 const raw=subscription.finalAmount??subscription.totalAmount??subscription.price;
 const amount=Number(raw);
 if(raw==null||raw===''||!Number.isFinite(amount)||amount<=0)throw new Error('The subscription was received, but its payable amount is unavailable. Review your subscription before paying.');
 return amount;
}
