const fs=require('fs'),path=require('path'),cp=require('child_process');
const adb=path.join(process.env.LOCALAPPDATA,'Android/Sdk/platform-tools/adb.exe');
const out=path.resolve('review/screenshots/native');const wait=ms=>new Promise(r=>setTimeout(r,ms));
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
