const fs=require('fs'),path=require('path'),cp=require('child_process');
const adb=path.join(process.env.LOCALAPPDATA,'Android/Sdk/platform-tools/adb.exe');
const out=path.resolve(process.env.ROTIHAI_REVIEW_OUTPUT||'review/screenshots/native');fs.mkdirSync(out,{recursive:true});const wait=ms=>new Promise(r=>setTimeout(r,ms));
const run=args=>cp.execFileSync(adb,process.env.ROTIHAI_REVIEW_PACKAGE&&args.includes('host.exp.exponent')?[...args.slice(0,-1),'-n',process.env.ROTIHAI_REVIEW_PACKAGE+'/.MainActivity']:args,{encoding:'utf8',timeout:60000,maxBuffer:20*1024*1024});
function decode(s){return s.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#10;/g,'\n');}
function observe(){for(let attempt=0;attempt<3;attempt++){const file='/sdcard/rotihai-interaction-'+Date.now()+'.xml';try{const result=run(['shell','uiautomator','dump',file]);if(!result.includes('dumped'))continue;const xml=run(['exec-out','cat',file]);if(xml.includes('<hierarchy')&&xml.includes(process.env.ROTIHAI_REVIEW_PACKAGE||'host.exp.exponent'))return xml;}catch(e){if(attempt===2)throw e;}}throw Error('Android accessibility hierarchy is not ready');}
function tap(xml,label,inputOnly=false){for(const tag of xml.match(/<node\b[^>]*>/g)||[]){if(inputOnly&&!tag.includes('class="android.widget.EditText"'))continue;const text=decode(tag.match(/text="([^"]*)"/)?.[1]||''),desc=decode(tag.match(/content-desc="([^"]*)"/)?.[1]||'');if(text===label||desc===label){const b=tag.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);if(b){run(['shell','input','tap',String((+b[1]+ +b[3])/2|0),String((+b[2]+ +b[4])/2|0)]);return;}}}throw Error('Visible control not found: '+label);}
function snap(name,xml=observe()){fs.writeFileSync(path.join(out,name+'.xml'),xml);fs.writeFileSync(path.join(out,name+'.png'),cp.execFileSync(adb,['exec-out','screencap','-p'],{maxBuffer:20*1024*1024}));console.log('Captured interaction '+name);}
async function open(screen){run(['shell','am','start','-a','android.intent.action.VIEW','-d',"'exp://127.0.0.1:8092/--/review?screen="+screen+"&__expo_disable_fab=1&reviewRun="+Date.now()+"'",'host.exp.exponent']);await wait(2300);let xml=observe();for(let i=0;i<8&&(!xml.includes('WRITES · '+screen)||(screen!=='Loading'&&(xml.includes('Loading nearby kitchens')||xml.includes('content-desc="Loading"'))));i++){await wait(1500);xml=observe();}if(!xml.includes('WRITES · '+screen))throw Error('Review screen not ready: '+screen);if(['Home','Explore','Catalog','ComboMenu','LargeMenu','NoKitchens','Offline','Loading'].includes(screen)){for(let n=0;n<8&&!xml.includes('2 items');n++){await wait(800);xml=observe();}if(!xml.includes('2 items'))throw Error('Review cart is not ready');}await wait(400);return observe();}
function swipe(){const matches=[...run(['shell','wm','size']).matchAll(/(?:Physical|Override) size: (\d+)x(\d+)/g)];const size=matches[matches.length-1];const width=Number(size?.[1]||1080),height=Number(size?.[2]||2400);run(['shell','input','swipe',String(Math.round(width*.55)),String(Math.round(height*.78)),String(Math.round(width*.55)),String(Math.round(height*.28)),'450']);}
async function findAfterScroll(label){let xml=observe();for(let i=0;i<7&&!decode(xml).includes(label);i++){swipe();await wait(450);xml=observe();}if(!decode(xml).includes(label))throw Error('Text not reachable: '+label);return xml;}
async function findInputAfterScroll(label){const visible=xml=>(xml.match(/<node\b[^>]*>/g)||[]).some(tag=>tag.includes('class="android.widget.EditText"')&&decode(tag.match(/content-desc="([^"]*)"/)?.[1]||'')===label);let xml=observe();for(let i=0;i<7&&!visible(xml);i++){swipe();await wait(450);xml=observe();}if(!visible(xml))throw Error('Input not reachable: '+label);return xml;}
(async()=>{

 if(process.argv.includes('--pincode-address')){
  let xml=await open('DeliveryArea');tap(xml,'Delivery pincode',true);run(['shell','input','keyevent','KEYCODE_MOVE_END']);for(let i=0;i<6;i++)run(['shell','input','keyevent','KEYCODE_DEL']);run(['shell','input','text','999999']);run(['shell','input','keyevent','4']);xml=observe();tap(xml,'Show kitchens in my area');await wait(700);xml=observe();if(!xml.includes("We're not here yet!"))throw Error('Unsupported pincode was not rejected');snap('UnsupportedPincode',xml);
  xml=await open('GuestAddress');if(xml.includes('Find on map')||xml.includes('Confirm delivery location'))throw Error('Map flow still present');if((xml.match(/<node\b[^>]*>/g)||[]).some(n=>n.includes('android.widget.EditText')&&n.includes('400070')))throw Error('Pincode is editable');snap('PincodeAddress',xml);
  for(const [label,value] of [['Flat / house / building','ReviewFlat12'],['Street / road','SampleRoad']]){xml=await findInputAfterScroll(label);swipe();await wait(400);xml=observe();tap(xml,label,true);run(['shell','input','text',value]);run(['shell','input','keyevent','4']);await wait(300);}
  xml=await findAfterScroll('Save & continue to checkout');snap('PincodeAddressFilled',xml);tap(xml,'Save & continue to checkout');await wait(1200);xml=observe();if(!xml.includes('Review order')){xml=await findAfterScroll('Review order');}if(!xml.includes('ReviewFlat12'))throw Error('Building was not carried into checkout');snap('PincodeAddressCheckout',xml);console.log('PASS unsupported pincode rejected; fixed pincode, separate building/street → checkout. No live writes.');return;
 }

 if(process.argv.includes('--accordion')){
  let xml=await open('Subscriptions');xml=await findAfterScroll('plan group');snap('PlanGroups',xml);
  const group=()=> (xml.match(/<node\b[^>]*>/g)||[]).find(n=>n.includes('content-desc=')&&n.includes('plan group'));
  const label=decode(group().match(/content-desc="([^"]+)"/)[1]);tap(xml,label);await wait(350);xml=observe();snap('PlanGroupCollapsed',xml);
  tap(xml,label);await wait(350);swipe();await wait(350);xml=observe();snap('PlanGroupExpanded',xml);
  if(!xml.includes('ROTIHAI'))throw Error('Plan cards did not expand');console.log('PASS subscription group collapse and expansion');return;
 }

 if(process.argv.includes('--footers')){
  for(const [screen,order,cart] of [['Home',true,true],['HomeOrderOnly',true,false],['HomeCartOnly',false,true],['HomeEmpty',false,false]]){
   const xml=await open(screen);const tracked=xml.includes('Track your active order'),basket=xml.includes('View cart, 2 items');
   if(tracked!==order||basket!==cart)throw Error('Incorrect footer state: '+screen);snap(screen+'Footer',xml);
  }
  console.log('PASS combined, active-order-only, cart-only and empty footer states.');return;
 }

 if(process.argv.includes('--premium')){
  const clickNode=(xml,part)=>{const tag=(xml.match(/<node\b[^>]*>/g)||[]).find(n=>n.includes('clickable="true"')&&decode(n).includes(part));if(!tag)throw Error('Action missing: '+part);const label=decode(tag.match(/content-desc="([^"]*)"/)?.[1]||tag.match(/text="([^"]*)"/)?.[1]||'');tap(tag,label);};
  let xml=await open('Home');snap('Home',xml);
  if(!xml.includes('Apno Ka Swaad')||!xml.includes('Track your active order')||!xml.includes('View cart, 2 items'))throw Error('Home hero or combined footer missing');
  clickNode(xml,'Track your active order');await wait(700);xml=observe();if(!xml.includes('YOUR ORDER'))throw Error('Track action did not open existing order screen');snap('HomeToTrack',xml);
  xml=await open('Home');clickNode(xml,'View cart, 2 items');await wait(600);xml=observe();if(!xml.includes('Cart'))throw Error('Cart route missing');snap('HomeToCart',xml);
  xml=await open('Home');xml=await findAfterScroll('View menu,');swipe();await wait(450);xml=observe();snap('FeaturedChefs',xml);clickNode(xml,'View menu,');await wait(700);xml=observe();if(!xml.includes('Menu'))throw Error('Featured chef did not open menu');snap('FeaturedToMenu',xml);
  xml=await open('Home');xml=await findAfterScroll('Nearby kitchens');swipe();await wait(400);xml=observe();snap('NearbyKitchens',xml);clickNode(xml,'View menu,');await wait(600);xml=observe();if(!xml.includes('Menu'))throw Error('Nearby kitchen did not open menu');
  xml=await open('Home');xml=await findAfterScroll('Invite friends.');snap('HomeReferral',xml);clickNode(xml,'Invite friends.');await wait(700);xml=observe();if(!xml.includes('Referrals'))throw Error('Invite did not open Referrals');snap('HomeToReferrals',xml);
  xml=await open('Home');xml=await findAfterScroll('Subscribe Now');snap('HomePlans',xml);clickNode(xml,'Subscribe Now');await wait(700);xml=observe();if(!xml.includes('Your meal routine'))throw Error('View plans did not open existing Subscriptions');snap('Subscriptions',xml);
  xml=await findAfterScroll('Choose this plan');snap('SubscriptionCards',xml);clickNode(xml,'Choose this plan');await wait(700);xml=observe();if(!xml.includes('YOUR NEXT ROUTINE'))throw Error('Plan selection did not open Subscribe');snap('PlanSelection',xml);
  xml=await open('Subscriptions');clickNode(xml,'My subscriptions');await wait(400);xml=observe();xml=await findAfterScroll('Manage subscription');snap('MySubscriptions',xml);clickNode(xml,'Manage subscription');await wait(700);xml=observe();if(!xml.includes('deliveries remaining'))throw Error('Manage subscription did not load');snap('SubscriptionDetails',xml);
  console.log('PASS Home → featured/nearby menus, combined footer → tracking/cart, Invite → Referrals, View plans → Subscriptions → plan selection, My subscriptions → details. Read-only fixtures; no live writes.');return;
 }

 if(process.argv.includes('--payment-checkbox')){
  let xml=await open('Payment');
  const button=x=>(x.match(/<node\b[^>]*>/g)||[]).find(tag=>tag.includes('content-desc="Complete payment"'));
  if(!button(xml)?.includes('enabled="false"'))throw Error('Complete payment must start disabled');
  const check=(xml.match(/<node\b[^>]*>/g)||[]).find(tag=>tag.includes('checkable="true"'));
  if(!check||!check.includes('checked="false"'))throw Error('Payment checkbox must start unchecked');
  const label=decode(check.match(/content-desc="([^"]*)"/)?.[1]||check.match(/text="([^"]*)"/)?.[1]||'');
  tap(xml,label);await wait(500);xml=observe();
  if(!button(xml)?.includes('enabled="true"'))throw Error('Checking payment did not enable completion');
  snap('PaymentChecked',xml);
  tap(button(xml),'Complete payment');await wait(1000);xml=await findAfterScroll('UI review is read-only');
  if(!xml.includes('Complete payment'))throw Error('Failed confirmation unexpectedly left payment');
  snap('PaymentConfirmationBlocked',xml);
  xml=await open('Payment');if(!button(xml)?.includes('enabled="false"'))throw Error('Checkbox was restored checked');
  snap('Payment',xml);
  xml=await open('Home');xml=await findAfterScroll('Track order');if(!xml.includes('WRITES · Home')||!xml.includes('YOUR ORDER'))throw Error('Home active-order banner missing');snap('HomeActiveOrder',xml);
  console.log('PASS payment unchecked → checked → completion rejected safely → reopened unchecked; Home banner visible. No live writes.');return;
 }

 if(process.argv.includes('--saved-phone')){
  console.log('Checking guest checkout reaches read-only order submission without phone entry or OTP.');
  let xml=await open('GuestCheckout');
  if(!xml.includes('9000000000')||xml.includes('10-digit mobile number'))throw Error('Checkout did not reuse the saved contact');
  snap('GuestCheckoutSavedContact',xml);
  const title=(decode(xml).match(/content-desc="(Place order · [^"]+)"/)||[])[1];
  if(!title)throw Error('Place order action is not visible');
  tap(xml,title);await wait(1200);
  xml=await findAfterScroll('UI review is read-only');
  if(xml.includes('Verification code')||xml.includes('10-digit mobile number')||!xml.includes('WRITES · GuestCheckout'))throw Error('Checkout unexpectedly requested account verification');
  snap('GuestCheckoutOrderSubmission',xml);
  console.log('PASS saved-number guest checkout reached POST /api/orders without phone entry/OTP. Review transport blocked the write; no live order, account, SMS or payment was created.');return;
 }
 if(process.argv.includes('--guest-checkout')){
  console.log('Checking guest basket → address → checkout');
  let xml=await open('GuestCart');xml=await findAfterScroll('Review delivery & bill');tap(xml,'Review delivery & bill');await wait(900);xml=observe();
  if(xml.includes('Sign in with mobile')||!xml.includes('Delivery location'))throw Error('Basket did not open address directly');
  snap('GuestCartToAddress',xml);
  xml=await findAfterScroll('Confirm this pin');tap(xml,'Confirm this pin');
  for(const [label,value] of [['Flat / house / building','ReviewFlat12'],['Street','SampleRoad']]){xml=await findInputAfterScroll(label);tap(xml,label,true);run(['shell','input','text',value]);run(['shell','input','keyevent','4']);await wait(300);}
  xml=await findAfterScroll('Save address & continue');tap(xml,'Save address & continue');await wait(1500);xml=observe();
  for(let i=0;i<6&&!xml.includes('Fresh food, almost home.');i++){await wait(700);xml=observe();}
  if(!xml.includes('Fresh food, almost home.')||xml.includes('Sign in with mobile'))throw Error('Address did not continue to checkout');
  if(!xml.includes('9000000000'))throw Error('Saved contact missing in checkout');
  snap('GuestAddressSavedCheckout',xml);xml=await findAfterScroll('Verify & place order');snap('GuestCheckoutBill',xml);
  console.log('PASS guest basket → address → checkout reuses saved contact without login; no order/OTP action was pressed');return;
 }

 let xml=await open('ComboMenu');tap(xml,'Browse menu sections');await wait(400);xml=observe();snap('MenuSections',xml);tap(xml,'Combo Deals');await wait(650);xml=observe();if(!xml.includes('Combo Deals'))throw Error('Combo section not selected');snap('MenuComboSelected',xml);
 tap(xml,'Browse menu sections');await wait(400);run(['shell','input','keyevent','4']);await wait(400);xml=observe();if(xml.includes("What's on the menu?"))throw Error('Android Back did not dismiss menu sheet');console.log('PASS Android Back dismisses menu sheet');
 xml=await open('Home');tap(xml,'Home Meals');await wait(600);xml=await findAfterScroll('Chef Sia RotiHai');if(!xml.includes('Currently unavailable'))throw Error('Inactive category kitchen missing its status');snap('HomeMealsInactive',xml);console.log('PASS category retains inactive kitchen with availability status');
 for(const [screen,label]of [['NoKitchens','No kitchens are delivering'],['Offline','offline'],['Loading','Loading nearby kitchens']]){await open(screen);xml=await findAfterScroll(label);snap(screen+'State',xml);}
 await open('Checkout');swipe();await wait(450);swipe();await wait(450);snap('CheckoutBill');
 await open('Catalog');swipe();await wait(450);snap('MenuDishes');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
