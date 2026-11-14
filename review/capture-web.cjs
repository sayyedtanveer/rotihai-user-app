// Screenshots of the deployed web UI with a public catalog snapshot and a local sample account.
// All API calls are intercepted; mutation requests are rejected. No live account is used.
const fs=require('fs'),path=require('path');const {chromium}=require('@playwright/test');
const data=name=>require('./public-data/'+name+'.json');
const categories=data('categories'),products=data('products'),chefs=data('chefs'),plans=data('plans');
const chef=chefs.find(c=>c.name==='Fantastic MOMO'),p=products.find(p=>p.chefId===chef.id&&!p.hasVariants);
const address={building:'Sample Flat 12, Review House',street:'Sample Road',area:'Kurla West',city:'Mumbai',pincode:'400070',latitude:19.0728,longitude:72.8826};
const user={id:'ui-review-only',name:'Sample Customer',phone:'9000000000',email:'sample@example.invalid',address:JSON.stringify(address),latitude:address.latitude,longitude:address.longitude,walletBalance:50,referralCode:'SAMPLE'};
const item={...p,quantity:2,chefName:chef.name,effectiveMode:'instant'};
const order={id:'UI-REVIEW-ORDER',customerName:user.name,phone:user.phone,userId:user.id,chefId:chef.id,chefName:chef.name,categoryId:p.categoryId,categoryName:categories.find(c=>c.id===p.categoryId)?.name,items:[item],subtotal:p.price*2,deliveryFee:20,total:p.price*2+20,status:'preparing',paymentStatus:'pending',address:'Sample Flat 12, Kurla West, Mumbai 400070',createdAt:'2026-11-14T07:00:00.000Z'};
function fixture(url){const u=new URL(url),q=u.pathname;
 if(q==='/api/categories')return categories;
 if(q.startsWith('/api/products/')&&q.endsWith('/offer'))return {offer:null};
 if(q==='/api/products/with-offers')return {products};
 if(q==='/api/products')return products;
 if(q.startsWith('/api/chefs'))return q.includes('status')?chefs.map(c=>({chefId:c.id,isActive:c.isActive})):chefs;
 if(q==='/api/user/profile')return user;
 if(q==='/api/orders'||q==='/api/user/orders'||q.startsWith('/api/orders/'))return q.endsWith('ORDER')?order:[order];
 if(q==='/api/subscription-plans')return plans;
 if(q==='/api/subscriptions')return [];
 if(q==='/api/promotional-banners')return data('banners');
 if(q==='/api/delivery-slots')return data('slots');
 if(q==='/api/payment-settings')return {...data('payment'),upiId:''};
 if(q==='/api/delivery-settings')return data('deliverySettings');
 if(q==='/api/cart-settings')return data('cartSettings');
 if(q==='/api/user/wallet')return {balance:50};
 if(q.includes('wallet-settings'))return {maxUsagePerOrder:50,minOrderAmount:100};
 if(q.includes('referral-settings'))return {referrerBonus:50,referredBonus:50,minOrderAmount:200};
 if(q.includes('eligibility'))return {eligible:true};
 if(q==='/api/custom-subscription/price-per-roti')return {pricePerRoti:8};
 if(q==='/api/admin-settings')return {};
 return [];
}
(async()=>{
 fs.mkdirSync('review/screenshots/web',{recursive:true});let proxy;const raw=process.env.HTTPS_PROXY||process.env.HTTP_PROXY;if(raw){const u=new URL(raw);proxy={server:u.origin,username:decodeURIComponent(u.username),password:decodeURIComponent(u.password)}}
 const browser=await chromium.launch({channel:'chrome',headless:true,proxy});const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
 const page=await context.newPage();await page.routeWebSocket(/.*/,ws=>ws.close());
 const cachedImages=require('./images/sources.json');
 await page.route('https://res.cloudinary.com/**',route=>{const name=cachedImages[route.request().url()];return name?route.fulfill({path:path.resolve('review/images',name)}):route.continue();});
 await page.route('**/*Fresh_tandoori_rotis_stack*',route=>route.fulfill({path:path.resolve('assets/brand/hero.png'),contentType:'image/png'}));
 const blocked=[];
 await page.route('**/api/**',async route=>{const req=route.request();if(req.method()!=='GET'){
  if(['/api/calculate-delivery','/api/calculate-delivery-fee'].includes(new URL(req.url()).pathname))return route.fulfill({json:{deliveryFee:20,distance:1.2,freeDeliveryEligible:false,success:true}});
  blocked.push(req.method()+' '+new URL(req.url()).pathname);return route.fulfill({status:403,json:{message:'Read-only visual review: mutations disabled.'}});
 }return route.fulfill({json:fixture(req.url())});});
 await page.addInitScript(({user,address,chef,item,order})=>{
  localStorage.setItem('userToken',btoa(JSON.stringify({alg:'HS256',typ:'JWT'}))+'.'+btoa(JSON.stringify({userId:user.id,phone:user.phone,name:user.name,exp:2208988800}))+'.ui-review-not-a-real-signature');localStorage.setItem('userData',JSON.stringify(user));localStorage.setItem('userId',user.id);
  localStorage.setItem('validatedPincode',JSON.stringify({...address,area:address.area,validatedAt:new Date().toISOString()}));localStorage.setItem('userPincode',address.pincode);localStorage.setItem('pincodeArea',address.area);localStorage.setItem('userLatitude',String(address.latitude));localStorage.setItem('userLongitude',String(address.longitude));
  localStorage.setItem('streetRefinement',JSON.stringify({pincode:address.pincode,area:address.area,street:address.street,skipped:true,savedAt:new Date().toISOString()}));
  localStorage.setItem('cart-storage',JSON.stringify({state:{carts:[{chefId:chef.id,chefName:chef.name,chefLatitude:chef.latitude,chefLongitude:chef.longitude,categoryId:item.categoryId,categoryName:order.categoryName,items:[item]}],userLatitude:address.latitude,userLongitude:address.longitude,isLocationExact:true},version:0}));
 },{user,address,chef,item,order});
 const results=[];
 const snap=async name=>{await page.screenshot({path:'review/screenshots/web/'+name+'.png'});results.push({name,url:page.url(),fixture:true});console.log('Captured web '+name);};
 try{
  await page.goto('https://rotihai-main-bcht.onrender.com',{waitUntil:'domcontentloaded',timeout:60000});
  await page.getByTestId('card-partner-'+chef.id).waitFor({timeout:20000});
  const skip=page.getByTestId('button-street-refinement-skip');if(await skip.isVisible().catch(()=>false))await skip.click();
  await snap('Home');
  await page.getByTestId('card-partner-'+chef.id).scrollIntoViewIfNeeded();await snap('Kitchens');
  await page.getByTestId('card-partner-'+chef.id).click();await page.getByTestId('button-close-category-menu').waitFor({timeout:10000});await snap('Catalog');
  await page.getByTestId('button-close-category-menu').click();
  const cartButton=page.getByTestId('button-cart');if(await cartButton.count()){await cartButton.click();await page.getByText('Your Cart',{exact:true}).waitFor({timeout:3000}).catch(()=>{});await snap('Cart');}
 }catch(e){results.push({name:'Home flow',error:e.message});console.log('Home flow: '+e.message.slice(0,250));}
 for(const [name,url]of Object.entries({Orders:'/my-orders',Profile:'/profile',Subscriptions:'/my-subscriptions',CustomSubscription:'/custom-subscription',Referrals:'/invite',Privacy:'/privacy-policy',OrderDetails:'/track/UI-REVIEW-ORDER'})){
  try{await page.goto('https://rotihai-main-bcht.onrender.com'+url,{waitUntil:'domcontentloaded',timeout:45000});await page.locator('h1,h2').first().waitFor({timeout:10000}).catch(()=>{});await snap(name);}catch(e){results.push({name,error:e.message});}
 }
 fs.writeFileSync('review/screenshots/web/capture-results.json',JSON.stringify({results,blockedMutations:blocked},null,2));await browser.close();
})().catch(e=>{console.error(e.message);process.exitCode=1});
