import type {CouponVerification} from '../../../core/api/models';
type Request=<T>(path:string,body:unknown)=>Promise<T>;
export async function verifyCheckoutCoupon(request:Request,code:string,subtotal:number){
 const result=await request<CouponVerification>('/api/coupons/verify',{code:code.trim().toUpperCase(),orderAmount:subtotal});
 if(!result?.code||typeof result.discountAmount!=='number'||!Number.isFinite(result.discountAmount)||result.discountAmount<0)throw new Error('The coupon response could not be verified. Please try again.');
 return result;
}
