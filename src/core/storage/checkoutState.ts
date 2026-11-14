import type {Address} from '../api/models';
import {readPrivateJson,writePrivateJson,removePrivateJson} from './privateJson';
const reviewMode=()=>typeof __DEV__!=='undefined'&&__DEV__&&process.env.EXPO_PUBLIC_UI_REVIEW==='1';
const reviewAddresses=new Map<string,Address>();
const addressKey=(owner:string)=>'rotihai.checkout-address.'+owner;
export const checkoutDraftKey=(owner:string,cartKey:string)=>(reviewMode()?'rotihai.review.checkout-draft.':'rotihai.checkout-draft.')+owner+'.'+cartKey.replace(/[^a-zA-Z0-9.-]/g,'_');
export const checkoutAddress={
 read:async(owner:string):Promise<Address|null>=>reviewMode()?reviewAddresses.get(owner)||null:readPrivateJson<Address>(addressKey(owner)),
 clear:async(owner:string)=>{if(reviewMode())reviewAddresses.delete(owner);else await removePrivateJson(addressKey(owner));},
 save:async(owner:string,address:Address)=>{if(reviewMode()){reviewAddresses.set(owner,address);return;}await writePrivateJson(addressKey(owner),address);},
};
export async function migrateGuestCheckout(owner:string,cartKey?:string){
 const address=await checkoutAddress.read('guest');
 if(address){await checkoutAddress.save(owner,address);await removePrivateJson(addressKey('guest'));}
 if(cartKey){const key=checkoutDraftKey('guest',cartKey),draft=await readPrivateJson(key);if(draft){await writePrivateJson(checkoutDraftKey(owner,cartKey),draft);await removePrivateJson(key);}}
}

export const subscriptionDraftKey=(owner:string,planId:string)=>(reviewMode()?'rotihai.review.subscribe-draft.':'rotihai.subscribe-draft.')+owner+'.'+planId;
export async function migrateGuestSubscription(owner:string,planId:string){const key=subscriptionDraftKey('guest',planId),draft=await readPrivateJson(key);if(draft){await writePrivateJson(subscriptionDraftKey(owner,planId),draft);await removePrivateJson(key);}}
