// Local UI review only. Never falls through to the network or accepts mutations.
const categories=require('../../review/public-data/categories.json');
const products=require('../../review/public-data/products.json');
const chefs=require('../../review/public-data/chefs.json');
const plans=require('../../review/public-data/plans.json');
const {localReviewImage}=require('./imageMap');
for(const rows of [categories,products,chefs])for(const row of rows)if(row.image)row.image=localReviewImage(row.image);
const slots=require('../../review/public-data/slots.json');
const payment=require('../../review/public-data/payment.json');
export const reviewChef=chefs.find((c:any)=>c.name==='Fantastic MOMO')||chefs.find((c:any)=>c.isActive);
export const reviewClosedChef=chefs.find((c:any)=>c.isActive===false);
export const reviewProduct=products.find((p:any)=>p.chefId===reviewChef.id&&p.isAvailable&&!p.hasVariants)||products.find((p:any)=>p.chefId===reviewChef.id);
export const reviewVariant=products.find((p:any)=>p.chefId===reviewChef.id&&p.hasVariants&&p.variants?.length)||products.find((p:any)=>p.hasVariants&&p.variants?.length);
export const reviewNoImage=products.find((p:any)=>p.chefId===reviewChef.id&&!p.image)||products.find((p:any)=>!p.image);
export const reviewAddress={latitude:19.0728,longitude:72.8826,building:'Sample Flat 12, Review House',street:'Sample Road',area:'Kurla West',city:'Mumbai',pincode:'400070',landmark:'',source:'manual'};
export const reviewUser={id:'ui-review-only',name:'Sample Customer',phone:'9000000000',email:'sample@example.invalid',address:JSON.stringify(reviewAddress),latitude:19.0728,longitude:72.8826,walletBalance:50,referralCode:'SAMPLE'};
export const reviewCartItem={key:reviewProduct.id+':',id:reviewProduct.id,name:reviewProduct.name,price:reviewProduct.price,quantity:2,image:reviewProduct.image,chefId:reviewChef.id,chefName:reviewChef.name,categoryId:reviewProduct.categoryId,categoryName:categories.find((c:any)=>c.id===reviewProduct.categoryId)?.name||'Menu',effectiveMode:'instant',stockQuantity:reviewProduct.stockQuantity,offerPercentage:reviewProduct.offerPercentage};
const order={id:'UI-REVIEW-ORDER',customerName:reviewUser.name,phone:reviewUser.phone,chefId:reviewChef.id,chefName:reviewChef.name,categoryId:reviewProduct.categoryId,categoryName:reviewCartItem.categoryName,items:[reviewCartItem],subtotal:reviewProduct.price*2,deliveryFee:20,platformFee:0,discount:0,total:reviewProduct.price*2+20,status:'preparing',paymentStatus:'pending',address:'Sample Flat 12, Review House, Kurla West, Mumbai 400070',customerLatitude:19.0728,customerLongitude:72.8826,createdAt:'2026-11-14T07:00:00.000Z'};
const plan=plans[0]||{id:'UI-PLAN',name:'Sample meal plan',price:1200,description:'Local UI review sample',frequency:'monthly',deliveryDays:['monday','wednesday','friday'],items:[],isActive:true};
const subscription={id:'UI-REVIEW-SUBSCRIPTION',planId:plan.id,status:'active',isPaid:true,startDate:'2026-11-14',nextDeliveryDate:'2026-11-15',nextDeliveryTime:'12:00',remainingDeliveries:18,totalDeliveries:20,address:order.address,price:plan.price};
let reviewCase='';
export function setReviewCase(value:string){reviewCase=value;}
export async function reviewRequest(path:string,body?:any,method?:string):Promise<any>{
 if(!__DEV__||process.env.EXPO_PUBLIC_UI_REVIEW!=='1')throw new Error('Local UI review is disabled.');
 if(body!==undefined||method&&method!=='GET'){
  if(path==='/api/calculate-delivery'||path==='/api/calculate-delivery-fee')return {distance:1.2,deliveryFee:20,freeDeliveryEligible:false,success:true};
  if(path==='/api/user/check-bonus-eligibility')return {eligible:false,bonus:0};
  if(path==='/api/validate-pincode')return {success:true,latitude:19.0728,longitude:72.8826,pincode:'400070',area:'Kurla West'};
  if(path==='/api/geocode-full-address')return {success:true,latitude:19.0728,longitude:72.8826,accuracy:'street'};
  throw new Error('UI review is read-only. No account, order, subscription or payment was submitted.');
 }
 if(path==='/api/user/profile')return reviewUser;
 if(path.startsWith('/api/chefs/by-location')){if(reviewCase==='NoKitchens')return [];if(reviewCase==='Offline')throw new Error('You appear to be offline. Check your connection and try again.');if(reviewCase==='Loading')return new Promise(()=>{});if(reviewCase==='CartUnavailable')return chefs.map((c:any)=>({...c,isActive:false,isCurrentlyOpen:false}));return chefs;}
 if(path.startsWith('/api/chefs/'))return chefs.find((c:any)=>c.id===decodeURIComponent(path.split('/').pop()!));
 if(path==='/api/categories')return categories;
 if(path==='/api/products'||path.startsWith('/api/products?'))return products;
 if(path.startsWith('/api/products/')){if(path.endsWith('/offer'))return {offer:null};return products.find((p:any)=>p.id===decodeURIComponent(path.split('/').pop()!));}
 if(path==='/api/subscription-plans')return plans;
 if(path==='/api/promotional-banners')return require('../../review/public-data/banners.json');
 if(path==='/api/delivery-slots')return slots;
 if(path==='/api/payment-settings')return {...payment,upiId:'',merchantName:'RotiHai · UI review'};
 if(path==='/api/cart-settings')return require('../../review/public-data/cartSettings.json');
 if(path==='/api/wallet-settings')return {maxUsagePerOrder:50,minOrderAmount:100};
 if(path==='/api/user/wallet')return {balance:50};
 if(path.includes('/wallet/transactions'))return [{id:'UI-TRANSACTION',amount:50,type:'credit',description:'Sample wallet credit for layout review',createdAt:order.createdAt}];
 if(path==='/api/orders/active')return {order};
 if(path==='/api/orders'||path==='/api/user/orders')return [order];
 if(path.startsWith('/api/orders/'))return order;
 if(path==='/api/subscriptions')return [subscription];
 if(path.endsWith('/schedule'))return {subscription,plan,schedule:[{date:'2026-11-15',time:'12:00',status:'scheduled'},{date:'2026-11-16',time:'12:00',status:'scheduled'}]};
 if(path==='/api/roti-settings')return {isActive:true,isInBlockedPeriod:false,isPastLastOrderTime:false,blockMessage:''};
 if(path==='/api/admin-settings')return {preorder_lunch_start_time:'11:00',preorder_dinner_start_time:'18:00'};
 if(path==='/api/custom-subscription/price-per-roti')return {pricePerRoti:8};
 if(path==='/api/custom-subscription/requests')return [];
 if(path==='/api/user/referrals')return [];
 if(path==='/api/user/referral-eligibility')return {eligible:true};
 if(path==='/api/referral-settings')return {referrerBonus:50,referredBonus:50,minOrderAmount:200};
 if(path==='/api/user/referral-stats')return {referralCode:'SAMPLE',totalReferrals:0,completedReferrals:0,pendingReferrals:0,totalEarnings:0};
 if(path.includes('pending-checkout')||path.includes('saved-checkout'))return [];
 throw new Error('No local UI review fixture for '+path);
}
