import {Icon} from '../components/BrandUI';
import {theme as t} from '../theme/theme';
import {endedOrder,orderForCustomer} from '../../../application/user/orders/orderRules';
import {backendPaymentRecorded,guestReceiptMatches,type PendingPayment} from '../../../application/user/payments/paymentRules';
import {useDeliveryArea} from '../../../core/location/DeliveryAreaProvider';
import {serviceableChefs} from '../../../core/location/discoveryRules';
import {isKitchenOrderable} from '../../../application/user/catalog/menuRules';
import {useConnectivity} from '../../../core/api/connectivity';
import {OrderProgress} from '../components/OrderProgress';
import React, { useEffect,useRef, useState } from 'react';
import { Alert, Linking,Text,View,StyleSheet,Pressable } from 'react-native';
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
 {list.map(o=><Pressable key={o.id} accessibilityRole="button" accessibilityLabel={'View order from '+(o.chefName||o.categoryName||'RotiHai')+', '+nice(o.status)} onPress={()=>nav.navigate('OrderDetails',{id:o.id})} style={({pressed})=>[cards.order,pressed&&{transform:[{scale:.985}],opacity:.9}]}>
 <View style={cards.top}><View style={cards.kitchenIcon}><Icon name="orders" color={t.primary} size={22}/></View><View style={{flex:1,gap:4}}><Text style={cards.kitchen}>{o.chefName||o.categoryName||'RotiHai order'}</Text><Text style={cards.meta}>{new Date(o.createdAt).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'})}</Text></View><View style={[cards.badge,{backgroundColor:orderTone(o.status).bg}]}><Text style={[cards.badgeText,{color:orderTone(o.status).ink}]}>{nice(o.status)}</Text></View></View>
 <View style={cards.meals}><Text numberOfLines={3} style={cards.mealText}>{o.items?.map(i=>i.quantity+' × '+i.name).join(' · ')||'View order items'}</Text><Text style={cards.meta}>Payment · {nice(o.paymentStatus)}</Text></View>
 <View style={cards.bottom}><View><Text style={cards.totalLabel}>ORDER TOTAL</Text><Text style={cards.amount}>{currency(o.total)}</Text></View><View style={cards.trackAction}><Text style={cards.trackText}>{endedOrder(o.status)?'View order':'Track order'}</Text><Icon name="arrow" color={t.primary} size={18}/></View></View>
 </Pressable>)}</Page>;
}
export function OrderDetailsScreen({route,navigation,guestReceipt}:NativeStackScreenProps<Routes,'OrderDetails'>&{guestReceipt?:PendingPayment}){
 const cart=useCart(), reordering=useRef(false);
 const {request,user,token}=useCustomer(),{area}=useDeliveryArea(),online=useConnectivity(),settings=useApi<PaymentSettings>('/api/payment-settings'),client=useQueryClient(),order=useApi<Order>('/api/orders/'+encodeURIComponent(route.params.id),{interval:10000});
 const [reason,setReason]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null);
 useEffect(()=>{navigation.setOptions({title:'Track order',headerShadowVisible:false,headerStyle:{backgroundColor:'#fffaf3'},headerTitleStyle:{fontFamily:t.bold,fontSize:18}});},[navigation]);
 const o=order.data;
 const bill=o?.billingSnapshot?.bill;
 const billReconciles=!!bill||!!o&&Math.round((Number(o.subtotal)+Number(o.deliveryFee)+Number(o.platformFee||0)-Number(o.discount||0)-Number(o.walletAmountUsed||0))*100)===Math.round(Number(o.total)*100);
 if(order.isPending)return <Loading/>;
 if(o&&!orderForCustomer(o,user)&&!(user.id==='guest'&&guestReceiptMatches(o,guestReceipt)))return <Page><Empty title="This order is unavailable for your account"/><Button title="Your orders" onPress={()=>navigation.navigate('Tabs',{screen:'Orders'})}/></Page>;
 if(!o)return <Page><ErrorView error={order.error} retry={()=>void order.refetch()}/></Page>;
 const cancel=async()=>{setBusy(true);setError(null);try{await request('/api/orders/'+encodeURIComponent(o.id)+'/cancel',{reason:reason.trim()||'Customer requested cancellation'});await client.invalidateQueries({queryKey:['customer']});}catch(e){setError((e as Error).message);}finally{setBusy(false);}};
 return <Page refreshing={order.isRefetching} onRefresh={()=>void order.refetch()}><View style={track.hero}><Text style={track.eyebrow}>YOUR ORDER</Text><Text accessibilityRole="header" style={track.status}>{nice(o.status)}</Text><Text selectable style={track.reference}>Order #{o.id}</Text></View><OrderPanel><Text style={track.eyebrow}>YOUR KITCHEN</Text><Heading>{o.chefName||o.chef?.name||'RotiHai kitchen'}</Heading>{o.categoryName&&<Body muted>{o.categoryName}</Body>}</OrderPanel><OrderPanel><Heading>Order progress</Heading><OrderProgress status={o.status}/><Body muted>{order.isCached?'Saved order status · reconnect for the latest update.':'Status refreshes automatically.'}</Body></OrderPanel>
 <OrderPanel tone="sage"><Heading>Delivery</Heading><Body>{o.address}</Body>{(o.deliveryDate||o.deliveryTime)&&<Body>{o.deliveryDate} {o.deliveryTime}</Body>}{o.deliveryInstructions&&<Body muted>{o.deliveryInstructions}</Body>}{o.deliveryPersonName&&<Body>{o.deliveryPersonName}</Body>}{o.deliveryPersonPhone&&<Button title="Call delivery person" secondary onPress={()=>void Linking.openURL('tel:'+o.deliveryPersonPhone).catch(()=>setError('Unable to open phone app'))}/>}
 {o.customerLatitude!=null&&o.customerLongitude!=null&&<Button title="View delivery location" secondary onPress={()=>void Linking.openURL('https://www.google.com/maps/search/?api=1&query='+o.customerLatitude+','+o.customerLongitude).catch(()=>setError('Unable to open map'))}/>}</OrderPanel>
 <Button title={busy ? 'Please wait…' : 'Reorder at current prices'} disabled={busy || !online || !cart.ready} secondary onPress={()=>Alert.alert('Reorder these dishes?', 'Current prices and availability will be checked. This replaces your basket for the same kitchen and category; review it before checkout.', [{text:'Cancel',style:'cancel'},{text:'Review basket',onPress:()=>{if(reordering.current)return;reordering.current=true;setBusy(true);setError(null);void (async()=>{if(!area)throw new Error('Choose your delivery area before reordering.');const fresh=<T,>(path:string)=>request<T>(path,undefined,'GET',{'X-RotiHai-Require-Fresh':'1'});const chefs=serviceableChefs(await fresh<Chef[]>('/api/chefs/by-location?latitude='+area.latitude+'&longitude='+area.longitude+'&pincode='+area.pincode),area).filter(isKitchenOrderable);return restoreCartItems(o,fresh,{serviceableChefIds:chefs.map(c=>c.id)});})().then(items=>{cart.restore(items);navigation.navigate('Cart');}).catch(e=>setError(e.message)).finally(()=>{reordering.current=false;setBusy(false);});}}])}/>
 <OrderPanel><Heading>Your meal</Heading>{o.items?.map((i,index)=><View key={index} style={track.item}><View style={track.quantity}><Text style={track.quantityText}>{i.quantity}×</Text></View><View style={{flex:1,gap:4}}><Text style={track.itemName}>{i.name}{i.variantName?' · '+i.variantName:''}</Text>{i.specialInstructions&&<Body muted>{i.specialInstructions}</Body>}</View><Text style={track.price}>{currency(i.price*i.quantity)}</Text></View>)}</OrderPanel>
 <View style={track.bill}><View style={track.billHeader}><Heading>Bill details</Heading><Text style={track.eyebrow}>ROTIHAI</Text></View><View style={track.billBody}>{!billReconciles?<Body muted>Detailed breakdown unavailable for this historical order.</Body>:<><TrackBillRow label="Item total" value={currency(bill?bill.subtotalPaise/100:o.subtotal)}/><TrackBillRow label="Delivery" value={currency(bill?bill.deliveryFeePaise/100:o.deliveryFee)}/>{Number(o.platformFee)>0&&<TrackBillRow label="Platform fee" value={currency(bill?bill.platformFeePaise/100:o.platformFee)}/>}{Number(o.discount)>0&&<TrackBillRow label="Discount" value={'−'+currency(bill?bill.discountPaise/100:o.discount)}/>}{Number(o.walletAmountUsed)>0&&<TrackBillRow label="Wallet used" value={'−'+currency(bill?bill.walletCreditPaise/100:o.walletAmountUsed)}/>}{!!bill?.bonusCreditPaise&&<TrackBillRow label="Checkout bonus" value={'−'+currency(bill.bonusCreditPaise/100)}/>}</>}</View>{o.billingSnapshot?.distance&&<Body muted>Estimated delivery distance · {o.billingSnapshot.distance.billingDistanceKm} km</Body>}<View style={track.billTotal}><Heading>Grand total</Heading><Text style={track.total}>{currency(bill?bill.payablePaise/100:o.total)}</Text></View></View>
 <OrderPanel tone="sage"><Text style={track.eyebrow}>PAYMENT STATUS</Text><Heading>{nice(o.paymentStatus)}</Heading></OrderPanel>
 {!backendPaymentRecorded(o.paymentStatus)&&!['cancelled','rejected','expired'].includes(o.status)&&<Button title="Continue payment" onPress={()=>navigation.navigate('Payment',{id:o.id,kind:'order',amount:Number(o.total)})}/>}
 {token&&!endedOrder(o.status)&&<OrderPanel><Field label="Cancellation reason" value={reason} onChangeText={setReason}/><Button title="Cancel order" secondary disabled={busy} onPress={()=>Alert.alert('Cancel this order?','Cancellation eligibility is checked by the server.',[{text:'Keep order',style:'cancel'},{text:'Cancel order',style:'destructive',onPress:()=>void cancel()}])}/></OrderPanel>}
 <OrderPanel tone="peach"><Heading>Here to help</Heading>{(o.chefPhone||o.chef?.phone)&&<Button title="Call the kitchen" secondary onPress={()=>void Linking.openURL('tel:'+(o.chefPhone||o.chef?.phone)).catch(()=>setError('Unable to open the phone app.'))}/>}<Button title="Contact support about this order" secondary onPress={()=>{const configured=settings.data?.supportPhone?.replace(/\D/g,'')||'918169020290';const phone=configured.length===10?'91'+configured:configured;void Linking.openURL('https://wa.me/'+phone+'?text='+encodeURIComponent('RotiHai order support: '+o.id+' · '+o.status)).catch(()=>setError('Unable to open support.'));}}/></OrderPanel>
 <Button title="Back to Home" secondary onPress={()=>navigation.navigate('Tabs',{screen:'Home'})}/><ErrorView error={error||order.error}/></Page>;
}


function TrackBillRow({label,value}:{label:string;value:string}){return <View style={track.billRow}><Body muted>{label}</Body><Text style={track.price}>{value}</Text></View>;}
const track=StyleSheet.create({
 hero:{backgroundColor:'#fff0d9',borderWidth:1,borderBottomWidth:5,borderColor:'#ead3b2',borderRadius:24,padding:22,gap:10,shadowColor:'#9b5a24',shadowOffset:{width:0,height:7},shadowOpacity:.12,shadowRadius:14,elevation:3},
 eyebrow:{fontFamily:t.semibold,fontSize:10,letterSpacing:1.4,color:'#9a6a35'},
 status:{fontFamily:t.bold,fontSize:26,letterSpacing:-.6,color:'#503921'},
 reference:{fontFamily:t.font,fontSize:11,lineHeight:18,color:'#826e58'},
 item:{flexDirection:'row',gap:12,alignItems:'center',paddingVertical:8},
 quantity:{backgroundColor:'#fff1dd',borderRadius:8,padding:8},quantityText:{fontFamily:t.bold,fontSize:12,color:'#8a5d2a'},
 itemName:{fontFamily:t.medium,fontSize:14,lineHeight:21,color:t.ink},price:{fontFamily:t.semibold,fontSize:13,color:t.ink},
 bill:{borderRadius:22,overflow:'hidden',borderWidth:1,borderBottomWidth:4,borderColor:'#e7d6bf',backgroundColor:'#fffdf9',elevation:2,shadowColor:'#8c572c',shadowOffset:{width:0,height:5},shadowOpacity:.09,shadowRadius:12},
 billHeader:{backgroundColor:'#fff1db',padding:18,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
 billBody:{padding:18,gap:12},billRow:{flexDirection:'row',justifyContent:'space-between',gap:16},
 billTotal:{padding:18,borderTopWidth:1,borderStyle:'dashed',borderColor:'#dcc5a3',backgroundColor:'#fff7eb',flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
 total:{fontFamily:t.bold,fontSize:23,color:'#704521'}
});

function orderTone(status:string){
 if(status==='delivered')return {bg:'#e6f2e9',ink:'#316b49'};
 if(['cancelled','rejected','expired'].includes(status))return {bg:'#f9e8e3',ink:'#a34b3b'};
 return {bg:'#fff0d6',ink:'#956020'};
}
function OrderPanel({children,tone='cream'}:{children:React.ReactNode;tone?:'cream'|'sage'|'peach'}){
 return <View style={[cards.panel,{backgroundColor:tone==='sage'?'#f3f8f1':tone==='peach'?'#fff2e9':'#fffdf8',borderColor:tone==='sage'?'#dce8d7':tone==='peach'?'#f1d9c8':'#eaddcb'}]}>{children}</View>;
}
const cards=StyleSheet.create({
 order:{backgroundColor:'#fffdf9',borderRadius:24,borderWidth:1,borderBottomWidth:4,borderColor:'#ead9c5',shadowColor:'#865126',shadowOffset:{width:0,height:6},shadowOpacity:.12,shadowRadius:13,elevation:3,marginVertical:3},
 top:{padding:17,flexDirection:'row',alignItems:'center',gap:11,flexWrap:'wrap'},
 kitchenIcon:{width:44,height:44,borderRadius:15,backgroundColor:'#ffedd9',alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:'#f6d6ae'},
 kitchen:{fontFamily:t.bold,fontSize:16,lineHeight:22,color:'#473225'},meta:{fontFamily:t.font,fontSize:11,lineHeight:17,color:'#877566'},
 badge:{paddingHorizontal:10,paddingVertical:7,borderRadius:12,maxWidth:'100%'},badgeText:{fontFamily:t.semibold,fontSize:11,lineHeight:16},
 meals:{marginHorizontal:17,padding:13,borderRadius:14,backgroundColor:'#f8f3eb',gap:8},mealText:{fontFamily:t.medium,fontSize:13,lineHeight:21,color:'#5e4d3f'},
 bottom:{padding:17,flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:12},totalLabel:{fontFamily:t.semibold,fontSize:9,letterSpacing:1.2,color:'#9a7c5e'},amount:{fontFamily:t.bold,fontSize:21,color:'#503824',marginTop:3},
 trackAction:{flexDirection:'row',gap:8,alignItems:'center',backgroundColor:'#fff0df',paddingHorizontal:14,paddingVertical:12,borderRadius:14},trackText:{fontFamily:t.bold,fontSize:12,color:t.primary},
 panel:{borderRadius:22,borderWidth:1,borderBottomWidth:3,padding:19,gap:12,shadowColor:'#8c643c',shadowOffset:{width:0,height:4},shadowOpacity:.07,shadowRadius:10,elevation:2}
});
