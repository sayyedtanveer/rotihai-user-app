import {theme as t} from '../theme/theme';
import {endedOrder,orderForCustomer} from '../../../application/user/orders/orderRules';
import {backendPaymentRecorded,guestReceiptMatches,type PendingPayment} from '../../../application/user/payments/paymentRules';
import {useDeliveryArea} from '../../../core/location/DeliveryAreaProvider';
import {serviceableChefs} from '../../../core/location/discoveryRules';
import {isKitchenOrderable} from '../../../application/user/catalog/menuRules';
import {useConnectivity} from '../../../core/api/connectivity';
import {OrderProgress} from '../components/OrderProgress';
import React, { useEffect,useRef, useState } from 'react';
import { Alert, Linking,Text,View,StyleSheet } from 'react-native';
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
export function OrderDetailsScreen({route,navigation,guestReceipt}:NativeStackScreenProps<Routes,'OrderDetails'>&{guestReceipt?:PendingPayment}){
 const cart=useCart(), reordering=useRef(false);
 const {request,user,token}=useCustomer(),{area}=useDeliveryArea(),online=useConnectivity(),settings=useApi<PaymentSettings>('/api/payment-settings'),client=useQueryClient(),order=useApi<Order>('/api/orders/'+encodeURIComponent(route.params.id),{interval:10000});
 const [reason,setReason]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null);
 useEffect(()=>{navigation.setOptions({title:'Track order',headerShadowVisible:false,headerStyle:{backgroundColor:'#fffaf3'},headerTitleStyle:{fontFamily:t.bold,fontSize:18}});},[navigation]);
 const o=order.data;
 if(order.isPending)return <Loading/>;
 if(o&&!orderForCustomer(o,user)&&!(user.id==='guest'&&guestReceiptMatches(o,guestReceipt)))return <Page><Empty title="This order is unavailable for your account"/><Button title="Your orders" onPress={()=>navigation.navigate('Tabs',{screen:'Orders'})}/></Page>;
 if(!o)return <Page><ErrorView error={order.error} retry={()=>void order.refetch()}/></Page>;
 const cancel=async()=>{setBusy(true);setError(null);try{await request('/api/orders/'+encodeURIComponent(o.id)+'/cancel',{reason:reason.trim()||'Customer requested cancellation'});await client.invalidateQueries({queryKey:['customer']});}catch(e){setError((e as Error).message);}finally{setBusy(false);}};
 return <Page refreshing={order.isRefetching} onRefresh={()=>void order.refetch()}><View style={track.hero}><Text style={track.eyebrow}>YOUR ORDER</Text><Text accessibilityRole="header" style={track.status}>{nice(o.status)}</Text><Text selectable style={track.reference}>Order #{o.id}</Text></View><Card><Text style={track.eyebrow}>YOUR KITCHEN</Text><Heading>{o.chefName||o.chef?.name||'RotiHai kitchen'}</Heading>{o.categoryName&&<Body muted>{o.categoryName}</Body>}</Card><Card><Heading>Order progress</Heading><OrderProgress status={o.status}/><Body muted>{order.isCached?'Saved order status · reconnect for the latest update.':'Status refreshes automatically.'}</Body></Card>
 <Card><Heading>Delivery</Heading><Body>{o.address}</Body>{(o.deliveryDate||o.deliveryTime)&&<Body>{o.deliveryDate} {o.deliveryTime}</Body>}{o.deliveryInstructions&&<Body muted>{o.deliveryInstructions}</Body>}{o.deliveryPersonName&&<Body>{o.deliveryPersonName}</Body>}{o.deliveryPersonPhone&&<Button title="Call delivery person" secondary onPress={()=>void Linking.openURL('tel:'+o.deliveryPersonPhone).catch(()=>setError('Unable to open phone app'))}/>}
 {o.customerLatitude!=null&&o.customerLongitude!=null&&<Button title="View delivery location" secondary onPress={()=>void Linking.openURL('https://www.google.com/maps/search/?api=1&query='+o.customerLatitude+','+o.customerLongitude).catch(()=>setError('Unable to open map'))}/>}</Card>
 <Button title={busy ? 'Please wait…' : 'Reorder at current prices'} disabled={busy || !online || !cart.ready} secondary onPress={()=>Alert.alert('Reorder these dishes?', 'Current prices and availability will be checked. This replaces your basket for the same kitchen and category; review it before checkout.', [{text:'Cancel',style:'cancel'},{text:'Review basket',onPress:()=>{if(reordering.current)return;reordering.current=true;setBusy(true);setError(null);void (async()=>{if(!area)throw new Error('Choose your delivery area before reordering.');const fresh=<T,>(path:string)=>request<T>(path,undefined,'GET',{'X-RotiHai-Require-Fresh':'1'});const chefs=serviceableChefs(await fresh<Chef[]>('/api/chefs/by-location?latitude='+area.latitude+'&longitude='+area.longitude+'&pincode='+area.pincode),area).filter(isKitchenOrderable);return restoreCartItems(o,fresh,{serviceableChefIds:chefs.map(c=>c.id)});})().then(items=>{cart.restore(items);navigation.navigate('Cart');}).catch(e=>setError(e.message)).finally(()=>{reordering.current=false;setBusy(false);});}}])}/>
 <Card><Heading>Your meal</Heading>{o.items?.map((i,index)=><View key={index} style={track.item}><View style={track.quantity}><Text style={track.quantityText}>{i.quantity}×</Text></View><View style={{flex:1,gap:4}}><Text style={track.itemName}>{i.name}{i.variantName?' · '+i.variantName:''}</Text>{i.specialInstructions&&<Body muted>{i.specialInstructions}</Body>}</View><Text style={track.price}>{currency(i.price*i.quantity)}</Text></View>)}</Card>
 <View style={track.bill}><View style={track.billHeader}><Heading>Bill details</Heading><Text style={track.eyebrow}>ROTIHAI</Text></View><View style={track.billBody}><TrackBillRow label="Item total" value={currency(o.subtotal)}/><TrackBillRow label="Delivery" value={currency(o.deliveryFee)}/>{Number(o.platformFee)>0&&<TrackBillRow label="Platform fee" value={currency(o.platformFee)}/>}{Number(o.discount)>0&&<TrackBillRow label="Discount" value={'−'+currency(o.discount)}/>}{Number(o.walletAmountUsed)>0&&<TrackBillRow label="Wallet used" value={'−'+currency(o.walletAmountUsed)}/>}</View><View style={track.billTotal}><Heading>Grand total</Heading><Text style={track.total}>{currency(o.total)}</Text></View></View>
 <Card><Text style={track.eyebrow}>PAYMENT STATUS</Text><Heading>{nice(o.paymentStatus)}</Heading></Card>
 {!backendPaymentRecorded(o.paymentStatus)&&!['cancelled','rejected','expired'].includes(o.status)&&<Button title="Continue payment" onPress={()=>navigation.navigate('Payment',{id:o.id,kind:'order',amount:Number(o.total)})}/>}
 {token&&!endedOrder(o.status)&&<Card><Field label="Cancellation reason" value={reason} onChangeText={setReason}/><Button title="Cancel order" secondary disabled={busy} onPress={()=>Alert.alert('Cancel this order?','Cancellation eligibility is checked by the server.',[{text:'Keep order',style:'cancel'},{text:'Cancel order',style:'destructive',onPress:()=>void cancel()}])}/></Card>}
 <Card><Heading>Here to help</Heading>{(o.chefPhone||o.chef?.phone)&&<Button title="Call the kitchen" secondary onPress={()=>void Linking.openURL('tel:'+(o.chefPhone||o.chef?.phone)).catch(()=>setError('Unable to open the phone app.'))}/>}<Button title="Contact support about this order" secondary onPress={()=>{const configured=settings.data?.supportPhone?.replace(/\D/g,'')||'918169020290';const phone=configured.length===10?'91'+configured:configured;void Linking.openURL('https://wa.me/'+phone+'?text='+encodeURIComponent('RotiHai order support: '+o.id+' · '+o.status)).catch(()=>setError('Unable to open support.'));}}/></Card>
 <Button title="Back to Home" secondary onPress={()=>navigation.navigate('Tabs',{screen:'Home'})}/><ErrorView error={error||order.error}/></Page>;
}


function TrackBillRow({label,value}:{label:string;value:string}){return <View style={track.billRow}><Body muted>{label}</Body><Text style={track.price}>{value}</Text></View>;}
const track=StyleSheet.create({
 hero:{backgroundColor:'#fff0d9',borderWidth:1,borderColor:'#ead3b2',borderRadius:22,padding:21,gap:10},
 eyebrow:{fontFamily:t.semibold,fontSize:10,letterSpacing:1.4,color:'#9a6a35'},
 status:{fontFamily:t.bold,fontSize:26,letterSpacing:-.6,color:'#503921'},
 reference:{fontFamily:t.font,fontSize:11,lineHeight:18,color:'#826e58'},
 item:{flexDirection:'row',gap:12,alignItems:'center',paddingVertical:8},
 quantity:{backgroundColor:'#fff1dd',borderRadius:8,padding:8},quantityText:{fontFamily:t.bold,fontSize:12,color:'#8a5d2a'},
 itemName:{fontFamily:t.medium,fontSize:14,lineHeight:21,color:t.ink},price:{fontFamily:t.semibold,fontSize:13,color:t.ink},
 bill:{borderRadius:20,overflow:'hidden',borderWidth:1,borderColor:'#e7d6bf',backgroundColor:'#fffdf9'},
 billHeader:{backgroundColor:'#fff1db',padding:18,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
 billBody:{padding:18,gap:12},billRow:{flexDirection:'row',justifyContent:'space-between',gap:16},
 billTotal:{padding:18,borderTopWidth:1,borderStyle:'dashed',borderColor:'#dcc5a3',backgroundColor:'#fff7eb',flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
 total:{fontFamily:t.bold,fontSize:23,color:'#704521'}
});
