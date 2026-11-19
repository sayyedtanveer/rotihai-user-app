import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {Routes} from '../navigation/types';
import {useDeliveryArea,configuredDeliveryAreas,validatePincode} from '../../../core/location/DeliveryAreaProvider';
import {serviceableChefs,areasForPincode,type ConfiguredArea,validatedDeliveryFee} from '../../../core/location/discoveryRules';
import React,{useRef,useState} from 'react';
import {Text,View,ScrollView} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useCustomer} from '../../../core/providers/CustomerProvider';
import {searchDeliveryAddress,currentDeliveryLocation} from '../../../core/location/customerLocation';
import type {Address,Chef} from '../../../core/api/models';
import {latestOrderAddress,savedAddressFields,validateAddress,groupCart,lineTotal} from '../../../application/user/cart/cartRules';
import {useCart} from '../../../application/user/cart/CartProvider';
import {useAppNavigation} from '../navigation/types';
import {Page,Heading,Body,Button,Field,Card,ErrorView,ChoiceRow,Chip} from '../components/UI';
import {Icon} from '../components/BrandUI';
import {DeliveryMap} from '../components/DeliveryMap';
import {addressIdentity,reusableAddress,addressFieldErrors,needsMapSelection,deliveryGpsPin} from '../../../core/location/addressRules';
import {theme as t} from '../theme/theme';
export function AddressScreen({route}:NativeStackScreenProps<Routes,'Address'>){
 const delivery=useDeliveryArea(),cart=useCart(),{user,token,request,deliveryAddress:deliverySaved,saveDeliveryAddress}=useCustomer(),nav=useAppNavigation(),insets=useSafeAreaInsets();
 const [recovered,setRecovered]=useState<{owner:string;pin:string;address:ReturnType<typeof latestOrderAddress>}|null>(null),[recoveryError,setRecoveryError]=useState<string|null>(null);
 const pin=delivery.area?.pincode||'',profileSaved=savedAddressFields(user),matchingProfile=profileSaved?.pincode===pin?profileSaved:null,saved=deliverySaved?{...deliverySaved,building:deliverySaved.building||matchingProfile?.building||'',street:deliverySaved.street||matchingProfile?.street||'',landmark:deliverySaved.landmark||matchingProfile?.landmark||''}:matchingProfile,historyAddress=recovered?.owner===user.id&&recovered.pin===pin?recovered.address:null,prefill=saved?.building&&saved?.street?saved:historyAddress||saved,same=prefill?.pincode===pin;
 const dirty=useRef(false),hydratedPin=useRef(pin);
 const [building,setBuilding]=useState(same?prefill?.building||'':''),[street,setStreet]=useState(same?prefill?.street||'':''),[area,setArea]=useState(same?prefill?.area||'':delivery.area?.area||''),[landmark,setLandmark]=useState(same?prefill?.landmark||'':'');
 const [options,setOptions]=useState<ConfiguredArea[]>([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),lock=useRef(false),loadVersion=useRef(0);
 async function load(){const version=++loadVersion.current;setLoading(true);setOptions([]);setError(null);try{const rows=areasForPincode(await configuredDeliveryAreas(),pin);if(version!==loadVersion.current)return;setOptions(rows);setArea(current=>rows.some(r=>r.name===current)?current:rows[0]?.name||'');}catch(e){if(version===loadVersion.current)setError((e as Error).message);}finally{if(version===loadVersion.current)setLoading(false);}}
 React.useEffect(()=>{if(hydratedPin.current!==pin){dirty.current=false;hydratedPin.current=pin;setBuilding('');setStreet('');setLandmark('');}void load();},[pin]);
 React.useEffect(()=>{let active=true;setRecoveryError(null);if(!token||!pin||(saved?.building&&saved?.street))return;void request<Parameters<typeof latestOrderAddress>[0]>('/api/user/orders',undefined,'GET',{'X-RotiHai-Require-Fresh':'1'}).then(records=>{if(active)setRecovered({owner:user.id,pin,address:latestOrderAddress(records,user.id,pin)});}).catch(()=>{if(active)setRecoveryError('Could not load your previous delivery address. You can enter it below.');});return()=>{active=false;};},[token,user.id,pin,saved?.building,saved?.street]);
 React.useEffect(()=>{if(dirty.current||prefill?.pincode!==pin)return;setBuilding(prefill.building);setStreet(prefill.street);setLandmark(prefill.landmark||'');setArea(current=>options.some(o=>o.name===prefill.area)?prefill.area:current);},[pin,prefill?.building,prefill?.street,prefill?.landmark,prefill?.area,options]);
 const identity=addressIdentity({building,street,area,city:delivery.area?.city||'Mumbai',pincode:pin}),identityRef=useRef(identity);identityRef.current=identity;
 const [point,setPoint]=useState<{latitude:number;longitude:number;identity:string;precision:string;selected?:boolean;accuracyMeters?:number}|null>(null),[mapReady,setMapReady]=useState(false),[mapVersion,setMapVersion]=useState(0);
 const reusable=reusableAddress(deliverySaved,identity,pin);
 const candidate=point?.identity===identity?point:null;
 const selectionRequired=!!candidate&&needsMapSelection(candidate.precision,candidate.selected);
 function locationEdited(){dirty.current=true;setPoint(null);setMapReady(false);}
 const scroll=useRef<React.ComponentRef<typeof ScrollView>>(null),[touched,setTouched]=useState({building:false,street:false,area:false});
 const fields=addressFieldErrors({building,street,area});
 React.useEffect(()=>{if(candidate){const timer=setTimeout(()=>scroll.current?.scrollToEnd({animated:true}),180);return()=>clearTimeout(timer);}},[candidate?.identity]);
 async function useGpsPin(){if(lock.current)return;lock.current=true;setBusy(true);setError(null);const requested=identity;try{
  const found=deliveryGpsPin(await currentDeliveryLocation(),pin);
  if(identityRef.current!==requested)return;
  setPoint({...found,identity:requested,precision:'gps',selected:false});setMapReady(false);setMapVersion(n=>n+1);
 }catch(e){setError((e as Error).message);}finally{lock.current=false;setBusy(false);}}
 const group=groupCart(cart.items).find(g=>g.key===route.params?.checkoutCartKey);
 async function save(){if(lock.current)return;setTouched({building:true,street:true,area:true});if(Object.values(fields).some(Boolean)){setError('Complete the required address details below.');return;}lock.current=true;setBusy(true);setError(null);try{
  const validated=await validatePincode(pin),rows=areasForPincode(await configuredDeliveryAreas(),pin);
  if(!rows.some(r=>r.name===area))throw new Error('Choose an available delivery area.');
  if(!building.trim()||!street.trim())throw new Error('Enter your flat / house / building and street.');
  const requestedIdentity=identity;
  if(!candidate&&!reusable){
    const found=await searchDeliveryAddress([building,street,area,pin].join(', '),{building:building.trim(),street:street.trim(),area,pincode:pin,city:validated.city||'Mumbai'});
    if(identityRef.current===requestedIdentity){setPoint({...found,identity:requestedIdentity,precision:found.precision||'area'});setMapReady(false);}return;
  }
  if(candidate&&!mapReady)throw new Error('Wait for the map to load, then confirm your delivery pin.');
  if(selectionRequired)throw new Error('Tap your building entrance on the map before confirming.');
  const selected=candidate||reusable!;
  const address:Address={latitude:selected.latitude,longitude:selected.longitude,building:building.trim(),street:street.trim(),area,city:validated.city||'Mumbai',pincode:pin,landmark:landmark.trim(),source:'address',...(candidate?{locationConfirmed:true,locationSource:'customer_pin',locationPrecision:'customer_selected'}:{locationConfirmed:reusable?.locationConfirmed,locationSource:reusable?.locationSource||'legacy',locationPrecision:reusable?.locationPrecision||'legacy'})};
  const invalid=validateAddress(address);if(invalid)throw new Error(invalid);
  const chefs=await request<Chef[]>('/api/chefs/by-location?latitude='+address.latitude+'&longitude='+address.longitude+'&pincode='+pin,undefined,'GET',{'X-RotiHai-Require-Fresh':'1'});
  const eligible=serviceableChefs(chefs,{...address,source:'address'});
  if(route.params?.checkoutCartKey&&!group)throw new Error('This basket changed. Return to your cart.');
  if(group?!eligible.some(c=>c.id===group.chefId):!eligible.length)throw new Error(group?'Your selected kitchen does not deliver to this address. Change your kitchen on Home.':'Delivery is not available to this address. Please check your street and area.');
  if(group)validatedDeliveryFee(await request('/api/calculate-delivery',{chefId:group.chefId,latitude:address.latitude,longitude:address.longitude,subtotal:group.items.reduce((n,i)=>n+lineTotal(i),0)}));
  if(identityRef.current!==requestedIdentity)throw new Error('Address changed. Please review your pin again.');
  await saveDeliveryAddress(address);
  if(route.params?.checkoutCartKey)nav.replace('Checkout',{cartKey:route.params.checkoutCartKey});else nav.goBack();
 }catch(e){setError((e as Error).message);}finally{lock.current=false;setBusy(false);}}
 return <View style={{flex:1,backgroundColor:t.bg}}><Page compact scrollRef={scroll}><Text style={{fontFamily:t.bold,fontSize:10,letterSpacing:1.4,color:t.primary}}>A LITTLE CLOSER TO HOME</Text><Heading>Where should we deliver?</Heading><Body muted>Add your address, then confirm the pin at your entrance.</Body>
 <View style={{flexDirection:'row',gap:8}}>{['1 · Address details','2 · Confirm delivery pin'].map((label,index)=><View key={label} style={{flex:1,padding:10,borderRadius:12,backgroundColor:(candidate||reusable?index===1:index===0)?t.pale:t.surface,borderWidth:1,borderColor:t.border}}><Text style={{fontFamily:t.semibold,fontSize:11,color:t.primary}}>{label}</Text></View>)}</View>
 <Card><View style={{flexDirection:'row',alignItems:'center',gap:10}}><Icon name="pin" color={t.primary}/><View style={{flex:1}}><Text style={{fontFamily:t.medium,fontSize:11,color:t.muted}}>DELIVERY PINCODE</Text><Heading>{pin||'Choose a pincode first'}</Heading></View></View><Body muted>{area||delivery.area?.area} · Pincode selected on Home</Body><Button title="Change pincode on Home" secondary disabled={busy} onPress={()=>nav.navigate('Tabs',{screen:'Home'})}/></Card>
 <Card><Heading>Your address details</Heading><Text style={{fontFamily:t.font,fontSize:11,color:t.muted}}><Text style={{color:t.danger}}>*</Text> Required for delivery</Text>
 {historyAddress&&prefill===historyAddress&&<Body muted>Filled from your last order in {pin}. Please review before continuing.</Body>}{recoveryError&&<Body muted>{recoveryError}</Body>}
 <Field label="Flat / house / building" maxLength={500} required hint="Include your flat or house number and building name." error={touched.building?fields.building:undefined} placeholder="e.g. Flat 12, Rose Apartments" value={building} editable={!busy} onBlur={()=>setTouched(v=>({...v,building:true}))} onChangeText={value=>{locationEdited();setBuilding(value);}}/>
 <Field label="Street / road" maxLength={500} required hint="Street, road or colony name — separate from your building." error={touched.street?fields.street:undefined} placeholder="e.g. Station Road, LIG Colony" value={street} editable={!busy} onBlur={()=>setTouched(v=>({...v,street:true}))} onChangeText={value=>{locationEdited();setStreet(value);}}/>
 <Text style={{fontFamily:t.semibold,fontSize:12,color:t.ink}}>Area <Text style={{color:t.danger}}>*</Text></Text>{loading?<Body muted>Loading delivery areas…</Body>:<ChoiceRow>{options.map(o=><Chip key={o.id} title={o.name} selected={area===o.name} onPress={()=>{if(!busy){locationEdited();setTouched(v=>({...v,area:true}));setArea(o.name);}}}/>)}</ChoiceRow>}
 {touched.area&&!!fields.area&&<Text accessibilityRole="alert" style={{fontFamily:t.font,color:t.danger,fontSize:11}}>{fields.area}</Text>}
 {!loading&&!options.length&&<Body muted>No configured areas for this pincode. Change your pincode on Home.</Body>}
 <Field label="Landmark / floor instructions (optional)" maxLength={500} hint="Helps your delivery partner. Editing this keeps your saved pin." placeholder="e.g. 4th floor, entrance beside the pharmacy" value={landmark} editable={!busy} onChangeText={value=>{dirty.current=true;setLandmark(value);}}/></Card>
 {candidate&&<Card><Heading>Your delivery pin</Heading><Body muted>{candidate.precision==='rooftop'?'Review the suggested building. If the pin is at your entrance, you can confirm it as shown.':candidate.precision==='customer_selected'?'Review your saved confirmed pin, or move it if needed.':'This is an approximate location. Tap your building entrance on the map or drag the pin before confirming.'} GPS permission is not required.</Body>
 <DeliveryMap precision={candidate.precision} disabled={busy} key={mapVersion+candidate.identity} coordinate={candidate} onReady={setMapReady} onChange={p=>{setPoint({...candidate,...p,selected:true});}}/>
 <Body muted>Pin in the wrong place? Zoom out and drag the map to your area, then tap your entrance. You can also tap the pin itself if it is correct.</Body>
 <Button title="Use my current location" secondary disabled={busy} onPress={()=>void useGpsPin()}/>
 <Body muted>Use GPS only when you are at this delivery address.{candidate.accuracyMeters!=null?' GPS accuracy: about '+Math.round(candidate.accuracyMeters)+' m. Review the pin before confirming.':''}</Body>
 <Button title="Reload map" secondary disabled={busy} onPress={()=>{setMapReady(false);setMapVersion(n=>n+1);}}/></Card>}
 {reusable&&!candidate&&<Card><Heading>Saved delivery location</Heading><Body muted>{reusable.locationConfirmed?'Your confirmed pin is ready to use.':'Using your existing saved location. You can review its pin before saving.'}</Body><Button title="Review delivery pin" secondary disabled={busy} onPress={()=>{setPoint({...reusable,identity,precision:reusable.locationPrecision||'legacy',selected:reusable.locationConfirmed===true});setMapReady(false);}}/></Card>}
 <ErrorView error={error}/>{error&&<Button title="Reload delivery areas" secondary disabled={busy} onPress={()=>void load()}/>}<Body muted>{candidate?'Your address is saved only after you confirm this delivery pin.':reusable?'We will reuse your saved coordinates and check current delivery charges.':'Next: review the suggested location on the map. Pin confirmation is required for a new address.'}</Body></Page>
 <View style={{padding:16,paddingBottom:Math.max(insets.bottom,16),backgroundColor:t.surface,borderTopWidth:1,borderColor:t.border}}><Button title={busy?'Checking your address…':candidate?(mapReady?(selectionRequired?'Tap your entrance on the map':'Confirm pin & save address'):'Loading map…'):reusable?'Save delivery address':'Find my delivery pin'} disabled={busy||loading||selectionRequired||!!candidate&&!mapReady||!pin||!area||!options.length} onPress={()=>void save()}/></View></View>;
}
