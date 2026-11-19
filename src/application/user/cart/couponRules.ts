import type {CouponVerification} from '../../../core/api/models';
type Request=<T>(path:string,body:unknown)=>Promise<T>;
export async function verifyCheckoutCoupon(request:Request,code:string,subtotal:number){
 const result=await request<CouponVerification>('/api/coupons/verify',{code:code.trim().toUpperCase(),orderAmount:subtotal});
 if(!result?.code||typeof result.discountAmount!=='number'||!Number.isFinite(result.discountAmount)||result.discountAmount<0)throw new Error('The coupon response could not be verified. Please try again.');
 return result;
}

export async function verifyCheckoutReferral(request:Request,code:string,subtotal:number){
 const referralCode=code.trim().toUpperCase();
 if(!referralCode)throw new Error('Enter a referral code.');
 const result=await request<{valid:boolean;message?:string}>('/api/referral/validate',{referralCode,orderAmount:subtotal});
 if(result?.valid!==true)throw new Error(result?.message||'This referral code is unavailable.');
 return {code:referralCode,message:result.message||'Referral code checked. Rewards follow the current eligibility rules.'};
}
