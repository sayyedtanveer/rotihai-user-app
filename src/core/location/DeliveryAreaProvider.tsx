import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import {deliveryAreaSelection} from '../storage/deliveryAreaSelection';
import { customerApi } from '../api/customerApi';
import { currentDeliveryLocation } from './customerLocation';
import { UnsupportedPincodeError,areasForPincode,type ConfiguredArea,validArea, type DeliveryArea } from './discoveryRules';
type State = { reset:()=>void; area: DeliveryArea | null; ready: boolean; select: (a: DeliveryArea) => Promise<void>; error: string | null };
const Context = createContext<State | null>(null);
export function DeliveryAreaProvider({ children }: React.PropsWithChildren) {
  const [area, setArea] = useState<DeliveryArea | null>(null), [ready, setReady] = useState(false), [error, setError] = useState<string | null>(null);
  const generation=useRef(0);
  const reset=useCallback(()=>{generation.current++;setArea(null);setError(null);},[]);
  useEffect(() => { let active = true;const version=generation.current; void deliveryAreaSelection.read().then(async saved => { if (!active || generation.current!==version || !saved) return; if (validArea(saved)) {const validated=await validatePincode(saved.pincode);if(active&&generation.current===version)setArea(validated);} }).catch(() => { if (active&&generation.current===version) setError('Your saved area could not be restored. Choose it again.'); }).finally(() => { if (active) setReady(true); }); return () => { active = false; }; }, []);
  return <Context.Provider value={{ area, ready, error, reset, select: async a => { if (!validArea(a)) throw new Error('Choose a valid delivery area and pincode.'); await deliveryAreaSelection.save(a); setArea(a); setError(null); } }}>{children}</Context.Provider>;
}
export function useDeliveryArea() { const value = useContext(Context); if (!value) throw new Error('DeliveryAreaProvider missing'); return value; }
export async function validatePincode(pincode: string): Promise<DeliveryArea> {
  if (!/^\d{6}$/.test(pincode)) throw new Error('Enter a 6-digit pincode.');
  const configured=await configuredDeliveryAreas();
  if(!areasForPincode(configured,pincode).length)throw new UnsupportedPincodeError();
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

export async function configuredDeliveryAreas(){const result=await customerApi<{areas:ConfiguredArea[]}>('/api/admin/delivery-areas',undefined,undefined,'GET',{'X-RotiHai-Require-Fresh':'1'});if(!Array.isArray(result.areas))throw new Error('Delivery areas could not be loaded. Please retry.');return result.areas;}
