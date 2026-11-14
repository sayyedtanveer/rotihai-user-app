import AsyncStorage from '@react-native-async-storage/async-storage';
import {readPrivateJson,writePrivateJson,removePrivateJson} from '../storage/privateJson';
import * as SecureStore from 'expo-secure-store';
import type {User} from './models';
const PUBLIC=['/api/categories','/api/products','/api/chefs/','/api/subscription-plans','/api/promotional-banners','/api/delivery-slots','/api/custom-subscription/price-per-roti'];
const publicPath=(path:string)=>PUBLIC.some(prefix=>path===prefix||path.startsWith(prefix));
const privatePath=(path:string)=>path==='/api/user/profile'||path==='/api/user/orders'||path==='/api/orders'||path.startsWith('/api/orders/')||path==='/api/subscriptions'||path.endsWith('/schedule');
const key=(owner:string,path:string)=>'rotihai.cache.'+owner+'.'+Array.from(path).map(c=>c.charCodeAt(0).toString(16)).join('');
const MAX_AGE=7*86400000;
export async function cachedResponse<T>(path:string,owner?:string):Promise<T|null>{
 try{const value=publicPath(path)?JSON.parse(await AsyncStorage.getItem(key('public',path))||'null'):owner&&privatePath(path)?await readPrivateJson<{at:number;data:T}>(key(owner,path)):null;return value&&Date.now()-value.at<MAX_AGE?value.data:null;}catch{return null;}
}
export async function cacheResponse(path:string,data:unknown,owner?:string){
 if(typeof __DEV__!=='undefined'&&__DEV__&&process.env.EXPO_PUBLIC_UI_REVIEW==='1')return;
 if(publicPath(path))await AsyncStorage.setItem(key('public',path),JSON.stringify({at:Date.now(),data}));
 else if(owner&&privatePath(path)){
 const k=key(owner,path);await writePrivateJson(k,{at:Date.now(),data});
 const indexKey='rotihai.private-cache-index.'+owner;const index:string[]=JSON.parse(await AsyncStorage.getItem(indexKey)||'[]');if(!index.includes(k))await AsyncStorage.setItem(indexKey,JSON.stringify([...index,k]));
 }
}
export async function clearPrivateCache(owner:string){const indexKey='rotihai.private-cache-index.'+owner;const index:string[]=JSON.parse(await AsyncStorage.getItem(indexKey)||'[]');await Promise.all(index.map(removePrivateJson));await AsyncStorage.removeItem(indexKey);}
export const profileOwnerKey='rotihai.cached-profile-owner';
export async function bindCachedProfile(token:string,owner:string){await SecureStore.setItemAsync(profileOwnerKey,JSON.stringify({token,owner}));}
export async function cachedProfile(token:string):Promise<User|null>{try{const raw=await SecureStore.getItemAsync(profileOwnerKey);if(!raw)return null;const binding=JSON.parse(raw);if(binding.token!==token)return null;return cachedResponse<User>('/api/user/profile',binding.owner);}catch{return null;}}
export async function forgetCachedProfile(){await SecureStore.deleteItemAsync(profileOwnerKey);}

const savedDeliveries=new Set<string>();const cacheListeners=new Set<()=>void>();
const deliveryKey=(path:string,owner?:string)=>key(publicPath(path)?'public':owner||'guest',path);
export function markCachedDelivery(path:string,owner:string|undefined,cached:boolean){const k=deliveryKey(path,owner);if(savedDeliveries.has(k)===cached)return;if(cached)savedDeliveries.add(k);else savedDeliveries.delete(k);cacheListeners.forEach(listener=>listener());}
export const isCachedDelivery=(path:string,owner?:string)=>savedDeliveries.has(deliveryKey(path,owner));
export function subscribeCacheDelivery(listener:()=>void){cacheListeners.add(listener);return()=>{cacheListeners.delete(listener);};}
