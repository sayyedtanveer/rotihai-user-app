import {endedOrder,orderForCustomer} from '../../../application/user/orders/orderRules';
import {backendPaymentRecorded} from '../../../application/user/payments/paymentRules';
import {useDeliveryArea} from '../../../core/location/DeliveryAreaProvider';
import {serviceableChefs} from '../../../core/location/discoveryRules';
import {isKitchenOrderable} from '../../../application/user/catalog/menuRules';
import {useConnectivity} from '../../../core/api/connectivity';
import {OrderProgress} from '../components/OrderProgress';
import React, { useRef, useState } from 'react';
import { Alert, Linking } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useApi, useCustomer } from '../../../core/providers/CustomerProvider';
import { useCart } from '../../../application/user/cart/CartProvider';
import { restoreCartItems } from '../../../application/user/cart/restoreCart';
import type { Order,Chef,PaymentSettings } from '../../../core/api/models';
import { useAppNavigation, type Routes } from '../navigation/types';
import { Page, Title, Heading, Body, Card, Button, Chip, Row, Field, Loading, ErrorView, Empty, currency, nice } from '../components/UI';
export function OrdersScreen() {
 const nav=useAppNavigation(), orders=useApi<Order[]>('/api/orders',{interval:20000});
 const [active,setActive]=useState(false);
 const list=(orders.data||[]).filter(o=>!active || !endedOrder(o.status));
 return <Page refreshing={orders.isRefetching} onRefresh={()=>void orders.refetch()}><Title>Your orders</Title><Button title="Saved checkout & pending payments" secondary onPress={()=>nav.navigate('Recovery')}/><Row><Chip title="All orders" selected={!active} onPress={()=>setActive(false)}/><Chip title="Active" selected={active} onPress={()=>setActive(true)}/></Row>
 {orders.isPending&&<Loading/>}<ErrorView error={orders.error} retry={()=>void orders.refetch()}/>
 {!orders.isPending&&!orders.error&&!list.length&&<Empty title="No orders yet"/>}
 {list.map(o=><Card key={o.id}><Heading>{o.chefName||o.categoryName||'RotiHai order'}</Heading><Body>{new Date(o.createdAt).toLocaleString('en-IN')}</Body><Body>{o.items?.map(i=>i.quantity+' × '+i.name).join(', ')}</Body><Body>{nice(o.status)} · Payment: {nice(o.paymentStatus)}</Body><Heading>{currency(o.total)}</Heading><Button title="View & track order" onPress={()=>nav.navigate('OrderDetails',{id:o.id})}/></Card>)}</Page>;
}
export function OrderDetailsScreen({route,navigation}:NativeStackScreenProps<Routes,'OrderDetails'>){
 const cart=useCart(), reordering=useRef(false);
 const {request,user}=useCustomer(),{area}=useDeliveryArea(),online=useConnectivity(),settings=useApi<PaymentSettings>('/api/payment-settings'),client=useQueryClient(),order=useApi<Order>('/api/orders/'+encodeURIComponent(route.params.id),{interval:10000});
 const [reason,setReason]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null);
 const o=order.data;
 if(order.isPending)return <Loading/>;
 if(o&&!orderForCustomer(o,user))return <Page><Empty title="This order is unavailable for your account"/><Button title="Your orders" onPress={()=>navigation.navigate('Tabs',{screen:'Orders'})}/></Page>;
 if(!o)return <Page><ErrorView error={order.error} retry={()=>void order.refetch()}/></Page>;
 const cancel=async()=>{setBusy(true);setError(null);try{await request('/api/orders/'+encodeURIComponent(o.id)+'/cancel',{reason:reason.trim()||'Customer requested cancellation'});await client.invalidateQueries({queryKey:['customer']});}catch(e){setError((e as Error).message);}finally{setBusy(false);}};
 return <Page refreshing={order.isRefetching} onRefresh={()=>void order.refetch()}><Title>{nice(o.status)}</Title><Body muted>Order {o.id}</Body><Card><Heading>Order progress</Heading><OrderProgress status={o.status}/><Body muted>{order.isCached?'Saved order status · reconnect for the latest update.':'Status refreshes automatically.'}</Body></Card>
 <Card><Heading>Delivery</Heading><Body>{o.address}</Body><Body>{o.deliveryDate||''} {o.deliveryTime||'As soon as possible'}</Body>{o.deliveryPersonName&&<Body>{o.deliveryPersonName}</Body>}{o.deliveryPersonPhone&&<Button title="Call delivery person" secondary onPress={()=>void Linking.openURL('tel:'+o.deliveryPersonPhone).catch(()=>setError('Unable to open phone app'))}/>}
 {o.customerLatitude!=null&&o.customerLongitude!=null&&<Button title="View delivery location" secondary onPress={()=>void Linking.openURL('https://www.google.com/maps/search/?api=1&query='+o.customerLatitude+','+o.customerLongitude).catch(()=>setError('Unable to open map'))}/>}</Card>
 <Button title={busy ? 'Please wait…' : 'Reorder at current prices'} disabled={busy || !online || !cart.ready} secondary onPress={()=>Alert.alert('Reorder these dishes?', 'Current prices and availability will be checked. This replaces your basket for the same kitchen and category; review it before checkout.', [{text:'Cancel',style:'cancel'},{text:'Review basket',onPress:()=>{if(reordering.current)return;reordering.current=true;setBusy(true);setError(null);void (async()=>{if(!area)throw new Error('Choose your delivery area before reordering.');const fresh=<T,>(path:string)=>request<T>(path,undefined,'GET',{'X-RotiHai-Require-Fresh':'1'});const chefs=serviceableChefs(await fresh<Chef[]>('/api/chefs/by-location?latitude='+area.latitude+'&longitude='+area.longitude+'&pincode='+area.pincode),area).filter(isKitchenOrderable);return restoreCartItems(o,fresh,{serviceableChefIds:chefs.map(c=>c.id)});})().then(items=>{cart.restore(items);navigation.navigate('Cart');}).catch(e=>setError(e.message)).finally(()=>{reordering.current=false;setBusy(false);});}}])}/>
 <Card><Heading>Items & bill</Heading>{o.items?.map((i,index)=><Body key={index}>{i.quantity} × {i.name} {i.variantName||''} · {currency(i.price*i.quantity)}{i.specialInstructions?' — '+i.specialInstructions:''}</Body>)}
 <Body>Items: {currency(o.subtotal)}</Body><Body>Delivery: {currency(o.deliveryFee)}</Body><Body>Discount: {currency(o.discount)}</Body><Body>Wallet: {currency(o.walletAmountUsed)}</Body><Heading>Total: {currency(o.total)}</Heading><Body>Payment: {nice(o.paymentStatus)}</Body></Card>
 {!backendPaymentRecorded(o.paymentStatus)&&!['cancelled','rejected','expired'].includes(o.status)&&<Button title="Continue payment" onPress={()=>navigation.navigate('Payment',{id:o.id,kind:'order',amount:Number(o.total)})}/>}
 {!endedOrder(o.status)&&<Card><Field label="Cancellation reason" value={reason} onChangeText={setReason}/><Button title="Cancel order" secondary disabled={busy} onPress={()=>Alert.alert('Cancel this order?','Cancellation eligibility is checked by the server.',[{text:'Keep order',style:'cancel'},{text:'Cancel order',style:'destructive',onPress:()=>void cancel()}])}/></Card>}
 <Card><Heading>Here to help</Heading>{(o.chefPhone||o.chef?.phone)&&<Button title="Call the kitchen" secondary onPress={()=>void Linking.openURL('tel:'+(o.chefPhone||o.chef?.phone)).catch(()=>setError('Unable to open the phone app.'))}/>}<Button title="Contact support about this order" secondary onPress={()=>{const configured=settings.data?.supportPhone?.replace(/\D/g,'')||'918169020290';const phone=configured.length===10?'91'+configured:configured;void Linking.openURL('https://wa.me/'+phone+'?text='+encodeURIComponent('RotiHai order support: '+o.id+' · '+o.status)).catch(()=>setError('Unable to open support.'));}}/></Card>
 <ErrorView error={error||order.error}/></Page>;
}

