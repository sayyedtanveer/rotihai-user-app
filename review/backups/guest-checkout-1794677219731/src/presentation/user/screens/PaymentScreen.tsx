import {orderForCustomer} from '../../../application/user/orders/orderRules';
import {launchSavedPayment} from '../../../application/user/payments/launchSavedPayment';
import React,{useEffect,useRef,useState} from 'react';
import {Alert,AppState,Linking,Platform,Pressable,Text,View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useQueryClient} from '@tanstack/react-query';
import {useApi,useCustomer} from '../../../core/providers/CustomerProvider';
import {requireConnection,useConnectivity} from '../../../core/api/connectivity';
import {pendingPayment} from '../../../core/storage/pendingPayment';
import {manualReferenceEndpoint,backendPaymentRecorded,buildWebUpiUri,canClearPaidBasket,paymentAppUri,paymentStatusLabel,validatePayableAmount,type PendingPayment} from '../../../application/user/payments/paymentRules';
import {useCart} from '../../../application/user/cart/CartProvider';
import type {Order,PaymentSettings,Schedule} from '../../../core/api/models';
import type {Routes} from '../navigation/types';
import {PaymentQR} from '../components/PaymentQR';
import {Page,Title,Heading,Body,Card,Button,Field,Toggle,ErrorView,Loading,currency} from '../components/UI';
import {Icon} from '../components/BrandUI';
import {theme as t} from '../theme/theme';
export function PaymentScreen({route,navigation}:NativeStackScreenProps<Routes,'Payment'>){
 const {id,kind}=route.params,{request,user}=useCustomer(),client=useQueryClient(),cart=useCart(),online=useConnectivity();
 const settings=useApi<PaymentSettings>('/api/payment-settings');
 const order=useApi<Order>('/api/orders/'+encodeURIComponent(id),{enabled:kind==='order',interval:10000});
 const subscriptions=useApi<Schedule>('/api/subscriptions/'+encodeURIComponent(id)+'/schedule',{enabled:kind==='subscription',interval:10000});
 const subscription=subscriptions.data?.subscription;
 const record=kind==='order'?order.data:subscription;
 const amount=kind==='order'?Number(order.data?.total):Number(subscription?.finalAmount??subscription?.totalAmount??subscription?.price??subscriptions.data?.plan?.price);
 const [paid,setPaid]=useState(false),[transaction,setTransaction]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),[attempt,setAttempt]=useState<PendingPayment|null>(null),[qr,setQr]=useState(false),[gpay,setGpay]=useState<boolean|null>(null),[otherUpi,setOtherUpi]=useState<boolean|null>(null),[ready,setReady]=useState(false);
 const lock=useRef(false),resumeLock=useRef(false),wasOnline=useRef(online);
 const status=kind==='order'?order.data?.paymentStatus:subscription?.isPaid?'paid':subscription?.paymentTransactionId?'pending_verification':'pending';
 const recorded=backendPaymentRecorded(status),closed=['cancelled','rejected','expired'].includes(record?.status||'');
 const unsafeRepeat=status==='pending_verification'||!!attempt&&['launching','returned','reported'].includes(attempt.phase);
 let intent='';try{if(settings.data)intent=buildWebUpiUri(settings.data);}catch{}
 useEffect(()=>{let alive=true;setReady(false);setAttempt(null);setTransaction('');setPaid(false);void pendingPayment.read(user.id).then(p=>{if(!alive)return;if(p?.id===id&&p.kind===kind){setAttempt(p);setTransaction(p.reference||'');setPaid(p.phase==='reported');}setReady(true);}).catch(()=>{if(alive)setError('Could not restore your payment reference. Open Saved checkout before attempting another payment.');});return()=>{alive=false;};},[id,kind,user.id]);
 useEffect(()=>{if(!intent)return;let alive=true;void Promise.all([Linking.canOpenURL(paymentAppUri(intent,Platform.OS,'gpay')).catch(()=>false),Linking.canOpenURL(intent).catch(()=>false)]).then(([g,u])=>{if(alive){setGpay(g);setOtherUpi(u);}});return()=>{alive=false;};},[intent]);
 async function freshRecord(){
  await requireConnection();
  const value=kind==='order'?await request<Order>('/api/orders/'+encodeURIComponent(id),undefined,undefined,{'X-RotiHai-Require-Fresh':'1'}):await request<Schedule>('/api/subscriptions/'+encodeURIComponent(id)+'/schedule',undefined,undefined,{'X-RotiHai-Require-Fresh':'1'});
  if(kind==='order'&&!orderForCustomer(value as Order,user))throw new Error('This order is unavailable for your account.');
  client.setQueryData(['customer',user.id,kind==='order'?'/api/orders/'+encodeURIComponent(id):'/api/subscriptions/'+encodeURIComponent(id)+'/schedule'],value);
  return kind==='order'?value as Order:(value as Schedule).subscription;
 }
 async function reconcile(){
  if(resumeLock.current)return;resumeLock.current=true;
  try{
   const latest=await freshRecord();const paidStatus=kind==='order'?(latest as Order).paymentStatus:(latest as Schedule['subscription']).isPaid?'paid':'pending';
   const saved=await pendingPayment.read(user.id);
   if(saved?.id===id){
    const next={...saved,phase:['cancelled','rejected','expired'].includes(latest.status)?'closed' as const:backendPaymentRecorded(paidStatus)?'backend_recorded' as const:saved.phase==='launching'?'returned' as const:saved.phase};await pendingPayment.save(user.id,next);setAttempt(next);
    if(backendPaymentRecorded(paidStatus)&&saved.cartKey){const group=cart.groups.find(g=>g.key===saved.cartKey);if(group&&canClearPaidBasket(saved,group.items))cart.clear(saved.cartKey);}
   }
  }catch(e){setError((e as Error).message+' Your payment reference is saved; do not pay again until its status is checked.');}finally{resumeLock.current=false;}
 }
 useEffect(()=>{let previous=AppState.currentState;const listener=AppState.addEventListener('change',next=>{if(next==='active'&&previous!=='active')void reconcile();previous=next;});return()=>listener.remove();},[id,kind,user.id,cart.groups]);
 useEffect(()=>{if(ready&&record)void reconcile();},[ready,status,record?.status]);
 useEffect(()=>{if(online&&!wasOnline.current&&ready&&record)void reconcile();wasOnline.current=online;},[online,ready]);
 const run=async(fn:()=>Promise<void>)=>{if(lock.current)return;lock.current=true;setBusy(true);setError(null);try{await fn();}catch(e){setError((e as Error).message);}finally{lock.current=false;setBusy(false);}};
 const details=()=>kind==='order'?navigation.replace('OrderDetails',{id}):navigation.replace('SubscriptionDetails',{id});
 async function launch(app:'gpay'|'upi'){
  if(!ready)throw new Error('Your saved checkout is still loading.');
  const latest=await freshRecord();
  if(kind==='subscription'&&(latest as Schedule['subscription']).paymentTransactionId)throw new Error('Your payment reference is awaiting admin review. Do not pay again.');
  if(['cancelled','rejected','expired'].includes(latest.status))throw new Error('This order or subscription can no longer be paid.');
  if(kind==='order'?backendPaymentRecorded((latest as Order).paymentStatus):(latest as Schedule['subscription']).isPaid){await reconcile();return;}
  const freshSettings=await request<PaymentSettings>('/api/payment-settings',undefined,undefined,{'X-RotiHai-Require-Fresh':'1'});
  const currentAmount=validatePayableAmount(kind==='order'?(latest as Order).total:(latest as Schedule['subscription']).finalAmount??(latest as Schedule['subscription']).totalAmount??(latest as Schedule['subscription']).price??subscriptions.data?.plan?.price);
  if(currentAmount!==amount)throw new Error('The payable total changed. Review the refreshed order before paying.');
  const uri=paymentAppUri(buildWebUpiUri(freshSettings),Platform.OS,app);
  if(!await Linking.canOpenURL(uri))throw new Error(app==='gpay'?'GPay is unavailable. Use another compatible UPI app or scan the QR code.':'No compatible UPI app was found. Scan the QR code from another device.');
  const saved=await pendingPayment.read(user.id);if(saved&&saved.id!==id&&['launching','returned','reported'].includes(saved.phase))throw new Error('Another payment is awaiting reconciliation. Open Saved checkout first.');
  if(saved?.id===id&&['launching','returned','reported'].includes(saved.phase))throw new Error('A payment may already have been made. Check its status before another attempt.');
  const next:PendingPayment={...(saved?.id===id?saved:{}),id,kind,amount:currentAmount,phase:'launching',createdAt:saved?.id===id?saved.createdAt:new Date().toISOString(),deliveryAddress:kind==='order'?(latest as Order).address:subscription?.address};
  await launchSavedPayment(next,{save:async value=>{await pendingPayment.save(user.id,value);setAttempt(value);},markInitiated:()=>kind==='order'?request<void>('/api/orders/'+encodeURIComponent(id)+'/payment-initiated',{}):Promise.resolve(),open:()=>Linking.openURL(uri)});
 }
 async function report(){
  if(kind==='subscription'&&!transaction.trim())throw new Error('Enter the UPI transaction/reference ID for admin review.');
  const latest=await freshRecord();
  if(['cancelled','rejected','expired'].includes(latest.status))throw new Error('This order can no longer accept a payment report.');
  if(kind==='order'?backendPaymentRecorded((latest as Order).paymentStatus):(latest as Schedule['subscription']).isPaid){await reconcile();return;}
  if(kind==='subscription'&&(latest as Schedule['subscription']).paymentTransactionId){
    await reconcile();throw new Error('A payment reference is already awaiting admin review. Check its status or contact support.');
  }
  const existing=await pendingPayment.read(user.id);
  const next:PendingPayment={...(existing?.id===id?existing:{}),id,kind,amount:validatePayableAmount(kind==='order'?(latest as Order).total:(latest as Schedule['subscription']).finalAmount??(latest as Schedule['subscription']).totalAmount??(latest as Schedule['subscription']).price??subscriptions.data?.plan?.price),createdAt:existing?.id===id?existing.createdAt:new Date().toISOString(),phase:'reported',reference:transaction.trim()||undefined};
  await pendingPayment.save(user.id,next);setAttempt(next);setQr(false);
  const endpoint=manualReferenceEndpoint(kind,id);
  if(endpoint){await request(endpoint,{paymentTransactionId:transaction.trim()});const sent={...next,referenceSubmitted:true};await pendingPayment.save(user.id,sent);setAttempt(sent);await client.invalidateQueries({queryKey:['customer']});}
  // The web legacy payment-confirmed route marks paid from a declaration.
  // Preserve manual verification: record the report locally and offer an explicit
  // support handoff. Never call that route as proof of bank settlement.
 }
 async function allowRetry(){
  const latest=await freshRecord();
  if(kind==='subscription'&&(latest as Schedule['subscription']).paymentTransactionId)throw new Error('Your reference is awaiting admin review. Contact support before paying again.');
  if(['cancelled','rejected','expired'].includes(latest.status)||(kind==='order'?backendPaymentRecorded((latest as Order).paymentStatus):(latest as Schedule['subscription']).isPaid)){await reconcile();return;}
  const current=await pendingPayment.read(user.id);
  if(current?.id===id){const next={...current,phase:'ready' as const};await pendingPayment.save(user.id,next);setAttempt(next);setPaid(false);}
 }
 if(settings.isPending||(kind==='order'&&order.isPending)||(kind==='subscription'&&subscriptions.isPending))return <Loading/>;
 if(kind==='order'&&order.data&&!orderForCustomer(order.data,user))return <Page><Title>Payment unavailable</Title><Body>This order is unavailable for your account.</Body></Page>;
 return <Page><Text style={{fontFamily:t.semibold,color:t.primary,fontSize:10,letterSpacing:1.4}}>ONE LAST STEP</Text><Title>{closed?'Payment unavailable':recorded?'Payment recorded':'Complete your payment'}</Title>
 <View style={{padding:14,borderRadius:13,backgroundColor:recorded?'#edf7ef':t.pale,flexDirection:'row',gap:10,alignItems:'center'}}><Icon name={recorded?'check':'clock'} color={recorded?t.success:t.primary} size={19}/><View style={{flex:1,gap:3}}><Text style={{fontFamily:t.semibold,color:t.ink,fontSize:12}}>{paymentStatusLabel(status||'pending',attempt?.phase==='reported')}</Text>{attempt?.phase==='reported'&&<Text style={{fontFamily:t.font,fontSize:10,lineHeight:16,color:t.muted}}>{attempt.referenceSubmitted?'Your reference was sent to RotiHai. Admin confirmation is pending.':'Saved on this device. Share your payment reference with RotiHai support for confirmation.'}</Text>}</View></View>
 <Card><Text style={{fontFamily:t.medium,color:t.muted,fontSize:11}}>PAYABLE TO {settings.data?.merchantName||'ROTIHAI'}</Text><Text style={{fontFamily:t.display,color:t.ink,fontSize:31,letterSpacing:-1}}>{Number.isFinite(amount)?currency(amount):'Refresh total'}</Text><Body muted>Order reference · {id}</Body>{settings.data?.upiId&&<Body>{settings.data.upiId}</Body>}<Body muted>Enter this exact amount in your UPI app. RotiHai uses the same payment request as its web app.</Body></Card>
 {kind==='order'&&order.data&&<Card><Heading>Your meal & bill</Heading>{order.data.items?.map((item,i)=><View key={i} style={{flexDirection:'row',gap:12,justifyContent:'space-between'}}><Text style={{fontFamily:t.font,fontSize:12,color:t.ink,flex:1}}>{item.quantity} × {item.name}</Text><Text style={{fontFamily:t.medium,fontSize:12,color:t.ink}}>{currency(item.price*item.quantity)}</Text></View>)}<Body muted>{order.data.address}</Body><Body>Items · {currency(order.data.subtotal)}</Body><Body>Delivery · {currency(order.data.deliveryFee)}</Body>{Number(order.data.platformFee)>0&&<Body>Platform fee · {currency(order.data.platformFee)}</Body>}<Body>Discount · −{currency(order.data.discount)}</Body>{Number(order.data.walletAmountUsed)>0&&<Body>Wallet · −{currency(order.data.walletAmountUsed)}</Body>}<Heading>Total · {currency(order.data.total)}</Heading></Card>}
 <ErrorView error={error||settings.error||order.error||subscriptions.error} retry={()=>void run(reconcile)}/>
 {!recorded&&!closed&&record&&<><Button title={gpay===false?'GPay unavailable on this device':'Pay '+currency(amount)+' with GPay'} disabled={busy||!online||!ready||!intent||gpay!==true||unsafeRepeat} onPress={()=>void run(()=>launch('gpay'))}/>
 {otherUpi&&<Button title="Open another UPI app" secondary disabled={busy||!online||!ready||!intent||unsafeRepeat} onPress={()=>void run(()=>launch('upi'))}/>}
 {intent&&!unsafeRepeat&&<><Button title={qr?'Hide UPI QR code':'Scan a UPI QR code'} secondary disabled={busy} onPress={()=>setQr(!qr)}/>{qr&&<Card><View style={{alignItems:'center'}}><PaymentQR value={intent}/></View><Body muted>Pay exactly {currency(amount)}. Do not start a second payment if money has already been debited.</Body></Card>}</>}
 <Button title="Check payment status" secondary disabled={busy||!online} onPress={()=>void run(reconcile)}/>
 {unsafeRepeat&&<Card><Heading>Already tried paying?</Heading><Body muted>Returning from GPay does not confirm payment. Check status or share your reference with support. Your checkout is saved.</Body><Button title="I was not debited · review retry" secondary disabled={busy||!online} onPress={()=>Alert.alert('Check your bank first','Only retry if no money was debited. RotiHai cannot independently verify a cancelled or failed app payment.',[{text:'Keep checking',style:'cancel'},{text:'Review a new attempt',onPress:()=>void run(allowRetry)}])}/></Card>}
 <Field label="UPI transaction/reference ID" value={transaction} onChangeText={setTransaction} autoCapitalize="none" maxLength={100}/><Toggle title="I have completed this payment" value={paid} onChange={setPaid}/>
 <Button title={kind==='subscription'?'Submit reference for admin review':'Save payment reference for confirmation'} disabled={busy||!online||!paid||!Number.isFinite(amount)||status==='pending_verification'} onPress={()=>void run(report)}/>
 {(attempt?.phase==='reported'||status==='pending_verification')&&<Button title="Contact support with payment reference" secondary onPress={()=>{const number=settings.data?.supportPhone?.replace(/\D/g,'');const phone=number?number.length===10?'91'+number:number:'918169020290';const message='RotiHai payment confirmation request. Order: '+id+'. Amount: '+currency(amount)+'. Reference: '+(attempt?.reference||subscription?.paymentTransactionId||'not provided')+'. Please check payment status.';void Linking.openURL('https://wa.me/'+phone+'?text='+encodeURIComponent(message)).catch(()=>setError('Unable to open support. Keep your order and payment reference handy.'));}}/>}
 <Body muted>Payment reports are not bank settlement verification. Only the backend can confirm the order and payment status.</Body></>}
 <Button title={recorded||closed?'View order status':'Continue later · keep checkout saved'} secondary onPress={details}/>
 {kind==='order'&&!closed&&!recorded&&<Button title="Review cancellation options" secondary onPress={()=>navigation.navigate('OrderDetails',{id})}/>}
 </Page>;
}
