import * as Location from 'expo-location';
import { customerApi } from '../api/customerApi';
export type DeliveryAddress = {
  latitude: number; longitude: number; address: string; pincode: string;
  houseNumber: string; building?: string; street?: string; area?: string; city?: string; landmark: string; source: 'gps' | 'manual';
};
export async function currentDeliveryLocation(): Promise<DeliveryAddress> {
  if (!(await Location.hasServicesEnabledAsync())) throw new Error('Turn on location services or choose an address manually.');
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== 'granted') throw new Error('Location permission was not granted. You can choose an address manually.');
  const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  const { latitude, longitude } = position.coords;
  const addresses = await Location.reverseGeocodeAsync({ latitude, longitude }).catch(() => []);
  const address = addresses[0];
  return { latitude, longitude,
    address: address ? [address.streetNumber, address.street, address.district, address.city, address.region].filter(Boolean).join(', ') : '',
    street: address?.street || '', area: address?.district || '', city: address?.city || '', pincode: address?.postalCode || '', houseNumber: '', landmark: '', source: 'gps' };
}
export async function searchDeliveryAddress(query: string): Promise<DeliveryAddress> {
  const pincode = query.match(/\b[0-9]{6}\b/)?.[0];
  if (!pincode) throw new Error('Include a 6-digit pincode along with the street, area and city.');
  const result = await customerApi<{ success: boolean; latitude: number; longitude: number; accuracy?: string }>('/api/geocode-full-address', {
    area: query.replace(pincode, '').trim(), pincode,
  });
  const latitude = Number(result.latitude), longitude = Number(result.longitude);
  if (!result.success || !Number.isFinite(latitude) || !Number.isFinite(longitude)) throw new Error('Address not found. Please refine your address.');
  if (result.accuracy === 'pincode') throw new Error('Only an approximate pincode location was found. Add your street and building or use GPS.');
  return { latitude, longitude, address: query, pincode, houseNumber: '', landmark: '', source: 'manual' };
}
