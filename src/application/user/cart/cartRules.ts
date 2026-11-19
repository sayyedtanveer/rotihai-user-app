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
// offerPercentage is the existing API field name, now storing rupees off each item.
export function discountedUnitPrice(price: number, discountAmount = 0): number {
  return money(Math.max(0, price - discountAmount));
}
export function lineTotal(item: CartItem): number {
  const normal = discountedUnitPrice(item.price, item.offerPercentage || 0);
  const offer = item.offer;
  const active = offer && offer.isActive !== false && (!offer.validUntil || new Date(offer.validUntil).getTime() > Date.now());
  if (!active) return money(normal * item.quantity);
  const count = Math.min(item.quantity, Math.max(0, offer.maxDiscountedQuantity));
  return money(count * Math.min(normal, offer.promotionalPrice) + (item.quantity - count) * normal);
}
export function cartFulfillment(items:Pick<CartItem,'effectiveMode'>[]){
 const instant=items.some(item=>item.effectiveMode==='instant'),preorder=items.some(item=>item.effectiveMode==='preorder');
 return {instant,preorder,mixed:instant&&preorder};
}
export function assertCanAdd(items: CartItem[], incoming: CartItem) {
  if (!Number.isInteger(incoming.quantity) || incoming.quantity <= 0) throw new Error('Choose a positive whole quantity.');
  if (!incoming.chefId || !incoming.categoryId) throw new Error('This item is not available to order.');
  const group = items.filter(item => groupKey(item) === groupKey(incoming));
  if (cartFulfillment([...group,incoming]).mixed) {
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
export function savedAddressFields(user:Pick<User,'address'> & Partial<User>):Pick<Address,'building'|'street'|'area'|'city'|'pincode'|'landmark'>|null{
 if(user.addressBuilding!=null||user.addressPincode!=null)return {building:user.addressBuilding||'',street:user.addressStreet||'',area:user.addressArea||'',city:user.addressCity||'Mumbai',pincode:user.addressPincode||'',landmark:user.addressLandmark||''};
 if(!user.address)return null;
 let saved:Record<string,unknown>;
 try{const value=typeof user.address==='string'?JSON.parse(user.address):user.address;if(!value||typeof value!=='object'||Array.isArray(value))return null;saved=value;}catch{saved={building:user.address};}
 const text=(value:unknown)=>typeof value==='string'?value.trim():typeof value==='number'?String(value):'';
 return {building:text(saved.building||saved.houseNumber||saved.addressBuilding),street:text(saved.street||saved.addressStreet),area:text(saved.area||saved.areaName||saved.addressArea),city:text(saved.city||saved.addressCity)||'Mumbai',pincode:text(saved.pincode||saved.addressPincode),landmark:text(saved.landmark)};
}
export function readAddress(user: User): Address | null {
 const fields=savedAddressFields(user);
 if(!fields||user.latitude==null||user.longitude==null)return null;
 const latitude=Number(user.latitude),longitude=Number(user.longitude);
 if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180)return null;
 return {...fields,latitude,longitude,source:'user_profile',locationSource:user.locationSource||'legacy',locationPrecision:user.locationPrecision||'legacy',locationConfirmed:user.locationConfirmed===true,locationConfirmedAt:user.locationConfirmedAt};
}
export const addressText = (a: Address) => [a.building, a.street, a.area, a.city, a.pincode, a.landmark].filter(Boolean).join(', ');
export function validateAddress(a: Address): string | null {
  if (!a.building.trim() || !a.street.trim() || !a.area.trim() || !a.city.trim() || !/^\d{6}$/.test(a.pincode)) return 'Complete the building, street, area, city and 6-digit pincode.';
  if (!Number.isFinite(a.latitude) || !Number.isFinite(a.longitude) || Math.abs(a.latitude) > 90 || Math.abs(a.longitude) > 180) return 'Confirm a valid delivery location.';
  return null;
}
export function businessDate(offset = 0, now = Date.now()): string {
  const d = new Date(now + offset * 86400000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}


export function displaySavedAddress(value:string){try{const address=JSON.parse(value);if(address&&typeof address==='object')return addressText({...address,building:address.building||address.houseNumber,area:address.area||address.areaName});}catch{}return value;}

export function latestOrderAddress(records:Array<{userId?:string|null;createdAt?:string;addressBuilding?:string|null;addressStreet?:string|null;addressArea?:string|null;addressCity?:string|null;addressPincode?:string|null}>,owner:string,pincode:string){
 return records.filter(order=>order.userId===owner&&String(order.addressPincode||'').trim()===pincode&&!!order.addressBuilding?.trim()&&!!order.addressStreet?.trim()).sort((a,b)=>(Date.parse(b.createdAt||'')||0)-(Date.parse(a.createdAt||'')||0)).map(order=>({building:order.addressBuilding!.trim(),street:order.addressStreet!.trim(),area:order.addressArea?.trim()||'',city:order.addressCity?.trim()||'Mumbai',pincode,landmark:''}))[0]||null;
}

// Mirrors the backend road-distance estimate used to select delivery slabs.
export function billingDistance(raw:unknown,config:PaymentSettings):number|null {
 if(raw==null||raw==='')return null;
 const distance=Number(raw),multiplier=config.enableRoadDistanceMultiplier===false?1:Number(config.roadDistanceMultiplier||1.5);
 return Number.isFinite(distance)&&distance>=0&&Number.isFinite(multiplier)&&multiplier>0?Number((distance*multiplier).toFixed(2)):null;
}
