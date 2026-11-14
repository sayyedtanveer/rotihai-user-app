import type { CartItem, Product, ProductOffer, Slot } from '../../../core/api/models';
import { lineTotal, money } from './cartRules';
export function validateFreshItem(item: CartItem, product: Product, offer: ProductOffer | null) {
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
  if (product.effectiveMode && product.effectiveMode !== item.effectiveMode)
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
