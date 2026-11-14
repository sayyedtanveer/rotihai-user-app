const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const testStorage=new Map();const nativeMocks={'@react-native-async-storage/async-storage':{__esModule:true,default:{getItem:async key=>testStorage.get(key)||null,setItem:async(key,value)=>testStorage.set(key,value),removeItem:async key=>testStorage.delete(key)}},'expo-secure-store':{getItemAsync:async key=>testStorage.get(key)||null,setItemAsync:async(key,value)=>testStorage.set(key,value),deleteItemAsync:async key=>testStorage.delete(key)},'expo-network':{getNetworkStateAsync:async()=>({isConnected:true,isInternetReachable:true}),addNetworkStateListener:()=>({remove(){}})}};
const cache = new Map();
function load(relative) {
  const file = path.resolve(__dirname, '..', relative);
  if (cache.has(file)) return cache.get(file).exports;
  const module = {exports: {}}; cache.set(file, module);
  const source = ts.transpileModule(fs.readFileSync(file,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  new Function('require','module','exports',source)(name => nativeMocks[name] || (name.startsWith('.') ? load(path.relative(path.resolve(__dirname,'..'),path.resolve(path.dirname(file),name+'.ts'))) : require(name)),module,module.exports);
  return module.exports;
}
const rules=load('src/application/user/cart/cartRules.ts');
const {validateFreshItem,slotTiming}=load('src/application/user/cart/checkoutRules.ts');
const {restoreCartItems}=load('src/application/user/cart/restoreCart.ts');
const {validPauseDates}=load('src/application/user/cart/dateRules.ts');
const item={key:'p:base',id:'p',name:'Roti',price:10,quantity:3,chefId:'c',chefName:'Kitchen',categoryId:'r',categoryName:'Rotis',effectiveMode:'instant',stockQuantity:10};
const product={...item,isAvailable:true};
test('baskets stay separated by kitchen and category',()=>assert.equal(rules.groupCart([item,{...item,chefId:'d'},{...item,categoryId:'other'}]).length,3));
test('mixed instant/preorder basket rejected',()=>assert.throws(()=>rules.assertCanAdd([item],{...item,key:'q',effectiveMode:'preorder'})));
test('fractional or excessive quantities rejected',()=>{assert.throws(()=>rules.assertCanAdd([],{...item,quantity:1.5}));assert.throws(()=>rules.assertCanAdd([item],{...item,quantity:8}));});
test('promotion caps discounted quantity',()=>assert.equal(rules.lineTotal({...item,offer:{promotionalPrice:5,maxDiscountedQuantity:2}}),20));
test('expired promotion is not billed',()=>assert.equal(rules.lineTotal({...item,offer:{promotionalPrice:5,maxDiscountedQuantity:3,validUntil:'2000-01-01'}}),30));
test('fee above 200 is preserved until configured waiver',()=>{const c={platformFeeEnabled:true,platformFeeWaiverThreshold:500,platformFeeAbove200:9};assert.equal(rules.platformFee(300,c),9);assert.equal(rules.platformFee(500,c),0);});
test('fresh offer expiry or changed discount blocks checkout',()=>assert.throws(()=>validateFreshItem({...item,offer:{promotionalPrice:5,maxDiscountedQuantity:3}},product,null)));
test('fresh promotion quantity limit blocks checkout',()=>assert.throws(()=>validateFreshItem(item,product,{promotionalPrice:10,maxDiscountedQuantity:1,maxOrderQuantity:2})));
test('removed variant blocks checkout',()=>assert.throws(()=>validateFreshItem({...item,variantId:'gone'},{...product,hasVariants:true,variants:[]},null)));
test('stock and menu movement block checkout',()=>{assert.throws(()=>validateFreshItem(item,{...product,stockQuantity:1},null));assert.throws(()=>validateFreshItem(item,{...product,chefId:'other'},null));});
test('unchanged current item passes',()=>assert.doesNotThrow(()=>validateFreshItem(item,product,null)));
test('slot cutoff uses Indian timezone irrespective of device timezone',()=>{const r=slotTiming({id:'s',startTime:'12:00',endTime:'13:00',cutoffHoursBefore:2},'2026-11-14',Date.parse('2026-11-14T05:00:00Z'));assert.equal(r.late,true);assert.equal(r.ended,false);assert.equal(r.cutoff,Date.parse('2026-11-14T04:30:00Z'));});
test('past slots cannot be selected',()=>assert.equal(slotTiming({id:'s',startTime:'12:00'},'2026-11-14',Date.parse('2026-11-14T07:00:00Z')).ended,true));
test('impossible and past pause dates rejected',()=>{assert.equal(validPauseDates('2026-02-30','2026-03-05','2026-02-01'),false);assert.equal(validPauseDates('2026-02-01','2026-02-02','2026-02-02'),false);assert.equal(validPauseDates('2028-02-29','2028-03-01','2028-02-28'),true);});
test('onboarding structured address survives saved profile parsing',()=>{const a=rules.readAddress({latitude:'19.1',longitude:'72.9',address:JSON.stringify({houseNumber:'1',street:'Road',area:'Area',city:'Mumbai',pincode:'400001'})});assert.equal(a.building,'1');assert.equal(rules.validateAddress(a),null);assert.equal(a.latitude,19.1);});
function mockRequest(overrides={}) {return async url=>{if(url==='/api/categories')return[{id:'r',name:'Rotis'}];if(url==='/api/products/p')return{...product,price:12,...overrides};if(url.endsWith('/offer'))return{offer:null};if(url==='/api/chefs/c')return{id:'c',name:'Kitchen'};throw new Error(url);};}
test('saved basket restoration fetches current prices without placing an order',async()=>{const restored=await restoreCartItems({chefId:'c',items:[item]},mockRequest());assert.equal(restored[0].price,12);assert.equal(restored[0].quantity,3);});
test('unavailable saved dishes fail restoration',async()=>assert.rejects(()=>restoreCartItems({items:[item]},mockRequest({isAvailable:false}))));
test('malformed saved quantity fails restoration',async()=>assert.rejects(()=>restoreCartItems({items:[{...item,quantity:-1}]},mockRequest())));
const {customerApi,ApiError}=load('src/core/api/customerApi.ts');
test('API handles empty success and non-JSON service errors',async()=>{
 const oldFetch=global.fetch,oldBase=process.env.EXPO_PUBLIC_API_BASE_URL;
 process.env.EXPO_PUBLIC_API_BASE_URL='https://api.test.invalid';
 try {
  global.fetch=async()=>({ok:true,status:204,text:async()=>''});assert.equal(await customerApi('/test'),null);
  global.fetch=async()=>({ok:false,status:503,text:async()=>'<html>Unavailable</html>'});await assert.rejects(()=>customerApi('/test'),e=>e instanceof ApiError&&e.status===503);
 }finally{global.fetch=oldFetch;if(oldBase===undefined)delete process.env.EXPO_PUBLIC_API_BASE_URL;else process.env.EXPO_PUBLIC_API_BASE_URL=oldBase;}
});

const {validArea,serviceableChefs}=load('src/core/location/discoveryRules.ts');
test('delivery area rejects malformed pincodes and invalid coordinates',()=>{
 const a={latitude:19.1,longitude:72.9,pincode:'400070',area:'Kurla',source:'pincode'};
 assert.equal(validArea(a),true);assert.equal(validArea({...a,pincode:'000'}),false);assert.equal(validArea({...a,latitude:NaN}),false);assert.equal(validArea({...a,longitude:181}),false);
});
test('location discovery retains inactive kitchens but respects explicit service restrictions',()=>{
 const a={latitude:19.1,longitude:72.9,pincode:'400070',area:'Kurla',source:'pincode'};
 const rows=[{id:'open',isActive:true},{id:'inactive',isActive:false},{id:'restricted',isActive:true,servicePincodes:['400001']},{id:'matching',isActive:true,servicePincodes:['400070']}];
 assert.deepEqual(serviceableChefs(rows,a).map(c=>c.id),['open','inactive','matching']);
});

const {groupMenu,matchesCategory,isKitchenOrderable,cartItemIssue}=load('src/application/user/catalog/menuRules.ts');
test('inactive kitchen remains visible in its category even without menu products',()=>{const c={id:'closed',categoryId:'quick',isActive:false};assert.equal(matchesCategory(c,[],'quick'),true);assert.equal(isKitchenOrderable(c),false);});
test('web menu sections retain food type and combo labels, order and Others fallback',()=>{const p=[{id:'a',name:'Z',section:'Combo Deals',sectionOrder:10,sortOrder:2},{id:'b',name:'B',section:'Momos',sectionOrder:0,sortOrder:1},{id:'c',name:'A',section:'Combo Deals',sectionOrder:10,sortOrder:0},{id:'d',name:'Unsectioned'}];const g=groupMenu(p);assert.deepEqual(g.map(s=>s.title),['Momos','Combo Deals','Others']);assert.deepEqual(g[1].data.map(p=>p.id),['c','a']);});
test('menu grouping preserves separate category sections with identical names',()=>{const g=groupMenu([{id:'a',name:'A',categoryId:'r',section:'Specials'},{id:'b',name:'B',categoryId:'s',section:'Specials'}],[{id:'r',name:'Rotis'},{id:'s',name:'Snacks'}],true);assert.equal(g.length,2);assert.notEqual(g[0].key,g[1].key);});
test('cart availability blocks inactive kitchen and removed or unavailable variant',()=>{const c={id:'c',isActive:true,isCurrentlyOpen:true};assert.equal(cartItemIssue(item,[product],[c]),null);assert.match(cartItemIssue(item,[product],[{...c,isActive:false}]),/unavailable/);assert.match(cartItemIssue({...item,variantId:'gone'},[{...product,hasVariants:true,variants:[]}],[c]),/size/);});

const content=load('src/application/user/catalog/contentRules.ts'),subscriptionRules=load('src/application/user/subscriptions/subscriptionRules.ts'),{rotiOrderingBlocked,assertRotiOrderingAllowed}=load('src/application/user/cart/checkoutRules.ts'),{verifyCheckoutCoupon}=load('src/application/user/cart/couponRules.ts');
const promo={id:'b',title:'Admin title',subtitle:'Admin terms',buttonText:'Browse plans',gradientFrom:'orange-600',gradientVia:'amber-600',gradientTo:'yellow-600',actionType:'subscription',isActive:true,displayOrder:2};
test('admin banners keep actual content, display ordering and deactivation',()=>{const input=[promo,{...promo,id:'first',displayOrder:0},{...promo,id:'off',isActive:false}];assert.deepEqual(content.activeBanners(input).map(b=>b.id),['first','b']);assert.equal(content.activeBanners([{...promo,title:'Updated title',subtitle:'Updated terms'}])[0].subtitle,'Updated terms');assert.equal(input[0].id,'b');assert.deepEqual(content.activeBanners([{...promo,isActive:false}]),[]);});
test('admin banner destinations reuse subscription/category routes and supported web links',()=>{assert.deepEqual(content.bannerAction(promo),{kind:'subscriptions'});assert.deepEqual(content.bannerAction({...promo,actionType:'category',actionValue:'food'}),{kind:'category',id:'food'});assert.deepEqual(content.bannerAction({...promo,actionType:'url',actionValue:'/invite'},'https://web.test.invalid'),{kind:'url',url:'https://web.test.invalid/invite'});assert.equal(content.bannerAction({...promo,actionType:'url',actionValue:'javascript:alert(1)'}),null);assert.equal(content.bannerAction({...promo,actionType:'category',actionValue:''}),null);});
test('admin subscription section ordering, category boundaries and prices are preserved',()=>{const base={id:'p',categoryId:'r',name:'Plan',description:'Actual plan terms',frequency:'weekly',price:701,deliveryDays:['monday'],items:[],sectionName:'Meals',isActive:true};const groups=content.groupPlans([{...base,sectionOrder:5},{...base,id:'other',categoryId:'d',price:333,sectionOrder:1},{...base,id:'off',isActive:false}],[{id:'r',name:'Rotis'},{id:'d',name:'Dinner'}]);assert.deepEqual(groups.map(g=>g.category),['Dinner','Rotis']);assert.equal(groups[0].plans[0].price,333);assert.equal(groups[1].plans[0].description,'Actual plan terms');});
test('referral earnings use the real totalEarnings contract and zero rewards are never replaced by defaults',()=>{assert.equal(content.referralEarnings({totalEarnings:127,totalEarned:5}),127);assert.equal(content.referralEarnings({totalEarnings:0}),0);assert.equal(content.referralEarnings({}),null);assert.doesNotMatch(content.referralShareMessage('CODE',{referredBonus:0}),/50|₹/);assert.match(content.referralShareMessage('CODE',{referredBonus:17}),/₹17/);});
test('roti order gating uses admin server flags rather than an invented client time window',()=>{const rules={isActive:true,isInBlockedPeriod:false,isPastLastOrderTime:false,blockMessage:'Admin configured message'};assert.equal(rotiOrderingBlocked(rules,true),false);assert.equal(rotiOrderingBlocked({...rules,isInBlockedPeriod:true},true),true);assert.equal(rotiOrderingBlocked({...rules,isPastLastOrderTime:true},true),false);assert.equal(rotiOrderingBlocked({...rules,isActive:false,isInBlockedPeriod:true},true),false);assert.equal(rotiOrderingBlocked({...rules,isInBlockedPeriod:true},false),false);assert.throws(()=>assertRotiOrderingAllowed({...rules,isInBlockedPeriod:true}),/Admin configured message/);assert.throws(()=>assertRotiOrderingAllowed(null),/could not be loaded/);});
test('coupon value is the server amount and backend eligibility errors pass through',async()=>{const calls=[];const result=await verifyCheckoutCoupon(async(url,body)=>{calls.push([url,body]);return {code:'SAVE',discountAmount:23,discountType:'fixed'};},' save ',250);assert.equal(result.discountAmount,23);assert.deepEqual(calls,[['/api/coupons/verify',{code:'SAVE',orderAmount:250}]]);await assert.rejects(()=>verifyCheckoutCoupon(async()=>{throw Error('Coupon has expired');},'OLD',250),/expired/);await assert.rejects(()=>verifyCheckoutCoupon(async()=>({code:'BAD',discountAmount:NaN}),'BAD',250),/could not be verified/);});
test('custom plan estimate follows the existing weekly/monthly contract with the current admin price',()=>{assert.equal(subscriptionRules.customPlanEstimate(3,'weekly',9),189);assert.equal(subscriptionRules.customPlanEstimate(3,'monthly',11),990);for(const [n,d,p]of [[0,'weekly',9],[1.5,'weekly',9],[3,'yearly',9],[3,'weekly',0]])assert.throws(()=>subscriptionRules.customPlanEstimate(n,d,p));assert.equal(subscriptionRules.activeCustomRequest([{status:'paid'}]).status,'paid');assert.equal(subscriptionRules.activeCustomRequest([{status:'converted'}]),undefined);assert.match(subscriptionRules.customStatusLabel('paid'),/awaiting activation/);});
test('slot requirements follow the selected plan category and metadata',()=>{assert.equal(subscriptionRules.planRequiresSlot({categoryId:'r'},[{id:'r',name:'Rotis'}]),true);assert.equal(subscriptionRules.planRequiresSlot({categoryId:'d'},[{id:'d',name:'Dinner'}]),false);assert.equal(subscriptionRules.planRequiresSlot({categoryId:'d'},[{id:'d',name:'Dinner',requiresDeliverySlot:true}]),true);});
test('ambiguous subscription matching never reuses the original renewal record',()=>{const attempt={kind:'renewal',planId:'p',originalId:'old',createdAt:'2026-11-14T10:00:00Z'};const records=[{id:'old',planId:'p',createdAt:attempt.createdAt},{id:'new',planId:'p',createdAt:attempt.createdAt},{id:'too-old',planId:'p',createdAt:'2026-11-01T10:00:00Z'}];assert.deepEqual(subscriptionRules.matchingCreatedPlans(attempt,records).map(s=>s.id),['new']);assert.equal(subscriptionRules.matchingCreatedPlans(attempt,[...records,{...records[1],id:'second'}]).length,2);});
test('one product-to-cart converter preserves variant stock, fulfillment and authentic missing images',()=>{const {cartItemFromProduct}=load('src/application/user/catalog/menuRules.ts');const p={id:'p',name:'Roti',categoryId:'r',chefId:'c',price:12,stockQuantity:8,isAvailable:true,fulfillmentMode:'inherit',image:null};const base=cartItemFromProduct(p,{id:'c',name:'Kitchen',fulfillmentMode:'preorder'},{id:'r',name:'Rotis'});assert.equal(base.effectiveMode,'preorder');assert.equal(base.image,null);const variant=cartItemFromProduct(p,{id:'c',name:'Kitchen'},{id:'r',name:'Rotis'},{variant:{id:'large',name:'Large',price:20,stockQuantity:2},quantity:2,offer:{promotionalPrice:1}});assert.equal(variant.key,'p:large');assert.equal(variant.price,20);assert.equal(variant.stockQuantity,2);assert.equal(variant.offer,null);});

test('order progress handles real chef/delivery states, completed alias and unknown statuses',()=>{const {orderStage,endedOrder}=load('src/application/user/orders/orderRules.ts');assert.ok(orderStage('accepted_by_chef')>orderStage('confirmed'));assert.ok(orderStage('accepted_by_delivery')>orderStage('prepared'));assert.equal(orderStage('completed'),orderStage('delivered'));assert.equal(orderStage('new_server_state'),-1);assert.equal(endedOrder('completed'),true);assert.equal(endedOrder('preparing'),false);});
test('provisional contact never unlocks orders and a different authenticated owner is rejected',()=>{const {orderForCustomer}=load('src/application/user/orders/orderRules.ts');const order={id:'o',userId:'owner-a',phone:'9876543210'};assert.equal(orderForCustomer(order,{id:'guest',phone:order.phone}),false);assert.equal(orderForCustomer(order,{id:'owner-b',phone:order.phone}),false);assert.equal(orderForCustomer(order,{id:'owner-a',phone:order.phone}),true);assert.equal(orderForCustomer({...order,userId:null},{id:'owner-a',phone:'+91 98765 43210'}),true);assert.equal(orderForCustomer({...order,userId:null},{id:'owner-a',phone:'9000000000'}),false);});
test('reorder rejects inactive vendors and vendors outside the selected serviceable area',async()=>{const source=mockRequest();await assert.rejects(()=>restoreCartItems({chefId:'c',items:[item]},async url=>url==='/api/chefs/c'?{id:'c',name:'Kitchen',isActive:false}:source(url)),/not accepting/);await assert.rejects(()=>restoreCartItems({chefId:'c',items:[item]},source,{serviceableChefIds:['another']}),/selected location/);});

test('ordinary checkout items never call the absent optional offer endpoint',async()=>{
 const {currentProductOffer}=load('src/application/user/cart/checkoutRules.ts');let calls=0;
 assert.equal(await currentProductOffer(async()=>{calls++;throw Error('Must not call');},{id:'regular'}),null);
 assert.equal(calls,0);
 const offer={promotionalPrice:80,maxDiscountedQuantity:2,isActive:true};
 assert.deepEqual(await currentProductOffer(async()=>{throw Error('Must not call');},{id:'inline',offer},offer),offer);
});
test('missing offer route removes stale promotion eligibility rather than bypassing current price checks',async()=>{
 const {currentProductOffer,validateFreshItem}=load('src/application/user/cart/checkoutRules.ts');
 const offer={promotionalPrice:80,maxDiscountedQuantity:2,isActive:true};
 const p={id:'p',name:'Dish',chefId:'c',categoryId:'cat',price:100,isAvailable:true,stockQuantity:10};
 const item={...p,key:'p:',quantity:1,offer};
 const fresh=await currentProductOffer(async()=>{throw Object.assign(Error('API endpoint not found'),{status:404});},p,offer);
 assert.equal(fresh,null);assert.throws(()=>validateFreshItem(item,p,fresh),/new price or offer/);
 await assert.rejects(()=>currentProductOffer(async()=>{throw Object.assign(Error('Service unavailable'),{status:503});},p,offer),/Service unavailable/);
});
