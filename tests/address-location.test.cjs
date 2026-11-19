const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
function load(file,mocks={}){const m={exports:{}};const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','module','exports',code)(name=>mocks[name]||require(name),m,m.exports);return m.exports;}
const rules=load('src/core/location/addressRules.ts'),cart=load('src/application/user/cart/cartRules.ts');
const address={building:'Fixture House',street:'Fixture Road',area:'Kurla West',city:'Mumbai',pincode:'400070',landmark:'Gate',latitude:19.07,longitude:72.88,locationConfirmed:true,locationSource:'customer_pin',locationPrecision:'customer_selected'};
test('confirmed saved location reopens from individual fields, ahead of legacy text',()=>{
 const user={...Object.fromEntries(['building','street','area','city','pincode','landmark'].map(k=>['address'+k[0].toUpperCase()+k.slice(1),address[k]])),address:'Old text',latitude:19.07,longitude:72.88,locationConfirmed:true,locationPrecision:'customer_selected'};
 const saved=cart.readAddress(user);assert.equal(saved.street,address.street);assert.equal(saved.locationConfirmed,true);assert.equal(saved.locationPrecision,'customer_selected');assert.equal(rules.reusableAddress(saved,rules.addressIdentity(address),'400070'),saved);
});
test('material address edits invalidate reuse; landmark and instructions preserve the same pin',()=>{
 const identity=rules.addressIdentity(address);assert.equal(rules.reusableAddress(address,identity,'400070'),address);
 assert.equal(rules.addressIdentity({...address,landmark:'Fourth floor'}),identity);
 for(const key of ['building','street','area','city','pincode'])assert.equal(rules.reusableAddress(address,rules.addressIdentity({...address,[key]:'changed'}),'400070'),null);
 assert.equal(rules.reusableAddress(address,identity,'400071'),null);
 assert.equal(rules.reusableAddress({...address,latitude:NaN},identity,'400070'),null);
});
test('legacy saved coordinates remain usable without pretending that they are confirmed',()=>{
 const saved=cart.readAddress({latitude:19.07,longitude:72.88,address:JSON.stringify(address)});assert.equal(saved.locationConfirmed,false);assert.equal(saved.locationPrecision,'legacy');assert.equal(rules.reusableAddress(saved,rules.addressIdentity(address),'400070'),saved);
});
test('mobile accepts pincode estimate only as a suggestion for the confirmation screen',async()=>{
 let calls=0;const api={customerApi:async()=>{calls++;return {success:true,latitude:19.07,longitude:72.88,accuracy:'pincode'};}};
 const location=load('src/core/location/customerLocation.ts',{'expo-location':{},'../api/customerApi':api});
 const result=await location.searchDeliveryAddress('Fixture 400070',address);assert.equal(result.precision,'pincode');assert.equal(result.latitude,19.07);assert.equal(result.locationConfirmed,undefined);assert.equal(calls,1);
});
test('mobile rejects unavailable and out-of-range provider coordinates',async()=>{
 for(const result of [{success:false,latitude:19,longitude:72},{success:true,latitude:91,longitude:72}]){
 const location=load('src/core/location/customerLocation.ts',{'expo-location':{},'../api/customerApi':{customerApi:async()=>result}});await assert.rejects(location.searchDeliveryAddress('Fixture 400070',address),/not found/);
 }
});

test('mobile retains rooftop precision without silently confirming the location',async()=>{
 const location=load('src/core/location/customerLocation.ts',{'expo-location':{},'../api/customerApi':{customerApi:async()=>({success:true,latitude:19.07,longitude:72.88,accuracy:'exact',precision:'rooftop',source:'google'})}});
 const result=await location.searchDeliveryAddress('Fixture 400070',address);assert.equal(result.precision,'rooftop');assert.equal(result.locationSource,'google');assert.equal(result.locationConfirmed,undefined);
});

test('required address fields identify missing building, street and area before geocoding',()=>{
 assert.deepEqual(rules.addressFieldErrors({building:' ',street:'',area:''}),{building:'Enter your flat, house number or building.',street:'Enter your street or road name.',area:'Choose your delivery area.'});
 assert.ok(Object.values(rules.addressFieldErrors(address)).every(v=>!v));
});
test('save acknowledgement refuses a single-column-only response and accepts persisted individual fields',()=>{
 const profile={id:'owner',latitude:19.07,longitude:72.88,locationConfirmed:true,...Object.fromEntries(['building','street','area','city','pincode','landmark'].map(k=>['address'+k[0].toUpperCase()+k.slice(1),address[k]]))};
 assert.doesNotThrow(()=>rules.assertAddressSaved(profile,address,'owner'));
 assert.throws(()=>rules.assertAddressSaved({id:'owner',address:JSON.stringify(address),latitude:19.07,longitude:72.88},address,'owner'),/all address fields/);
 assert.throws(()=>rules.assertAddressSaved({...profile,id:'different-owner'},address,'owner'),/pin was not saved/);
 assert.throws(()=>rules.assertAddressSaved({...profile,latitude:19.08},address,'owner'),/pin was not saved/);
 assert.throws(()=>rules.assertAddressSaved({...profile,locationConfirmed:false},address,'owner'),/confirmation/);
});
test('real geocoding request includes separate building street area pincode and city',async()=>{
 let sent;const location=load('src/core/location/customerLocation.ts',{'expo-location':{},'../api/customerApi':{customerApi:async(path,body)=>{sent={path,body};return {success:true,latitude:19.07,longitude:72.88,precision:'area'};}}});
 await location.searchDeliveryAddress('Fixture address',address);assert.equal(sent.path,'/api/geocode-full-address');for(const key of ['building','street','area','pincode','city'])assert.equal(sent.body[key],address[key]);
});

test('approximate map suggestions require deliberate selection; rooftop and saved confirmed pins can be reviewed as shown',()=>{
 for(const precision of ['pincode','area','street','legacy']){assert.equal(rules.needsMapSelection(precision),true);assert.equal(rules.needsMapSelection(precision,true),false);}
 assert.equal(rules.needsMapSelection('rooftop'),false);assert.equal(rules.needsMapSelection('customer_selected'),false);
});

test('GPS pin assistance preserves coordinates, guards a different pincode and leaves address text untouched',()=>{
 const point={latitude:19.07,longitude:72.88,pincode:'400070',accuracyMeters:15,street:'GPS street'};
 assert.deepEqual(rules.deliveryGpsPin(point,'400070'),{latitude:19.07,longitude:72.88,accuracyMeters:15});
 assert.throws(()=>rules.deliveryGpsPin({...point,pincode:'400071'},'400070'),/different pincode/);
 assert.throws(()=>rules.deliveryGpsPin({...point,latitude:NaN},'400070'),/valid location/);
 assert.equal(rules.deliveryMapZoom('pincode'),14);assert.equal(rules.deliveryMapZoom('area'),15);assert.equal(rules.deliveryMapZoom('rooftop'),17);
});

test('fixture preview private storage never touches real secure storage and cannot serve fixture values in production',async()=>{
 const oldDev=global.__DEV__,oldFlag=process.env.EXPO_PUBLIC_UI_REVIEW;let nativeReads=0,nativeWrites=0;
 try{global.__DEV__=true;process.env.EXPO_PUBLIC_UI_REVIEW='1';
 const storage=load('src/core/storage/privateJson.ts',{'expo-secure-store':{getItemAsync:async()=>{nativeReads++;throw Error('Unavailable native store');},setItemAsync:async()=>{nativeWrites++;},deleteItemAsync:async()=>{nativeWrites++;}}});
 await storage.writePrivateJson('fixture-only',{sample:true});assert.deepEqual(await storage.readPrivateJson('fixture-only'),{sample:true});assert.equal(nativeReads,0);assert.equal(nativeWrites,0);
 global.__DEV__=false;assert.equal(await storage.readPrivateJson('fixture-only'),null);assert.equal(nativeReads,1);
 }finally{if(oldDev===undefined)delete global.__DEV__;else global.__DEV__=oldDev;if(oldFlag===undefined)delete process.env.EXPO_PUBLIC_UI_REVIEW;else process.env.EXPO_PUBLIC_UI_REVIEW=oldFlag;}
});
