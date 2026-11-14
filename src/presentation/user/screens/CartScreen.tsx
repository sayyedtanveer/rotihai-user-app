import {restoreCartItems} from '../../../application/user/cart/restoreCart';
import {cartSignature} from '../../../application/user/payments/paymentRules';
import {requireConnection} from '../../../core/api/connectivity';
import type {Chef} from '../../../core/api/models';
import {basketDestination} from '../../../application/user/cart/checkoutJourney';
import {useCustomer} from '../../../core/providers/CustomerProvider';
import React,{useRef,useState} from 'react';
import {Alert,Pressable,Text,View} from 'react-native';
import {useDiscovery} from '../hooks/useDiscovery';
import {useCart} from '../../../application/user/cart/CartProvider';
import {lineTotal} from '../../../application/user/cart/cartRules';
import {cartItemIssue} from '../../../application/user/catalog/menuRules';
import {useAppNavigation} from '../navigation/types';
import {useDeliveryArea} from '../../../core/location/DeliveryAreaProvider';
import {Page,Title,Card,Heading,Body,Button,Field,ErrorView,Loading,Empty,currency,QuantityControl,Photo} from '../components/UI';
import {Icon} from '../components/BrandUI';
import {theme as t} from '../theme/theme';
export function CartScreen(){
 const cart=useCart(),nav=useAppNavigation(),d=useDiscovery(),{area}=useDeliveryArea(),{deliveryAddress,request}=useCustomer();
 const [error,setError]=useState<string|null>(null),[instructions,setInstructions]=useState<string|null>(null);
 const [refreshing,setRefreshing]=useState(''),refreshLock=useRef(false),latestItems=useRef(cart.items);latestItems.current=cart.items;
 const refreshBasket=async(group:typeof cart.groups[number])=>{
  if(refreshLock.current)return;refreshLock.current=true;setRefreshing(group.key);setError(null);
  const original=cartSignature(cart.items);
  try{
   await requireConnection();
   const fresh=<T,>(path:string)=>request<T>(path,undefined,'GET',{'X-RotiHai-Require-Fresh':'1'});
   const location=deliveryAddress||area;if(!location)throw new Error('Choose your delivery area first.');
   const chefs=await fresh<Chef[]>('/api/chefs/by-location?latitude='+location.latitude+'&longitude='+location.longitude);
   const items=await restoreCartItems(group,fresh,{serviceableChefIds:chefs.map(chef=>chef.id)});
   if(cartSignature(latestItems.current)!==original)throw new Error('Your basket changed while refreshing. Check it and refresh again.');
   cart.restore(items);void d.refresh();
  }catch(e){setError((e as Error).message);}finally{refreshLock.current=false;setRefreshing('');}
 };
 const change=(key:string,quantity:number)=>{try{cart.quantity(key,quantity);setError(null);}catch(e){setError((e as Error).message);}};
 if(!cart.ready)return <Loading/>;
 return <Page><Text style={{fontFamily:t.semibold,color:t.primary,fontSize:10,letterSpacing:1.5}}>FRESHLY PICKED BY YOU</Text><Title>Your basket of comfort.</Title><Body muted>Each kitchen and category has a separate checkout.</Body><ErrorView error={error||cart.error}/>
 {!cart.groups.length?<><Empty title="Good food is a tap away" subtitle="Explore nearby kitchens and add something you'll love."/><Button title="Find your next meal" onPress={()=>nav.navigate('Tabs',{screen:'Home'})}/></>:<>
 <Pressable accessibilityRole="button" onPress={()=>nav.navigate('DeliveryArea')} style={{padding:15,borderRadius:15,backgroundColor:t.pale,flexDirection:'row',alignItems:'center',gap:12}}><Icon name="pin" color={t.primary}/><View style={{flex:1,gap:3}}><Text style={{fontFamily:t.semibold,color:t.ink,fontSize:12}}>Browsing for {area?.area}</Text><Text style={{fontFamily:t.font,color:t.muted,fontSize:11}}>Full delivery address is confirmed at checkout</Text></View><Icon name="chevron" size={16}/></Pressable>
 {cart.groups.map(group=>{const issues=group.items.map(item=>cartItemIssue(item,d.dishes,d.kitchens));const unavailable=issues.some(Boolean);return <Card key={group.key}>
 <View style={{flexDirection:'row',gap:12,alignItems:'center'}}><View style={{width:38,height:38,borderRadius:12,backgroundColor:t.pale,alignItems:'center',justifyContent:'center'}}><Icon name="home" color={t.primary} size={19}/></View><View style={{flex:1,gap:3}}><Heading>{group.chefName}</Heading><Body muted>{group.categoryName}</Body></View><Pressable accessibilityRole="button" accessibilityLabel={'Add more food from '+group.chefName} onPress={()=>nav.navigate('Catalog',{chefId:group.chefId,categoryId:group.categoryId,title:group.chefName})} style={{padding:7}}><Text style={{fontFamily:t.bold,color:t.primary,fontSize:11}}>Add more</Text></Pressable></View>
 {group.items.map((item,index)=><View key={item.key} style={{paddingTop:16,borderTopWidth:1,borderColor:t.border,gap:10}}>
 <View style={{flexDirection:'row',gap:12}}>{item.image&&<View style={{width:54}}><Photo uri={item.image} height={54}/></View>}<View style={{flex:1,gap:4}}><Text style={{fontFamily:t.semibold,color:t.ink,fontSize:14,lineHeight:21}}>{item.name}</Text>{item.variantName&&<Text style={{fontFamily:t.font,color:t.muted,fontSize:11}}>{item.variantName}</Text>}<Text style={{fontFamily:t.semibold,color:t.ink,fontSize:13}}>{currency(lineTotal(item))}</Text></View></View>
 <View style={{flexDirection:'row',gap:12,alignItems:'center',justifyContent:'space-between'}}><Text style={{flex:1,fontFamily:t.font,color:t.muted,fontSize:11,lineHeight:17}}>{currency(item.price)} each{item.offer||item.offerPercentage?' before offers':''}</Text><QuantityControl label={item.name} quantity={item.quantity} disabled={!!issues[index]} onMinus={()=>change(item.key,item.quantity-1)} onPlus={()=>change(item.key,item.quantity+1)}/></View>
 {issues[index]&&!d.loading&&<Text style={{fontFamily:t.medium,color:t.danger,fontSize:11,lineHeight:17}}>{issues[index]} · Remove this dish or change your area.</Text>}
 <View style={{flexDirection:'row',justifyContent:'space-between'}}><Pressable accessibilityRole="button" onPress={()=>setInstructions(instructions===item.key?null:item.key)} style={{paddingVertical:7}}><Text style={{fontFamily:t.medium,color:t.muted,fontSize:11}}>{item.specialInstructions?'Edit cooking note':'Add a cooking note'}</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel={'Remove '+item.name} onPress={()=>change(item.key,0)} style={{padding:7}}><Text style={{fontFamily:t.medium,color:t.danger,fontSize:11}}>Remove</Text></Pressable></View>
 {instructions===item.key&&<Field label="Note for the kitchen" multiline value={item.specialInstructions||''} maxLength={300} onChangeText={text=>cart.instructions(item.key,text)}/>}
 </View>)}
 <View style={{height:1,backgroundColor:t.border}}/><View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}><Text style={{fontFamily:t.semibold,color:t.ink,fontSize:13}}>Item total</Text><Heading>{currency(group.items.reduce((sum,item)=>sum+lineTotal(item),0))}</Heading></View><Body muted>Delivery charges, offers and credits are reviewed at checkout.</Body>
 <Button title={refreshing===group.key?'Refreshing current menu…':'Refresh prices & availability'} secondary disabled={!!refreshing} onPress={()=>void refreshBasket(group)}/>
 <Button title={d.loading?'Checking availability…':'Review delivery & bill'} disabled={!!refreshing||d.loading||!!d.error||unavailable} onPress={()=>{const next=basketDestination(group.key,deliveryAddress);if(next.name==='Address')nav.navigate('Address',next.params);else nav.navigate('Checkout',next.params);}}/>
 <Pressable accessibilityRole="button" onPress={()=>Alert.alert('Clear this basket?',group.chefName,[{text:'Keep basket',style:'cancel'},{text:'Clear',style:'destructive',onPress:()=>cart.clear(group.key)}])} style={{padding:9,alignItems:'center'}}><Text style={{fontFamily:t.medium,color:t.muted,fontSize:11}}>Clear this basket</Text></Pressable>
 </Card>;})}<ErrorView error={d.error} retry={()=>void d.refresh()}/></>}
 </Page>;
}
