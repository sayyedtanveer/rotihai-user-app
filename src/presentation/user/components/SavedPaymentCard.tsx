import {useReducedMotion} from '../hooks/useReducedMotion';
import React,{useCallback,useEffect,useRef,useState} from 'react';
import {Animated,AppState,Easing,Keyboard,Pressable,Text,View} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {useQuery} from '@tanstack/react-query';
import {useCustomer} from '../../../core/providers/CustomerProvider';
import {pendingPayment} from '../../../core/storage/pendingPayment';
import {guestReceiptMatches,type PendingPayment} from '../../../application/user/payments/paymentRules';
import {activeOrderVisible,activeOrderPresentation} from '../../../application/user/orders/orderRules';
import type {Order} from '../../../core/api/models';
import {useAppNavigation} from '../navigation/types';
import {currency} from './UI';
import {Icon,StickyCartBar} from './BrandUI';
import {useCart} from '../../../application/user/cart/CartProvider';
import {lineTotal} from '../../../application/user/cart/cartRules';
import {theme as t} from '../theme/theme';
export function SavedPaymentCard(){
 const {user,token,request}=useCustomer(),nav=useAppNavigation(),[record,setRecord]=useState<{owner:string;payment:PendingPayment|null}|null>(null);
 const saved=record?.owner===user.id?record.payment:null,cart=useCart(),count=cart.items.reduce((sum,item)=>sum+item.quantity,0);
 const [keyboard,setKeyboard]=useState(false);
 useEffect(()=>{const show=Keyboard.addListener('keyboardDidShow',()=>setKeyboard(true)),hide=Keyboard.addListener('keyboardDidHide',()=>setKeyboard(false));return()=>{show.remove();hide.remove();};},[]);
 const active=useQuery({queryKey:['customer',user.id,'/api/orders/active',saved?.id],queryFn:async()=>{
  if(token){const result=await request<{order:Order}|null>('/api/orders/active');return result?.order||null;}
  if(!saved?.guestReceipt||saved.kind!=='order')return null;
  const order=await request<Order>('/api/orders/'+encodeURIComponent(saved.id));
  return guestReceiptMatches(order,saved)?order:null;
 },enabled:!!token||!!saved?.guestReceipt,refetchInterval:20000});
 useFocusEffect(useCallback(()=>{let alive=true;const refresh=async()=>{try{const p=await pendingPayment.read(user.id);if(alive){setRecord({owner:user.id,payment:p});if(token||p?.guestReceipt)void active.refetch();}}catch{if(alive)setRecord({owner:user.id,payment:null});}};void refresh();const sub=AppState.addEventListener('change',state=>{if(state==='active')void refresh();});return()=>{alive=false;sub.remove();};},[token,user.id,saved?.id]));
 const order=active.data;
 if(keyboard)return null;
 if(!active.error&&order&&activeOrderVisible(order)){
  const presentation=activeOrderPresentation(order.status,order.paymentStatus);
  return <View accessibilityLiveRegion="polite" style={{marginHorizontal:16,marginBottom:8,paddingHorizontal:12,paddingVertical:10,minHeight:68,backgroundColor:'#fffdfa',borderRadius:18,borderWidth:1,borderColor:'#efd9ba',flexDirection:'row',alignItems:'center',gap:10,boxShadow:'0px 4px 16px rgba(83,48,17,0.10)'}}>
   <View style={{width:30,height:30,borderRadius:15,backgroundColor:presentation.background,alignItems:'center',justifyContent:'center'}}><Icon name={presentation.icon} size={17} color={presentation.color}/><ActiveOrderDot/></View>
   <View style={{flex:1,gap:3}}><Text numberOfLines={2} style={{fontFamily:t.semibold,fontSize:12,lineHeight:15,color:presentation.color}}>{presentation.label}</Text><Text numberOfLines={1} style={{fontFamily:t.font,fontSize:10,color:t.muted}}>Order #{order.id}</Text></View>
   <Pressable accessibilityRole="button" accessibilityLabel="Track your active order" onPress={()=>nav.navigate('OrderDetails',{id:order.id})} style={{minHeight:44,paddingHorizontal:9,borderRadius:11,backgroundColor:t.pale,justifyContent:'center'}}><Text style={{fontFamily:t.bold,fontSize:12,color:t.primary}}>Track →</Text></Pressable>
   {count>0&&<Pressable accessibilityRole="button" accessibilityLabel={'View cart, '+count+' items'} onPress={()=>nav.navigate('Cart')} style={{minHeight:44,paddingLeft:10,borderLeftWidth:1,borderColor:t.border,alignItems:'center',justifyContent:'center',gap:3}}><Icon name="cart" color={t.success} size={18}/><Text style={{fontFamily:t.semibold,fontSize:10,color:t.success}}>{count} in cart</Text></Pressable>}
  </View>;
 }
 if(!saved||['backend_recorded','closed'].includes(saved.phase))return count>0?<StickyCartBar count={count} total={cart.items.reduce((sum,item)=>sum+lineTotal(item),0)} onPress={()=>nav.navigate('Cart')}/>:null;
 return <View style={{marginHorizontal:16,marginBottom:8,padding:12,borderRadius:18,backgroundColor:t.surface,borderWidth:1,borderColor:t.border,flexDirection:'row',alignItems:'center',gap:10}}><View style={{flex:1}}><Text style={{fontFamily:t.semibold,color:t.ink,fontSize:12}}>Checkout saved · {currency(saved.amount)}</Text></View><Pressable accessibilityRole="button" onPress={()=>nav.navigate('Payment',{id:saved.id,kind:saved.kind,amount:saved.amount})} style={{minHeight:44,justifyContent:'center'}}><Text style={{fontFamily:t.bold,color:t.primary}}>Resume →</Text></Pressable>{count>0&&<Pressable accessibilityRole="button" accessibilityLabel="View cart" onPress={()=>nav.navigate('Cart')} style={{minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center'}}><Icon name="cart" color={t.success}/></Pressable>}</View>;
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
