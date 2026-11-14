import {useReducedMotion} from '../hooks/useReducedMotion';
import React,{useCallback,useEffect,useRef,useState} from 'react';
import {Animated,AppState,Easing,Pressable,Text,View} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {useQuery} from '@tanstack/react-query';
import {useCustomer} from '../../../core/providers/CustomerProvider';
import {pendingPayment} from '../../../core/storage/pendingPayment';
import {guestReceiptMatches,type PendingPayment} from '../../../application/user/payments/paymentRules';
import {activeOrderVisible,activeOrderPresentation} from '../../../application/user/orders/orderRules';
import type {Order} from '../../../core/api/models';
import {useAppNavigation} from '../navigation/types';
import {Card,Heading,Body,Button,currency,nice} from './UI';
import {Icon} from './BrandUI';
import {theme as t} from '../theme/theme';
export function SavedPaymentCard(){
 const {user,token,request}=useCustomer(),nav=useAppNavigation(),[saved,setSaved]=useState<PendingPayment|null>(null);
 const active=useQuery({queryKey:['customer',user.id,'/api/orders/active',saved?.id],queryFn:async()=>{
  if(token){const result=await request<{order:Order}|null>('/api/orders/active');return result?.order||null;}
  if(!saved?.guestReceipt||saved.kind!=='order')return null;
  const order=await request<Order>('/api/orders/'+encodeURIComponent(saved.id));
  return guestReceiptMatches(order,saved)?order:null;
 },enabled:!!token||!!saved?.guestReceipt,refetchInterval:20000});
 useFocusEffect(useCallback(()=>{let alive=true;const refresh=async()=>{try{const p=await pendingPayment.read(user.id);if(alive){setSaved(p);if(token||p?.guestReceipt)void active.refetch();}}catch{if(alive)setSaved(null);}};void refresh();const sub=AppState.addEventListener('change',state=>{if(state==='active')void refresh();});return()=>{alive=false;sub.remove();};},[token,user.id,saved?.id]));
 const order=active.data;
 if(!active.error&&order&&activeOrderVisible(order)){
  const presentation=activeOrderPresentation(order.status,order.paymentStatus);
  return <View accessibilityLiveRegion="polite" style={{paddingHorizontal:16,paddingVertical:12,backgroundColor:presentation.background,borderTopWidth:1,borderColor:presentation.color+'30',flexDirection:'row',alignItems:'center',gap:12,boxShadow:'0px -3px 16px rgba(0,0,0,0.07)'}}>
   <View style={{width:36,height:36,borderRadius:18,backgroundColor:'#fff',borderWidth:1,borderColor:presentation.color+'30',alignItems:'center',justifyContent:'center'}}><Icon name={presentation.icon} size={19} color={presentation.color}/><ActiveOrderDot/></View>
   <View style={{flex:1,gap:4}}><Text style={{fontFamily:t.semibold,fontSize:10,letterSpacing:1,color:t.muted}}>ACTIVE ORDER</Text><Text numberOfLines={2} style={{fontFamily:t.medium,fontSize:12,lineHeight:18,color:presentation.color}}>{presentation.label}</Text></View>
   <Pressable accessibilityRole="button" accessibilityLabel={presentation.paymentPending?'Complete payment for your order':'Track your active order'} onPress={()=>presentation.paymentPending?nav.navigate('Payment',{id:order.id,kind:'order',amount:Number(order.total)}):nav.navigate('OrderDetails',{id:order.id})} style={{minHeight:44,paddingHorizontal:12,borderRadius:9,borderWidth:1,borderColor:presentation.color+'50',backgroundColor:'#fff',justifyContent:'center'}}><Text style={{fontFamily:t.semibold,fontSize:12,color:presentation.color}}>{presentation.paymentPending?'Pay Now':'Track'} →</Text></Pressable>
   {presentation.paymentPending&&!!token&&<Pressable accessibilityRole="button" accessibilityLabel="Review order cancellation" onPress={()=>nav.navigate('OrderDetails',{id:order.id})} style={{minHeight:44,justifyContent:'center'}}><Text style={{fontFamily:t.medium,fontSize:12,color:t.danger}}>Cancel</Text></Pressable>}
  </View>;
 }
 if(!saved||['backend_recorded','closed'].includes(saved.phase))return null;
 return <Card><Heading>Your checkout is saved</Heading><Body muted>{currency(saved.amount)} · Continue your existing checkout.</Body><Button title="Resume checkout" secondary onPress={()=>nav.navigate('Payment',{id:saved.id,kind:saved.kind,amount:saved.amount})}/></Card>;
}

function ActiveOrderDot(){
 const progress=useRef(new Animated.Value(0)).current,reduced=useReducedMotion();
 const [foreground,setForeground]=useState(AppState.currentState==='active');
 useFocusEffect(useCallback(()=>{setForeground(AppState.currentState==='active');const sub=AppState.addEventListener('change',state=>setForeground(state==='active'));return()=>{setForeground(false);sub.remove();};},[]));
 useEffect(()=>{
  progress.setValue(0);
  if(reduced!==false||!foreground)return;
  const animation=Animated.loop(Animated.timing(progress,{toValue:1,duration:1100,easing:Easing.out(Easing.quad),useNativeDriver:true,isInteraction:false}));
  animation.start();
  return()=>{animation.stop();progress.setValue(0);};
 },[progress,reduced,foreground]);
 return <View pointerEvents="none" accessible={false} style={{position:'absolute',right:-3,top:-3,width:14,height:14}}>
  <Animated.View style={{position:'absolute',width:14,height:14,borderRadius:7,backgroundColor:'#4ade80',opacity:reduced||!foreground?0:progress.interpolate({inputRange:[0,.75,1],outputRange:[.65,.2,0]}),transform:[{scale:progress.interpolate({inputRange:[0,1],outputRange:[1,2.8]})}]}}/>
  <View style={{width:14,height:14,borderRadius:7,backgroundColor:'#22c55e',borderWidth:1.5,borderColor:'#fff'}}/>
 </View>;
}
