import type { CartItem, CartGroup, PaymentSettings, Address, User } from '../../../core/api/models';
export const money = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.round(n * 100) / 100) : 0;
};
export const groupKey = (item: Pick<CartItem, 'chefId' | 'categoryId'>) => item.chefId + ':' + item.categoryId;
export function groupCart(items: CartItem[]): CartGroup[] {
  const groups = new Map<string, CartGroup>();
  for (const item of items) {
    const key = groupKey(item);
    if (!groups.has(key)) groups.set(key, { key, chefId: item.chefId, chefName: item.chefName, categoryId: item.categoryId, categoryName: item.categoryName, items: [] });
    groups.get(key)!.items.push(item);
  }
  return [...groups.values()];
}
export function lineTotal(item: CartItem): number {
  const normal = money(item.price * (1 - (item.offerPercentage || 0) / 100));
  const offer = item.offer;
  const active = offer && offer.isActive !== false && (!offer.validUntil || new Date(offer.validUntil).getTime() > Date.now());
  if (!active) return money(normal * item.quantity);
  const count = Math.min(item.quantity, Math.max(0, offer.maxDiscountedQuantity));
  return money(count * Math.min(normal, offer.promotionalPrice) + (item.quantity - count) * normal);
}
export function assertCanAdd(items: CartItem[], incoming: CartItem) {
  if (!Number.isInteger(incoming.quantity) || incoming.quantity <= 0) throw new Error('Choose a positive whole quantity.');
  if (!incoming.chefId || !incoming.categoryId) throw new Error('This item is not available to order.');
  const group = items.filter(item => groupKey(item) === groupKey(incoming));
  if (incoming.effectiveMode !== 'both' && group.some(item => item.effectiveMode !== 'both' && item.effectiveMode !== incoming.effectiveMode)) {
    throw new Error('Instant and preorder-only items need separate checkouts. Remove the other items first.');
  }
  const quantity = (items.find(item => item.key === incoming.key)?.quantity || 0) + incoming.quantity;
  const max = Math.min(incoming.stockQuantity, incoming.offer?.maxOrderQuantity ?? Infinity);
  if (quantity > max) throw new Error('The requested quantity is not available.');
}
export function platformFee(subtotal: number, config: PaymentSettings): number {
  if (!config.platformFeeEnabled || subtotal >= Number(config.platformFeeWaiverThreshold || 200)) return 0;
  return money(subtotal < 100 ? config.platformFeeBelow100 : subtotal < 200 ? config.platformFeeBelow200 : config.platformFeeAbove200);
}
export function readAddress(user: User): Address | null {
  if (user.latitude == null || user.longitude == null) return null;
  const latitude = Number(user.latitude), longitude = Number(user.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  let saved: Record<string, unknown> = {};
  try { saved = JSON.parse(user.address || '{}'); } catch { saved = { area: user.address || '' }; }
  if (!saved || typeof saved !== 'object') saved = {};
  const text = (value: unknown) => typeof value === 'string' ? value : '';
  return {
    latitude, longitude, building: text(saved.building || saved.houseNumber),
    street: text(saved.street), area: text(saved.area || saved.areaName || saved.address),
    city: text(saved.city) || 'Mumbai', pincode: text(saved.pincode), landmark: text(saved.landmark),
    source: text(saved.source) || 'user_profile',
  };
}
export const addressText = (a: Address) => [a.building, a.street, a.area, a.city, a.pincode, a.landmark].filter(Boolean).join(', ');
export function validateAddress(a: Address): string | null {
  if (!a.building.trim() || !a.street.trim() || !a.area.trim() || !a.city.trim() || !/^\d{6}$/.test(a.pincode)) return 'Complete the building, street, area, city and 6-digit pincode.';
  if (!Number.isFinite(a.latitude) || !Number.isFinite(a.longitude) || Math.abs(a.latitude) > 90 || Math.abs(a.longitude) > 180) return 'Confirm a valid delivery location.';
  return null;
}
export function businessDate(offset = 0): string {
  const d = new Date(Date.now() + offset * 86400000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}


export function displaySavedAddress(value:string){try{const address=JSON.parse(value);if(address&&typeof address==='object')return addressText({...address,building:address.building||address.houseNumber,area:address.area||address.areaName});}catch{}return value;}
