import {readPrivateJson,writePrivateJson,removePrivateJson} from './privateJson';
import type {PendingPayment} from '../../application/user/payments/paymentRules';
const key=(owner:string)=>(typeof __DEV__!=='undefined'&&__DEV__&&process.env.EXPO_PUBLIC_UI_REVIEW==='1'?'rotihai.review.pending-payment.':'rotihai.pending-payment.')+owner;
export const pendingPayment={read:(owner:string)=>readPrivateJson<PendingPayment>(key(owner)),save:(owner:string,payment:PendingPayment)=>writePrivateJson(key(owner),payment),clear:(owner:string)=>removePrivateJson(key(owner))};

export type SubscriptionCreationAttempt={kind:'plan'|'custom'|'renewal';createdAt:string;planId?:string;originalId?:string;rotiPerDay?:number;duration?:string;deliverySlotId?:string};
const creationKey=(owner:string)=>'rotihai.subscription-creation.'+owner;
export const subscriptionCreationAttempt={read:(owner:string)=>readPrivateJson<SubscriptionCreationAttempt>(creationKey(owner)),save:(owner:string,value:SubscriptionCreationAttempt)=>writePrivateJson(creationKey(owner),value),clear:(owner:string)=>removePrivateJson(creationKey(owner))};
