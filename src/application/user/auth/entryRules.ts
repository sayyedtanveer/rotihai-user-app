// Contact capture is deliberately separate from authenticated identity.
export function normalizeProvisionalPhone(value:string){const digits=value.replace(/\D/g,'').replace(/^91(?=\d{10}$)/,'');if(!/^[6-9]\d{9}$/.test(digits))throw new Error('Enter a valid 10-digit Indian mobile number.');return digits;}
// Resolve contact at the protected-action boundary; navigation state can be empty after restore.
export async function verificationContact(candidates:readonly (string|null|undefined)[],readSaved:()=>Promise<string|null>){
 for(const value of candidates){if(!value)continue;try{return normalizeProvisionalPhone(value);}catch{}}
 const saved=await readSaved();if(!saved)return null;try{return normalizeProvisionalPhone(saved);}catch{return null;}
}
export function initialCustomerStep(hasSession:boolean,phone:string|null):'home'|'phone'{return hasSession||!!phone?'home':'phone';}

export function resumedNavigationState(destination?:{name:string;params?:Record<string,unknown>}){if(!destination)return undefined;const routes=destination.name==='Tabs'?[destination]:[{name:'Tabs'},destination];return {index:routes.length-1,routes};}

// Minimal recognition never accepts identity, profile fields or tokens from lookup.
export async function recognizeCustomer(value:string,lookup:(phone:string)=>Promise<{exists:boolean}>){const phone=normalizeProvisionalPhone(value);const result=await lookup(phone);if(typeof result?.exists!=='boolean')throw new Error('Customer lookup is unavailable. Please try again.');return {phone,exists:result.exists};}

export async function databaseCustomerSession(phoneInput:string,name:string|undefined,request:<T>(path:string,body?:unknown,token?:string,method?:string,headers?:Record<string,string>)=>Promise<T>){
 const phone=normalizeProvisionalPhone(phoneInput);
 const session=await request<import('../../../core/api/customerApi').Session>('/api/user/login-or-create',{phone,...(name?.trim()?{name:name.trim()}:{})});
 if(!session.accessToken||!session.user?.id||normalizeProvisionalPhone(session.user.phone)!==phone)throw new Error('The server returned an unexpected customer account.');
 const profile=await request<import('../../../core/api/customerApi').Customer>('/api/user/profile',undefined,session.accessToken,'GET',{'X-RotiHai-Require-Fresh':'1'});
 if(profile.id!==session.user.id||normalizeProvisionalPhone(profile.phone)!==phone)throw new Error('The customer profile does not match this number.');
 return {...session,user:profile};
}

// Delivery selection precedes contact entry; restored accounts still need a valid delivery area.
export function customerEntryScreen<T extends string>(step:T,deliveryReady:boolean,hasArea:boolean):T|'restore'|'location'{
 if(!deliveryReady||step==='restore')return 'restore';
 return hasArea?step:'location';
}
