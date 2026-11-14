import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { customerApi } from '../api/customerApi';
import { currentDeliveryLocation } from './customerLocation';
import { validArea, type DeliveryArea } from './discoveryRules';
type State = { area: DeliveryArea | null; ready: boolean; select: (a: DeliveryArea) => Promise<void>; error: string | null };
const Context = createContext<State | null>(null);
export function DeliveryAreaProvider({ children }: React.PropsWithChildren) {
  const [area, setArea] = useState<DeliveryArea | null>(null), [ready, setReady] = useState(false), [error, setError] = useState<string | null>(null);
  useEffect(() => { let active = true; void AsyncStorage.getItem('customer-delivery-area').then(raw => { if (!active || !raw) return; const saved = JSON.parse(raw); if (validArea(saved)) setArea(saved); }).catch(() => { if (active) setError('Your saved area could not be restored. Choose it again.'); }).finally(() => { if (active) setReady(true); }); return () => { active = false; }; }, []);
  return <Context.Provider value={{ area, ready, error, select: async a => { if (!validArea(a)) throw new Error('Choose a valid delivery area and pincode.'); await AsyncStorage.setItem('customer-delivery-area', JSON.stringify(a)); setArea(a); setError(null); } }}>{children}</Context.Provider>;
}
export function useDeliveryArea() { const value = useContext(Context); if (!value) throw new Error('DeliveryAreaProvider missing'); return value; }
export async function validatePincode(pincode: string): Promise<DeliveryArea> {
  if (!/^\d{6}$/.test(pincode)) throw new Error('Enter a 6-digit pincode.');
  const result = await customerApi<DeliveryArea & { success: boolean; message?: string }>('/api/validate-pincode', { pincode });
  if (!result.success || !validArea(result)) throw new Error(result.message || 'This delivery area could not be resolved.');
  return { ...result, source: 'pincode' };
}
export async function detectDeliveryArea(): Promise<DeliveryArea> {
  const found = await currentDeliveryLocation();
  if (!/^\d{6}$/.test(found.pincode)) throw new Error('GPS could not resolve a pincode. Please enter it manually.');
  const validated = await validatePincode(found.pincode);
  return { ...validated, latitude: found.latitude, longitude: found.longitude, area: found.area || validated.area, city: found.city || validated.city, source: 'gps' };
}
