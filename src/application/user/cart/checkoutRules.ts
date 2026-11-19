import {effectiveFulfillmentMode} from '../catalog/menuRules';
import type { CartItem, Product, ProductOffer, Slot, Chef } from '../../../core/api/models';
import { lineTotal, money, businessDate } from './cartRules';
export function validateFreshItem(item: CartItem, product: Product, offer: ProductOffer | null, chef?:Chef) {
  const variant = product.variants?.find(v => v.id === item.variantId);
  if (!product.isAvailable || product.chefId !== item.chefId || product.categoryId !== item.categoryId ||
      (product.hasVariants && !item.variantId) || (item.variantId && (!variant?.isActive || !variant.isAvailable)) ||
      (variant?.stockQuantity ?? product.stockQuantity) < item.quantity)
    throw new Error(item.name + ' is no longer available in that quantity. Update your cart.');
  const activeOffer = !item.variantId && offer && offer.isActive !== false && (!offer.validUntil || Date.parse(offer.validUntil) > Date.now()) ? offer : null;
  if (activeOffer?.maxOrderQuantity != null && item.quantity > activeOffer.maxOrderQuantity)
    throw new Error(item.name + ' now has a lower quantity limit. Update your cart.');
  const fresh = { ...item, price: Number(variant?.price ?? product.price), offerPercentage: product.offerPercentage, offer: activeOffer };
  if (money(fresh.price) !== money(item.price) || lineTotal(fresh) !== lineTotal(item))
    throw new Error(item.name + ' has a new price or offer. Remove it from your basket and add it again.');
  if ((product.effectiveMode||chef) && effectiveFulfillmentMode(product,chef) !== item.effectiveMode)
    throw new Error(item.name + ' has a new delivery mode. Add it to your basket again.');
}
export function slotTiming(slot: Slot, date: string, now = Date.now()) {
  const starts = Date.parse(date + 'T' + slot.startTime + ':00+05:30');
  const cutoff = starts - Math.max(0, slot.cutoffHoursBefore || 0) * 3600000;
  return { ended: !Number.isFinite(starts) || now >= starts, late: now >= cutoff, cutoff };
}

export function rotiOrderingBlocked(settings:import('../../../core/api/models').RotiSettings|undefined,requiresSlot:boolean){return requiresSlot&&!!settings?.isActive&&!!settings.isInBlockedPeriod;}
export function assertRotiOrderingAllowed(settings:import('../../../core/api/models').RotiSettings){if(!settings||typeof settings.isActive!=='boolean'||typeof settings.isInBlockedPeriod!=='boolean'||typeof settings.isPastLastOrderTime!=='boolean')throw new Error('Current ordering rules could not be loaded. Refresh before placing your order.');if(rotiOrderingBlocked(settings,true))throw new Error(settings.blockMessage||'Ordering is unavailable during the current kitchen window.');}

// The server blocks the roti morning window. A past last-order flag is slot/cutoff metadata, not a blanket ban on other categories or future delivery dates.

// Offer metadata is optional on deployed servers. Ordinary dishes must not depend
// on an absent promotion route; an unavailable previous offer is re-priced below.
export async function currentProductOffer(request:<T>(path:string)=>Promise<T>,product:Product,previous?:ProductOffer|null):Promise<ProductOffer|null>{
 if(Object.prototype.hasOwnProperty.call(product,'offer'))return product.offer??null;
 if(!previous)return null;
 try{return (await request<{offer:ProductOffer|null}>('/api/products/'+encodeURIComponent(product.id)+'/offer')).offer??null;}
 catch(error){if((error as {status?:number})?.status===404)return null;throw error;}
}

export function slotHasCapacity(slot:Slot){
 if(slot.capacity==null)return true;
 return Number.isFinite(Number(slot.capacity))&&Number(slot.capacity)>Number(slot.currentOrders??0);
}
export function formatScheduleTime(value:string){
 const match=/^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(value||'');
 if(!match||Number(match[1])>23||Number(match[2])>59)return value;
 const h=Number(match[1]);return `${h%12||12}:${match[2]} ${h>=12?'PM':'AM'}`;
}
// A category offering a slot picker does not make scheduling mandatory.
// Empty regular selection omits ALL schedule fields, including stale draft dates.
export function selectedDeliverySchedule(preorder:boolean,slotId:string,date:string,slots:Slot[],meal:string,preorderTime?:string){
 if(!preorder&&!slotId)return {};
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error('Choose a delivery date.');
 if(preorder){
  if(!['preorder-lunch','preorder-dinner'].includes(meal))throw new Error('Choose a preorder meal time.');
  if(!preorderTime||!/^([01]\d|2[0-3]):[0-5]\d$/.test(preorderTime))throw new Error('The kitchen delivery time is unavailable.');
  return {deliverySlotId:meal,deliveryDate:date,deliveryTime:preorderTime};
 }
 const slot=slots.find(s=>s.id===slotId&&s.isActive!==false&&slotHasCapacity(s));
 if(!slot)throw new Error('Your selected delivery time is unavailable. Choose another time or Deliver now.');
 return {deliverySlotId:slot.id,deliveryDate:date,deliveryTime:slot.startTime};
}

export function scheduleSlotLabel(slot:Slot){
 const label=(slot.label||slot.name||'').trim();
 return /[^\d\s:.\-–—/]/.test(label.replace(/am|pm|\bto\b/gi,''))?label:'';
}

export type PreorderMeal={id:'preorder-lunch'|'preorder-dinner';title:string;startTime:string;endTime:string;deliveryDate:string;expired:boolean;late:boolean;valid:boolean};
// Same enabled-meal defaults, global time windows and Today/Tomorrow policy as web.
export function availablePreorderMeals(chef:Chef|undefined,settings:Record<string,string>|undefined,date:string,now=Date.now()):PreorderMeal[]{
 if(!chef||!settings||![businessDate(0,now),businessDate(1,now)].includes(date))return [];
 const configured=chef.preorderSettings||{},validTime=/^([01]\d|2[0-3]):[0-5]\d$/;
 return (['lunch','dinner'] as const).flatMap(meal=>{
  if((meal==='lunch'?configured.lunchEnabled:configured.dinnerEnabled)===false)return [];
  const startTime=settings['preorder_'+meal+'_start_time']||(meal==='lunch'?'11:00':'18:00'),endTime=settings['preorder_'+meal+'_end_time']||(meal==='lunch'?'16:00':'22:00');
  const start=Date.parse(date+'T'+startTime+':00+05:30'),end=Date.parse(date+'T'+endTime+':00+05:30'),valid=validTime.test(startTime)&&validTime.test(endTime)&&Number.isFinite(start)&&Number.isFinite(end);
  const notice=meal==='lunch'?(configured.lunchMinNoticeHours??24):(configured.dinnerMinNoticeHours??12);
  return [{id:('preorder-'+meal) as PreorderMeal['id'],title:meal==='lunch'?'Lunch':'Dinner',startTime,endTime,deliveryDate:date,valid,expired:!valid||end<=now,late:valid&&start-now<Math.max(0,notice)*3600000}];
 });
}
export function selectedPreorderMeal(chef:Chef,settings:Record<string,string>,date:string,meal:string,now=Date.now()){
 if(![businessDate(0,now),businessDate(1,now)].includes(date))throw new Error('Choose Today or Tomorrow for this preorder.');
 const option=availablePreorderMeals(chef,settings,date,now).find(option=>option.id===meal);
 if(!option)throw new Error('This chef is not offering the selected meal. Choose an available time.');
 if(!option.valid)throw new Error('The kitchen delivery time is not configured correctly.');
 if(option.expired)throw new Error('This preorder time has ended. Choose another day or time.');
 return option;
}
