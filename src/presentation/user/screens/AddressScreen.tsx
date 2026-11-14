import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {Routes} from '../navigation/types';
import {useDeliveryArea} from '../../../core/location/DeliveryAreaProvider';
import {validArea} from '../../../core/location/discoveryRules';
import React,{useState} from 'react';
import {DeliveryMap} from '../components/DeliveryMap';
import {useQueryClient} from '@tanstack/react-query';
import {useCustomer} from '../../../core/providers/CustomerProvider';
import {currentDeliveryLocation,searchDeliveryAddress} from '../../../core/location/customerLocation';
import type {Address,Chef} from '../../../core/api/models';
import {readAddress,validateAddress} from '../../../application/user/cart/cartRules';
import {useAppNavigation} from '../navigation/types';
import {Page,Title,Body,Heading,Button,Field,Card,ErrorView} from '../components/UI';
export function AddressScreen({route}:NativeStackScreenProps<Routes,'Address'>){
 const delivery=useDeliveryArea();
 const {request,deliveryAddress:saved,saveDeliveryAddress}=useCustomer(),client=useQueryClient(),nav=useAppNavigation();
 const [a,setAddress]=useState<Address>(saved||{latitude:delivery.area?.latitude??0,longitude:delivery.area?.longitude??0,building:'',street:'',area:delivery.area?.area||'',city:'Mumbai',pincode:delivery.area?.pincode||''});
 const [located,setLocated]=useState(!!saved||!!delivery.area),[query,setQuery]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),[confirmed,setConfirmed]=useState(false);
 const run=async(fn:()=>Promise<void>)=>{if(busy)return;setBusy(true);setError(null);try{await fn();}catch(e){setError((e as Error).message);}finally{setBusy(false);}};
 const locate=(gps:boolean)=>run(async()=>{const found=gps?await currentDeliveryLocation():await searchDeliveryAddress(query);setAddress(prev=>({...prev,latitude:found.latitude,longitude:found.longitude,street:found.street||'',area:found.area||found.address,city:found.city||prev.city,pincode:found.pincode,source:found.source}));setLocated(true);setConfirmed(false);});
 return <Page><Title>Delivery location</Title><Button title="Use current GPS location" disabled={busy} onPress={()=>void locate(true)}/><Field label="Search address" value={query} onChangeText={setQuery} placeholder="Street, area, city and pincode"/><Button title="Search address" secondary disabled={busy||query.length<10} onPress={()=>void locate(false)}/>
 {located&&<><Body>Drag the pin or tap the map to select your exact delivery location.</Body><DeliveryMap coordinate={{latitude:a.latitude,longitude:a.longitude}} disabled={busy} onChange={point=>{setAddress({...a,...point,source:'manual'});setConfirmed(false);}}/><Button title={confirmed?'Pin confirmed':'Confirm this pin'} secondary onPress={()=>setConfirmed(true)}/></>}
 <Card><Heading>Complete address</Heading>{(['building','street','area','city','pincode','landmark'] as const).map(key=><Field key={key} label={key==='building'?'Flat / house / building':key==='landmark'?'Landmark (optional)':key.charAt(0).toUpperCase()+key.slice(1)} value={a[key]||''} onChangeText={text=>setAddress({...a,[key]:text})} keyboardType={key==='pincode'?'number-pad':'default'}/>)}</Card>
 <ErrorView error={error}/><Button title={busy?'Saving…':route.params?.checkoutCartKey?'Save address & continue':'Save delivery address'} disabled={busy||!located||!confirmed} onPress={()=>void run(async()=>{const invalid=validateAddress(a);if(invalid)throw new Error(invalid);const chefs=await request<Chef[]>('/api/chefs/by-location?latitude='+a.latitude+'&longitude='+a.longitude);if(!chefs.length)throw new Error('This location is not currently served. Choose another delivery location.');await saveDeliveryAddress(a);if(validArea(a))await delivery.select({...a,source:'address'});await client.invalidateQueries({queryKey:['customer']});if(route.params?.checkoutCartKey)nav.replace('Checkout',{cartKey:route.params.checkoutCartKey});else nav.goBack();})}/></Page>;
}

