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
