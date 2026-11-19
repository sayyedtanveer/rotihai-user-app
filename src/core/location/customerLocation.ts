import * as Location from 'expo-location';
import { customerApi } from '../api/customerApi';
export type DeliveryAddress = {
  latitude: number; longitude: number; address: string; pincode: string; locationConfirmed?:boolean; locationSource?:string; locationPrecision?:string;
  accuracyMeters?:number; precision?:string; houseNumber: string; building?: string; street?: string; area?: string; city?: string; landmark: string; source: 'gps' | 'manual';
};
export async function currentDeliveryLocation(): Promise<DeliveryAddress> {
  if (!(await Location.hasServicesEnabledAsync())) throw new Error('Turn on location services or choose an address manually.');
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== 'granted') throw new Error('Location permission was not granted. You can choose an address manually.');
  let timer:ReturnType<typeof setTimeout>|undefined;
  const position = await Promise.race([Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('GPS is taking too long. Move near a window or search for your address.')),20000);})]).finally(()=>clearTimeout(timer));
  const { latitude, longitude } = position.coords;
  const addresses = await Location.reverseGeocodeAsync({ latitude, longitude }).catch(() => []);
  const address = addresses[0];
  return { latitude, longitude, accuracyMeters:position.coords.accuracy??undefined,
    address: address ? [address.streetNumber, address.street, address.district, address.city, address.region].filter(Boolean).join(', ') : '',
    street: address?.street || '', area: address?.district || '', city: address?.city || '', pincode: address?.postalCode || '', houseNumber: '', landmark: '', source: 'gps' };
}
export async function searchDeliveryAddress(query: string,details?:{building:string;street:string;area:string;pincode:string;city?:string}): Promise<DeliveryAddress> {
  const pincode = details?.pincode||query.match(/\b[0-9]{6}\b/)?.[0];
  if (!pincode) throw new Error('Include a 6-digit pincode along with the street, area and city.');
  const result = await customerApi<{ success: boolean; latitude: number; longitude: number; accuracy?: string; precision?:string; source?:string }>('/api/geocode-full-address', {
    building:details?.building,street:details?.street,area:details?.area||query.replace(pincode, '').trim(), pincode,city:details?.city,
  });
  const latitude = Number(result.latitude), longitude = Number(result.longitude);
  if (!result.success || !Number.isFinite(latitude) || !Number.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180) throw new Error('Address not found. Please refine your address.');
  return { latitude, longitude, address: query, pincode,street:details?.street,area:details?.area,building:details?.building,precision:result.precision||(result.accuracy==='exact'?'rooftop':result.accuracy),locationSource:result.source, houseNumber: '', landmark: '', source: 'manual' };
}

export async function reverseDeliveryPin(point:{latitude:number;longitude:number}){
 const results=await Location.reverseGeocodeAsync(point);
 const address=results[0];
 if(!address)throw new Error('Address details could not be found for this pin. Check the street, area and pincode below.');
 return {street:address.street||'',area:address.district||address.subregion||'',city:address.city||'',pincode:address.postalCode||''};
}
