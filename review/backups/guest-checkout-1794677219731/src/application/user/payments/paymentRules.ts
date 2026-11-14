import type {PaymentSettings} from '../../../core/api/models';
export type PendingPayment={id:string;kind:'order'|'subscription';amount:number;phase:'ready'|'launching'|'returned'|'launch_failed'|'reported'|'backend_recorded'|'closed';createdAt:string;reference?:string;referenceSubmitted?:boolean;cartKey?:string;cartSignature?:string;deliveryAddress?:string};
export function paymentStatusLabel(status:string,reported=false){if(status==='pending_verification'||reported)return 'Payment submitted — awaiting confirmation';if(['paid','confirmed','verified','completed'].includes(status))return 'Payment recorded by RotiHai';if(status==='failed')return 'Payment failed';if(status==='cancelled')return 'Payment cancelled';return 'Payment pending';}
export function validatePayableAmount(value:unknown){const amount=Number(value);if(!Number.isFinite(amount)||amount<=0)throw new Error('A current payable amount is required. Refresh this order before paying.');return Math.round(amount*100)/100;}
export function buildWebUpiUri(settings:PaymentSettings){
 const id=settings.upiId?.trim();if(!id||!/^[^\s@]+@[^\s@]+$/.test(id))throw new Error('Merchant UPI details are unavailable. Please contact RotiHai.');
 // Web upi-payment.ts deliberately omits amount, payee name and reference for
 // the configured personal-account flow. Do not invent another payment protocol.
 return 'upi://pay?pa='+encodeURIComponent(id)+'&cu=INR';
}
export function paymentAppUri(upi:string,platform:string,app:'gpay'|'upi'){
 if(app==='upi')return upi;
 // Retain Android tez:// parity; use Google's documented iOS gpay://upi/pay path.
 return platform==='ios'?upi.replace('upi://','gpay://upi/'):upi.replace('upi://','tez://');
}
export const backendPaymentRecorded=(status?:string)=>['paid','confirmed','verified','completed'].includes(status||'');
export function cartSignature(items:Array<{id:string;variantId?:string;quantity:number}>){return items.map(i=>i.id+':'+(i.variantId||'')+':'+i.quantity).sort().join('|');}
export function canClearPaidBasket(pending:PendingPayment,current:Array<{id:string;variantId?:string;quantity:number}>){return !!pending.cartSignature&&pending.cartSignature===cartSignature(current);}

// The subscription endpoint saves a transaction ID for admin review; the legacy order endpoint marks paid and must not be used as settlement proof.
export const manualReferenceEndpoint=(kind:'order'|'subscription',id:string)=>kind==='subscription'?'/api/subscriptions/'+encodeURIComponent(id)+'/payment-confirmed':null;
