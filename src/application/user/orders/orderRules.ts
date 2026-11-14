import type {Order,User} from '../../../core/api/models';
export const orderSteps=[['pending','Order received'],['confirmed','Order confirmed'],['accepted_by_chef','Kitchen accepted'],['preparing','Freshly preparing'],['prepared','Ready for pickup'],['accepted_by_delivery','Delivery partner accepted'],['out_for_delivery','On the way'],['delivered','Delivered']];
export const endedOrder=(status:string)=>['delivered','completed','cancelled','rejected','expired'].includes(status);
export const orderStage=(status:string)=>orderSteps.findIndex(([key])=>key===(status==='completed'?'delivered':status));
const phone=(value:string)=>value.replace(/\D/g,'').replace(/^91(?=\d{10}$)/,'');
export function orderForCustomer(order:Order,user:User){if(!user.id||user.id==='guest')return false;if(order.userId)return order.userId===user.id;const verified=phone(user.phone||'');return verified.length===10&&verified===phone(order.phone||'');}

export function activeOrderVisible(order:Pick<Order,'status'|'paymentStatus'>&{deliveryDate?:string;deliverySlotId?:string;expiresAt?:string},now=new Date()){
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 if(!orderSteps.slice(0,-1).some(([status])=>status===order.status))return false;
 if(order.deliveryDate&&order.deliveryDate>today)return false;
 if(order.deliverySlotId?.startsWith('preorder-')&&order.deliveryDate!==today)return false;
 return !(order.status==='pending'&&order.paymentStatus==='pending'&&order.expiresAt&&new Date(order.expiresAt)<now);
}

export function activeOrderPresentation(status:string,paymentStatus:string){
 const states:Record<string,{label:string;color:string;background:string;icon:'clock'|'orders'|'home'|'pin'}>={
 pending:{label:'Order placed — waiting for confirmation',color:'#a16207',background:'#fefce8',icon:'clock'},
 confirmed:{label:'Order confirmed',color:'#2563eb',background:'#eff6ff',icon:'orders'},
 accepted_by_chef:{label:'Chef is preparing your food',color:'#9333ea',background:'#faf5ff',icon:'home'},
 preparing:{label:'Chef is preparing your food',color:'#9333ea',background:'#faf5ff',icon:'home'},
 prepared:{label:'Your food is ready! Waiting for pickup',color:'#0891b2',background:'#ecfeff',icon:'orders'},
 accepted_by_delivery:{label:'Delivery assigned — heading your way',color:'#0d9488',background:'#f0fdfa',icon:'pin'},
 out_for_delivery:{label:'Out for delivery — almost there!',color:'#ea580c',background:'#fff7ed',icon:'pin'}
 };
 const result=states[status]||{label:'Order in progress',color:'#475569',background:'#f8fafc',icon:'orders' as const};
 const pending=status==='pending'&&paymentStatus==='pending';
 return {...result,label:pending?'Waiting for payment…':status==='pending'&&paymentStatus==='paid'?'Your order has been received. Waiting for admin confirmation…':result.label,paymentPending:pending};
}
