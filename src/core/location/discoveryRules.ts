import type { Chef } from '../api/models';
export type DeliveryArea = { latitude: number; longitude: number; pincode: string; area: string; city?: string; state?: string; country?: string; source: 'gps' | 'pincode' | 'address' };
export function validArea(value: unknown): value is DeliveryArea {
  const a = value as DeliveryArea | null;
  return !!a && /^\d{6}$/.test(a.pincode) && typeof a.area === 'string' && !!a.area.trim() && typeof a.latitude === 'number' && Number.isFinite(a.latitude) && Math.abs(a.latitude) <= 90 && typeof a.longitude === 'number' && Number.isFinite(a.longitude) && Math.abs(a.longitude) <= 180;
}
// Candidates are always supplied by the server's radius endpoint. Never use
// an unfiltered vendor download or a separate client distance algorithm.
export function serviceableChefs(chefs: Chef[], area: DeliveryArea) {
  return chefs.filter(c => (!c.servicePincodes?.length || c.servicePincodes.some(p => String(p).trim() === area.pincode)));
}

export function validatedDeliveryFee(quote:{deliveryFee:unknown;freeDeliveryEligible?:boolean;deliveryRangeName?:string}){
 const fee=Number(quote.deliveryFee);
 if(quote.deliveryFee==null||quote.deliveryFee===''||!Number.isFinite(fee)||fee<0||/outside|no .*settings/i.test(quote.deliveryRangeName||''))throw new Error('Delivery pricing is unavailable for this address. Please choose another location or retry.');
 return quote.freeDeliveryEligible?0:fee;
}

export type ConfiguredArea={id:string;name:string;pincodes:(string|number)[];isActive:boolean;latitude?:number|string;longitude?:number|string};
export function areasForPincode(areas:ConfiguredArea[],pincode:string){return areas.filter(a=>a.isActive===true&&Array.isArray(a.pincodes)&&a.pincodes.some(p=>String(p).trim()===pincode));}

export class UnsupportedPincodeError extends Error {constructor(){super('RotiHai is not delivering in your area yet. We are expanding soon and will start delivering fresh ghar ka khana here shortly.');this.name='UnsupportedPincodeError';}}
