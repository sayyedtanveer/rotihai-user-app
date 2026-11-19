const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const values=new Map();let online=true;
const storage={getItem:async k=>values.get(k)||null,setItem:async(k,v)=>values.set(k,v),removeItem:async k=>values.delete(k)};
const mocks={'@react-native-async-storage/async-storage':{__esModule:true,default:storage},'expo-secure-store':{getItemAsync:storage.getItem,setItemAsync:storage.setItem,deleteItemAsync:storage.removeItem},'expo-network':{getNetworkStateAsync:async()=>({isConnected:online,isInternetReachable:online}),addNetworkStateListener:()=>({remove(){}})}};
const modules=new Map();
function load(relative){const f=path.resolve(__dirname,'..',relative);if(modules.has(f))return modules.get(f).exports;const m={exports:{}};modules.set(f,m);const code=ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','module','exports',code)(n=>mocks[n]||(n.startsWith('.')?load(path.relative(path.resolve(__dirname,'..'),path.resolve(path.dirname(f),n+'.ts'))):require(n)),m,m.exports);return m.exports;}
const entry=load('src/application/user/auth/entryRules.ts'),rules=load('src/application/user/payments/paymentRules.ts'),{launchSavedPayment}=load('src/application/user/payments/launchSavedPayment.ts');
const {pendingPayment}=load('src/core/storage/pendingPayment.ts'),cache=load('src/core/api/offlineCache.ts'),{customerApi}=load('src/core/api/customerApi.ts');
const payment={id:'order-original',kind:'order',amount:120,phase:'ready',createdAt:'2026-11-14T10:00:00Z'};
test('first contact enters Home without turning a phone number into a session',()=>{assert.equal(entry.normalizeProvisionalPhone('+91 98765 43210'),'9876543210');assert.throws(()=>entry.normalizeProvisionalPhone('123'));assert.equal(entry.initialCustomerStep(false,null),'phone');assert.equal(entry.initialCustomerStep(false,'9876543210'),'home');assert.equal(entry.initialCustomerStep(true,null),'home');});
test('configured web UPI URI preserves manual amount protocol and validates payee',()=>{const uri=rules.buildWebUpiUri({upiId:'merchant@bank'});assert.equal(uri,'upi://pay?pa=merchant%40bank&cu=INR');assert.equal(rules.paymentAppUri(uri,'android','gpay'),'tez://pay?pa=merchant%40bank&cu=INR');assert.equal(rules.paymentAppUri(uri,'ios','gpay'),'gpay://upi/pay?pa=merchant%40bank&cu=INR');assert.throws(()=>rules.buildWebUpiUri({upiId:''}));for(const v of [0,-1,NaN,Infinity,undefined])assert.throws(()=>rules.validatePayableAmount(v));});
test('payment is saved before handoff and a successful launcher response cannot declare paid',async()=>{const events=[];const result=await launchSavedPayment(payment,{save:async p=>events.push(['save',p.phase,p.id]),markInitiated:async()=>events.push(['notify']),open:async()=>{events.push(['open']);return {Status:'SUCCESS'};}});assert.deepEqual(events,[['save','launching','order-original'],['notify'],['open']]);assert.equal(result.phase,'launching');assert.equal(rules.backendPaymentRecorded(result.phase),false);});
test('failed handoff retains the same order with a recoverable failure phase',async()=>{const saved=[];await assert.rejects(()=>launchSavedPayment(payment,{save:async p=>saved.push(p),markInitiated:async()=>{},open:async()=>{throw Error('App unavailable');}}),/App unavailable/);assert.deepEqual(saved.map(p=>[p.id,p.phase]),[['order-original','launching'],['order-original','launch_failed']]);});
test('failed persistence never notifies or launches a payment app',async()=>{let touched=false;await assert.rejects(()=>launchSavedPayment(payment,{save:async()=>{throw Error('Storage full');},markInitiated:async()=>{touched=true;},open:async()=>{touched=true;}}));assert.equal(touched,false);});
test('pending payment survives storage reload and stays isolated per account',async()=>{await pendingPayment.save('owner-a',{...payment,phase:'reported',reference:'SAMPLE-REF'});assert.deepEqual(await pendingPayment.read('owner-a'),{...payment,phase:'reported',reference:'SAMPLE-REF'});assert.equal(await pendingPayment.read('owner-b'),null);await pendingPayment.clear('owner-a');assert.equal(await pendingPayment.read('owner-a'),null);});
test('a locally reported transfer remains awaiting confirmation and cannot clear a changed basket',()=>{assert.match(rules.paymentStatusLabel('pending',true),/awaiting confirmation/);assert.equal(rules.backendPaymentRecorded('reported'),false);const items=[{id:'p',quantity:1}];const p={...payment,cartSignature:rules.cartSignature(items)};assert.equal(rules.canClearPaidBasket(p,items),true);assert.equal(rules.canClearPaidBasket(p,[{id:'p',quantity:2}]),false);});
test('private offline data is bound to the authenticated token and never to provisional contact',async()=>{await cache.cacheResponse('/api/user/profile',{id:'owner-a',name:'A'},'owner-a');await cache.bindCachedProfile('token-a','owner-a');assert.equal((await cache.cachedProfile('token-a')).id,'owner-a');assert.equal(await cache.cachedProfile('token-b'),null);assert.equal(await cache.cachedResponse('/api/user/profile'),null);await cache.forgetCachedProfile();assert.equal(await cache.cachedProfile('token-a'),null);});
test('offline catalog reads use snapshots while order mutations and fresh financial reads never fetch',async()=>{const oldFetch=global.fetch,oldBase=process.env.EXPO_PUBLIC_API_BASE_URL;let calls=0;global.fetch=async()=>{calls++;throw Error('Must not fetch');};process.env.EXPO_PUBLIC_API_BASE_URL='https://api.test.invalid';online=false;try{await cache.cacheResponse('/api/products',[{id:'cached-dish'}]);assert.deepEqual(await customerApi('/api/products'),[{id:'cached-dish'}]);await assert.rejects(()=>customerApi('/api/orders',{items:[]}),/offline/);await assert.rejects(()=>customerApi('/api/products',undefined,undefined,'GET',{'X-RotiHai-Require-Fresh':'1'}),/offline/);assert.equal(calls,0);}finally{online=true;global.fetch=oldFetch;process.env.EXPO_PUBLIC_API_BASE_URL=oldBase;}});
test('authentication rejection never falls back to cached private account data',async()=>{const oldFetch=global.fetch,oldBase=process.env.EXPO_PUBLIC_API_BASE_URL;process.env.EXPO_PUBLIC_API_BASE_URL='https://api.test.invalid';await cache.cacheResponse('/api/user/profile',{id:'owner-a'},'owner-a');await cache.bindCachedProfile('token-a','owner-a');global.fetch=async()=>({ok:false,status:401,text:async()=>JSON.stringify({message:'Expired session'})});try{await assert.rejects(()=>customerApi('/api/user/profile',undefined,'token-a'),/Expired session/);}finally{global.fetch=oldFetch;process.env.EXPO_PUBLIC_API_BASE_URL=oldBase;}});

const {basketDestination}=load('src/application/user/cart/checkoutJourney.ts'),checkoutState=load('src/core/storage/checkoutState.ts');
const delivery={latitude:19.07,longitude:72.88,building:'Sample Flat',street:'Sample Road',area:'Kurla',city:'Mumbai',pincode:'400070'};
test('basket opens address first and then checkout without a login destination',()=>{assert.deepEqual(basketDestination('c:r',null),{name:'Address',params:{checkoutCartKey:'c:r'}});assert.equal(basketDestination('c:r',{...delivery,building:''}).name,'Address');assert.deepEqual(basketDestination('c:r',delivery),{name:'Checkout',params:{cartKey:'c:r'}});});
test('guest address and checkout draft transfer to the verified owner without granting private account access',async()=>{const privateStore=load('src/core/storage/privateJson.ts');await checkoutState.checkoutAddress.save('guest',delivery);await privateStore.writePrivateJson(checkoutState.checkoutDraftKey('guest','c:r'),{instructions:'Less spicy',slotId:'s'});await checkoutState.migrateGuestCheckout('verified-owner','c:r');assert.deepEqual(await checkoutState.checkoutAddress.read('verified-owner'),delivery);assert.deepEqual(await privateStore.readPrivateJson(checkoutState.checkoutDraftKey('verified-owner','c:r')),{instructions:'Less spicy',slotId:'s'});assert.equal(await checkoutState.checkoutAddress.read('guest'),null);assert.equal(await checkoutState.checkoutAddress.read('other-owner'),null);});

test('authentication return creates one Tabs route and preserves checkout destinations',()=>{const {resumedNavigationState}=load('src/application/user/auth/entryRules.ts');assert.deepEqual(resumedNavigationState({name:'Tabs',params:{screen:'Account'}}),{index:0,routes:[{name:'Tabs',params:{screen:'Account'}}]});const restored=resumedNavigationState({name:'Checkout',params:{cartKey:'c:r'}});assert.deepEqual(restored.routes.map(r=>r.name),['Tabs','Checkout']);assert.equal(restored.routes[1].params.cartKey,'c:r');assert.equal(resumedNavigationState(),undefined);});
test('subscription enrollment draft survives verification without a second address or slot selection',async()=>{const state=load('src/core/storage/checkoutState.ts'),privateStore=load('src/core/storage/privateJson.ts');await privateStore.writePrivateJson(state.subscriptionDraftKey('guest','plan'),{slot:'evening'});await state.migrateGuestSubscription('verified-owner','plan');assert.deepEqual(await privateStore.readPrivateJson(state.subscriptionDraftKey('verified-owner','plan')),{slot:'evening'});assert.equal(await privateStore.readPrivateJson(state.subscriptionDraftKey('guest','plan')),null);});
test('uncertain subscription creation is retained per owner until explicit reconciliation',async()=>{const {subscriptionCreationAttempt}=load('src/core/storage/pendingPayment.ts');const attempt={kind:'custom',createdAt:'2026-11-14T10:00:00Z',rotiPerDay:5,duration:'weekly',deliverySlotId:'s'};await subscriptionCreationAttempt.save('account-a',attempt);assert.deepEqual(await subscriptionCreationAttempt.read('account-a'),attempt);assert.equal(await subscriptionCreationAttempt.read('account-b'),null);await subscriptionCreationAttempt.clear('account-a');assert.equal(await subscriptionCreationAttempt.read('account-a'),null);});
test('only subscription reference reporting has a safe manual-review endpoint',()=>{const {manualReferenceEndpoint}=load('src/application/user/payments/paymentRules.ts');assert.equal(manualReferenceEndpoint('order','o'),null);assert.equal(manualReferenceEndpoint('subscription','sub/id'),'/api/subscriptions/sub%2Fid/payment-confirmed');});
test('online cache fallback is labelled saved and a fresh public response clears the marker',async()=>{const oldFetch=global.fetch,oldBase=process.env.EXPO_PUBLIC_API_BASE_URL;process.env.EXPO_PUBLIC_API_BASE_URL='https://api.test.invalid';try{await cache.cacheResponse('/api/promotional-banners',[{id:'old'}]);global.fetch=async()=>{throw Error('Temporary service failure');};assert.deepEqual(await customerApi('/api/promotional-banners'),[{id:'old'}]);assert.equal(cache.isCachedDelivery('/api/promotional-banners'),true);global.fetch=async()=>({ok:true,status:200,text:async()=>JSON.stringify([{id:'updated'}])});assert.deepEqual(await customerApi('/api/promotional-banners'),[{id:'updated'}]);assert.equal(cache.isCachedDelivery('/api/promotional-banners'),false);}finally{global.fetch=oldFetch;process.env.EXPO_PUBLIC_API_BASE_URL=oldBase;}});

test('checkout verification recovers the startup number after navigation state is lost',async()=>{
 const contact=load('src/core/storage/provisionalContact.ts').provisionalContact;
 await contact.save('9876543210');
 assert.equal(await entry.verificationContact(['',undefined],()=>contact.read()),'9876543210');
 assert.equal(await entry.verificationContact(['invalid','+91 91234 56789'],()=>contact.read()),'9123456789');
 let reads=0;assert.equal(await entry.verificationContact(['9876543210'],async()=>{reads++;return null;}),'9876543210');assert.equal(reads,0);
 await contact.clear();assert.equal(await entry.verificationContact([''],()=>contact.read()),null);
 assert.deepEqual(entry.resumedNavigationState({name:'Checkout',params:{cartKey:'chef:category'}}).routes[1],{name:'Checkout',params:{cartKey:'chef:category'}});
});

test('guest payment access requires a receipt for the exact newly created order',()=>{
 const order={id:'created-order',phone:'9876543210'};
 const receipt={...payment,id:order.id,guestReceipt:rules.receiptForCreatedOrder(order,'+91 98765 43210')};
 assert.equal(rules.ownsGuestOrder(receipt,order.id,'order'),true);
 assert.equal(rules.guestReceiptMatches(order,receipt),true);
 assert.equal(rules.ownsGuestOrder(receipt,'another-order','order'),false);
 assert.equal(rules.ownsGuestOrder(receipt,order.id,'subscription'),false);
 assert.equal(rules.ownsGuestOrder({...receipt,kind:'subscription'},order.id,'order'),false);
 assert.equal(rules.ownsGuestOrder({...receipt,guestReceipt:undefined},order.id),false);
 assert.equal(rules.guestReceiptMatches({...order,phone:'9123456789'},receipt),false);
 assert.equal(rules.guestReceiptMatches(order,null),false);
 assert.throws(()=>rules.receiptForCreatedOrder({...order,phone:'9123456789'},order.phone));
});
test('public guest order response never becomes an existing-account session',async()=>{
 const oldFetch=global.fetch,oldBase=process.env.EXPO_PUBLIC_API_BASE_URL;
 const calls=[];process.env.EXPO_PUBLIC_API_BASE_URL='https://api.test.invalid';
 global.fetch=async(url,options)=>{calls.push({url,options});return {ok:true,status:201,text:async()=>JSON.stringify({id:'new-guest-order',phone:'9876543210',total:120,accessToken:'IGNORED_ACCOUNT_TOKEN',defaultPassword:'IGNORED_PASSWORD'})};};
 try{
  const created=await customerApi('/api/orders',{phone:'9876543210',items:[{id:'dish',quantity:1}],walletAmountUsed:0,bonusUsedAtCheckout:0});
  const guestReceipt=rules.receiptForCreatedOrder(created,'9876543210');
  assert.deepEqual(guestReceipt,{phone:'9876543210'});
  await pendingPayment.save('guest',{...payment,id:created.id,guestReceipt});
  assert.equal(rules.ownsGuestOrder(await pendingPayment.read('guest'),created.id),true);
  assert.equal(calls.length,1);assert.equal(calls[0].url,'https://api.test.invalid/api/orders');
  assert.equal(calls[0].options.headers.Authorization,undefined);
  assert.equal(await storage.getItem('rotihai.customer.access-token'),null);
  assert.equal(JSON.stringify(await pendingPayment.read('guest')).includes('IGNORED'),false);
 }finally{await pendingPayment.clear('guest');global.fetch=oldFetch;process.env.EXPO_PUBLIC_API_BASE_URL=oldBase;}
});

test('customer recognition returns only normalized phone and existence, never login credentials',async()=>{
 const result=await entry.recognizeCustomer('+91 98765 43210',async phone=>{assert.equal(phone,'9876543210');return {exists:true,accessToken:'must-ignore',name:'Private name',address:'Private address'};});
 assert.deepEqual(result,{phone:'9876543210',exists:true});
 await assert.rejects(()=>entry.recognizeCustomer('invalid',async()=>({exists:true})));
 await assert.rejects(()=>entry.recognizeCustomer('9876543210',async()=>({})),/unavailable/);
});
test('local contact name survives restart and is not transferred to a different phone',async()=>{
 const {provisionalContact}=load('src/core/storage/provisionalContact.ts');
 await provisionalContact.save('9876543210',' Local Name ');
 assert.equal(await provisionalContact.readName(),'Local Name');
 await provisionalContact.save('9876543210');
 assert.equal(await provisionalContact.readName(),'Local Name');
 await provisionalContact.save('9876543211');
 assert.equal(await provisionalContact.readName(),'');
 assert.equal(await provisionalContact.read(),'9876543211');
});
test('active-order banner hides terminal, unknown, future and expired unpaid orders',()=>{
 const {activeOrderVisible}=load('src/application/user/orders/orderRules.ts'),now=new Date('2026-11-15T08:00:00Z');
 for(const status of ['delivered','completed','cancelled','rejected','expired','unknown'])assert.equal(activeOrderVisible({status,paymentStatus:'paid'},now),false);
 assert.equal(activeOrderVisible({status:'preparing',paymentStatus:'paid'},now),true);
 assert.equal(activeOrderVisible({status:'pending',paymentStatus:'pending',expiresAt:'2026-11-14T10:00:00Z'},now),false);
 assert.equal(activeOrderVisible({status:'confirmed',paymentStatus:'paid',deliveryDate:'2026-11-16'},now),false);
 assert.equal(activeOrderVisible({status:'confirmed',paymentStatus:'paid',deliveryDate:'2026-11-14',deliverySlotId:'preorder-lunch'},now),false);
});

test('payment checkbox is required before any confirmation read or mutation',async()=>{
 let touched=false;await assert.rejects(()=>rules.confirmDeclaredOrder('one',100,false,{read:async()=>{touched=true;},submit:async()=>{touched=true;}}),/Confirm/);assert.equal(touched,false);
});
test('payment declaration requires backend confirmation and never returns response credentials',async()=>{
 const order={id:'one',total:100,status:'pending',paymentStatus:'pending'};let reads=0,submits=0;
 const confirmed=await rules.confirmDeclaredOrder('one',100,true,{read:async()=>({...order,paymentStatus:++reads===1?'pending':'paid'}),submit:async()=>{submits++;return {accessToken:'ignore'};}});
 assert.equal(confirmed.paymentStatus,'paid');assert.equal(confirmed.accessToken,undefined);assert.equal(submits,1);
 await rules.confirmDeclaredOrder('one',100,true,{read:async()=>confirmed,submit:async()=>{submits++;}});assert.equal(submits,1);
});
test('failed or unconfirmed payment stays on the existing order and changed totals cannot submit',async()=>{
 const order={id:'one',total:100,status:'pending',paymentStatus:'pending'};
 await assert.rejects(()=>rules.confirmDeclaredOrder('one',100,true,{read:async()=>order,submit:async()=>{throw Error('Offline');}}),/Offline/);
 await assert.rejects(()=>rules.confirmDeclaredOrder('one',100,true,{read:async()=>order,submit:async()=>({success:true})}),/still being processed/);
 let submitted=false;await assert.rejects(()=>rules.confirmDeclaredOrder('one',90,true,{read:async()=>order,submit:async()=>{submitted=true;}}),/total changed/);assert.equal(submitted,false);
});

test('active banner matches web payment overrides and kitchen status',()=>{const {activeOrderPresentation:p}=load('src/application/user/orders/orderRules.ts');assert.equal(p('pending','pending').paymentPending,true);assert.match(p('pending','pending').label,/Waiting for payment/);assert.match(p('pending','paid').label,/admin confirmation/);assert.equal(p('preparing','paid').label,'Chef is preparing your food');assert.equal(p('out_for_delivery','paid').paymentPending,false);});

test('MVP database session loads profile using server-issued token, never local profile',async()=>{
 const calls=[];const user={id:'db-customer',name:'Database Name',phone:'9876543210'};
 const session=await entry.databaseCustomerSession('+91 98765 43210','Entered Name',async(path,body,token,method,headers)=>{
  calls.push({path,body,token,method,headers});
  return path.endsWith('login-or-create')?{accessToken:'server-issued-test-token',user}:{...user,address:'Database address'};
 });
 assert.equal(session.user.name,'Database Name');assert.equal(session.user.address,'Database address');
 assert.equal(calls[0].body.phone,'9876543210');assert.equal(calls[1].token,'server-issued-test-token');
 assert.equal(calls[1].headers['X-RotiHai-Require-Fresh'],'1');
});
test('MVP database session rejects missing token, mismatched customer and unavailable server',async()=>{
 const user={id:'db-customer',name:'Name',phone:'9876543210'};
 await assert.rejects(()=>entry.databaseCustomerSession(user.phone,undefined,async()=>({user})),/unexpected/);
 await assert.rejects(()=>entry.databaseCustomerSession(user.phone,undefined,async path=>path.endsWith('login-or-create')?{user,accessToken:'test'}:{...user,id:'other-customer'}),/does not match/);
 await assert.rejects(()=>entry.databaseCustomerSession(user.phone,undefined,async()=>{throw Error('Server unavailable');}),/Server unavailable/);
});

test('explicit logout removes saved contact and guest receipt so prior orders cannot reappear',async()=>{
 const {customerSession}=load('src/core/storage/customerSession.ts'),{provisionalContact}=load('src/core/storage/provisionalContact.ts');
 const {deliveryAreaSelection}=load('src/core/storage/deliveryAreaSelection.ts');await deliveryAreaSelection.save({pincode:'400070',area:'Kurla West',latitude:19.07,longitude:72.88,source:'pincode'});
 await customerSession.save('logout-test-token');await provisionalContact.save('9876543210','Test customer');
 await pendingPayment.save('guest',{...payment,guestReceipt:{phone:'9876543210'}});
 await checkoutState.checkoutAddress.save('guest',delivery);
 await cache.cacheResponse('/api/user/profile',{id:'logout-owner',name:'Test customer'},'logout-owner');
 await cache.bindCachedProfile('logout-test-token','logout-owner');
 await customerSession.clear();
 assert.equal(await customerSession.read(),null);assert.equal(await provisionalContact.read(),null);
 assert.equal(await pendingPayment.read('guest'),null);assert.equal(await checkoutState.checkoutAddress.read('guest'),null);
 assert.equal(await cache.cachedProfile('logout-test-token'),null);assert.equal(await deliveryAreaSelection.read(),null);
});

const enrollment=load('src/application/user/subscriptions/subscriptionRules.ts');
test('subscription server rejection releases the attempt and permits a corrected submission',async()=>{
 const {subscriptionCreationAttempt:attempt}=load('src/core/storage/pendingPayment.ts');
 for(const status of [400,401,403,404,409,422,429]){
  await attempt.save('enrollment-owner',{kind:'plan',planId:'p',createdAt:new Date().toISOString()});
  const rejection=Object.assign(new Error('Rejected'),{status});
  await assert.rejects(enrollment.submitSubscriptionRequest(async()=>{throw rejection;},()=>attempt.clear('enrollment-owner')),e=>e===rejection);
  assert.equal(await attempt.read('enrollment-owner'),null);
 }
});
test('subscription uncertain responses retain recovery and cannot silently allow a second purchase',async()=>{
 const {subscriptionCreationAttempt:attempt}=load('src/core/storage/pendingPayment.ts');
 for(const status of [undefined,200,201,408,500,502,503]){
  await attempt.save('uncertain-owner',{kind:'plan',planId:'p',createdAt:new Date().toISOString()});
  await assert.rejects(enrollment.submitSubscriptionRequest(async()=>{throw Object.assign(new Error('Uncertain'),{status});},()=>attempt.clear('uncertain-owner')));
  assert.equal((await attempt.read('uncertain-owner')).planId,'p');
 }
});
test('flat created subscription uses authoritative total and retains recovery until pending payment is saved',async()=>{
 const {subscriptionCreationAttempt:attempt}=load('src/core/storage/pendingPayment.ts');
 const record={id:'sub-created',planId:'p',finalAmount:'840',price:999,status:'pending',isPaid:false};
 await attempt.save('success-owner',{kind:'plan',planId:'p',createdAt:new Date().toISOString()});
 const created=await enrollment.submitSubscriptionRequest(async()=>record,()=>attempt.clear('success-owner'));
 assert.equal(created.id,'sub-created');assert.equal(enrollment.subscriptionPayable(created),840);
 assert.ok(await attempt.read('success-owner'));
 await pendingPayment.save('success-owner',{id:created.id,kind:'subscription',amount:enrollment.subscriptionPayable(created),phase:'ready',createdAt:new Date().toISOString()});
 await attempt.clear('success-owner');
 assert.equal((await pendingPayment.read('success-owner')).amount,840);assert.equal(await attempt.read('success-owner'),null);
});
test('missing or invalid created subscription totals never fall back to an advertised plan price',()=>{
 for(const amount of [undefined,null,'',0,-1,'not-a-price',Infinity])assert.throws(()=>enrollment.subscriptionPayable({id:'sub',finalAmount:amount}));
 assert.equal(enrollment.subscriptionPayable({finalAmount:undefined,totalAmount:'100'}),100);
});

test('new customer and explicit logout require pincode before contact; valid returning session preserves Home',()=>{
 assert.equal(entry.customerEntryScreen('restore',false,false),'restore');
 assert.equal(entry.customerEntryScreen('phone',true,false),'location');
 assert.equal(entry.customerEntryScreen('phone',true,true),'phone');
 assert.equal(entry.customerEntryScreen('home',true,true),'home');
 assert.equal(entry.customerEntryScreen('home',true,false),'location');
 assert.equal(entry.customerEntryScreen('otp',true,true),'otp');
 assert.equal(entry.customerEntryScreen('name',true,true),'name');
});
