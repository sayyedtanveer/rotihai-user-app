import AsyncStorage from '@react-native-async-storage/async-storage';
import type {DeliveryArea} from '../location/discoveryRules';
const KEY='customer-delivery-area';
export const deliveryAreaSelection={
 read:async()=>{const raw=await AsyncStorage.getItem(KEY);return raw?JSON.parse(raw):null;},
 save:(area:DeliveryArea)=>AsyncStorage.setItem(KEY,JSON.stringify(area)),
 clear:()=>AsyncStorage.removeItem(KEY),
};
