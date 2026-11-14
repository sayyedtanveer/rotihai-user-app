import {ownsGuestOrder,type PendingPayment} from '../../../application/user/payments/paymentRules';
import {pendingPayment} from '../../../core/storage/pendingPayment';
import {resumedNavigationState} from '../../../application/user/auth/entryRules';
import React from 'react';
import {Text} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {theme as t} from '../theme/theme';
import {Icon} from '../components/BrandUI';
import {DeliveryAreaScreen} from '../screens/DeliveryAreaScreen';
import {ExploreScreen} from '../screens/DiscoveryScreen';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {SafeAreaProvider} from 'react-native-safe-area-context';

import {Page,Title,Body,Button,Loading} from '../components/UI';
import {CustomerProvider,useCustomer} from '../../../core/providers/CustomerProvider';
import {CartProvider,useCart} from '../../../application/user/cart/CartProvider';
import type {Routes,Tabs} from './types';
import {CustomerHomeScreen,CatalogScreen,ProductScreen} from '../screens/CatalogScreens';
import {CartScreen} from '../screens/CartScreen';
import {CheckoutScreen} from '../screens/CheckoutScreen';
import {PaymentScreen} from '../screens/PaymentScreen';
import {OrdersScreen,OrderDetailsScreen} from '../screens/OrderScreens';
import {SubscriptionsScreen,SubscribeScreen,SubscriptionDetailsScreen,CustomSubscriptionScreen} from '../screens/SubscriptionScreens';
import {AccountScreen,ProfileScreen,WalletScreen,ReferralsScreen,NotificationsScreen,PrivacyScreen} from '../screens/AccountScreens';
import {NotificationNavigation} from './NotificationNavigation';
import {RecoveryScreen} from '../screens/RecoveryScreen';
import {AddressScreen} from '../screens/AddressScreen';
function protectedScreen(Component: React.ComponentType<any>) { return function Protected(props:any) { const {token,login}=useCustomer(); return token ? <Component {...props}/> : <Page><Title>Continue with your RotiHai account</Title><Body>Sign in to continue. Your basket stays saved.</Body><Button title="Sign in with mobile" onPress={()=>login(['Orders','Account'].includes(props.route.name) ? {name:'Tabs',params:{screen:props.route.name}} : {name:props.route.name,params:props.route.params})}/></Page>; }; }
// Guest access requires the encrypted receipt saved from this device's successful
// public order-creation response. A phone number alone never opens order history.
function receiptProtectedScreen(Component:React.ComponentType<any>){
 const Protected=protectedScreen(Component);
 return function ReceiptProtected(props:any){
  const {token}=useCustomer(),id=props.route.params?.id,kind=props.route.params?.kind||'order';
  const [loaded,setLoaded]=React.useState<{id:string;receipt:PendingPayment|null}|null>(null);
  React.useEffect(()=>{let alive=true;if(!token)void pendingPayment.read('guest').then(receipt=>{if(alive)setLoaded({id,receipt});}).catch(()=>{if(alive)setLoaded({id,receipt:null});});return()=>{alive=false;};},[token,id]);
  if(token)return <Component {...props}/>;
  if(!loaded||loaded.id!==id)return <Loading/>;
  return ownsGuestOrder(loaded.receipt,id,kind)?<Component {...props} guestReceipt={loaded.receipt}/>:<Protected {...props}/>;
 };
}

const Stack=createNativeStackNavigator<Routes>();
const Tab=createBottomTabNavigator<Tabs>();
const ProtectedOrdersScreen=protectedScreen(OrdersScreen);
const ProtectedAccountScreen=protectedScreen(AccountScreen);
const ProtectedSubscriptionsScreen=protectedScreen(SubscriptionsScreen);
const ProtectedCustomSubscriptionScreen=protectedScreen(CustomSubscriptionScreen);
const ProtectedRecoveryScreen=protectedScreen(RecoveryScreen);
const ProtectedReferralsScreen=protectedScreen(ReferralsScreen);
const ProtectedNotificationsScreen=protectedScreen(NotificationsScreen);
const ProtectedWalletScreen=protectedScreen(WalletScreen);
const ProtectedProfileScreen=protectedScreen(ProfileScreen);
const ProtectedPaymentScreen=receiptProtectedScreen(PaymentScreen);
const ProtectedOrderDetailsScreen=receiptProtectedScreen(OrderDetailsScreen);
const ProtectedSubscriptionDetailsScreen=protectedScreen(SubscriptionDetailsScreen);
function CustomerTabs(){return <><NotificationNavigation/><Tab.Navigator screenOptions={({route})=>({headerShown:false,tabBarActiveTintColor:t.primary,tabBarInactiveTintColor:t.muted,tabBarLabelStyle:{fontSize:12,fontWeight:'600'},tabBarIcon:({color})=><Icon color={color} name={route.name==='Home'?'home':route.name==='Explore'?'explore':route.name==='Orders'?'orders':'account'}/>})}>
<Tab.Screen name="Home" component={CustomerHomeScreen}/><Tab.Screen name="Explore" component={ExploreScreen}/><Tab.Screen name="Orders" component={ProtectedOrdersScreen}/><Tab.Screen name="Account" component={AccountScreen}/>
</Tab.Navigator></>;}
export function CustomerNavigator({token,onLogout,onLogin,destination}:{token:string;onLogout:()=>void;onLogin:(destination?:any,contactPhone?:string)=>void;destination?:any}){return <SafeAreaProvider><SafeAreaView style={{flex:1}} edges={['top','left','right']}><CustomerProvider token={token} onLogout={onLogout} onLogin={onLogin}><CartProvider><NavigationContainer initialState={resumedNavigationState(destination)}><Stack.Navigator screenOptions={{headerTintColor:t.primary,headerStyle:{backgroundColor:t.bg},contentStyle:{backgroundColor:t.pale}}}>
 <Stack.Screen name="Tabs" component={CustomerTabs} options={{headerShown:false}}/>
 <Stack.Screen name="Cart" component={CartScreen}/><Stack.Screen name="Subscriptions" component={SubscriptionsScreen}/><Stack.Screen name="DeliveryArea" component={DeliveryAreaScreen} options={{title:'Delivery area'}}/>
 <Stack.Screen name="Catalog" component={CatalogScreen} options={{title:'Menu'}}/><Stack.Screen name="Product" component={ProductScreen} options={{title:'Dish details'}}/>
 <Stack.Screen name="Checkout" component={CheckoutScreen}/><Stack.Screen name="Payment" component={ProtectedPaymentScreen}/><Stack.Screen name="OrderDetails" component={ProtectedOrderDetailsScreen} options={{title:'Order tracking'}}/>
 <Stack.Screen name="Subscribe" component={SubscribeScreen}/><Stack.Screen name="SubscriptionDetails" component={ProtectedSubscriptionDetailsScreen} options={{title:'Manage subscription'}}/><Stack.Screen name="CustomSubscription" component={ProtectedCustomSubscriptionScreen} options={{title:'Custom roti plan'}}/>
 <Stack.Screen name="Recovery" component={ProtectedRecoveryScreen} options={{title:'Saved checkout'}}/>
 <Stack.Screen name="Profile" component={ProtectedProfileScreen}/><Stack.Screen name="Wallet" component={ProtectedWalletScreen}/><Stack.Screen name="Referrals" component={ProtectedReferralsScreen}/><Stack.Screen name="Notifications" component={ProtectedNotificationsScreen}/><Stack.Screen name="Address" component={AddressScreen}/><Stack.Screen name="Privacy" component={PrivacyScreen}/>
 </Stack.Navigator></NavigationContainer></CartProvider></CustomerProvider></SafeAreaView></SafeAreaProvider>;}
