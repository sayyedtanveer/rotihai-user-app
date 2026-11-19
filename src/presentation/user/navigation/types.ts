import { useNavigation, type NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
export type Tabs = { Home: undefined; Explore: undefined; Orders: undefined; Account: undefined };
export type Routes = {
  Tabs: NavigatorScreenParams<Tabs> | undefined; Catalog: { chefId?: string; categoryId?: string; title?: string; vegetarian?: boolean };
  Product: { id: string }; Checkout: { cartKey: string }; Payment: { id: string; kind: 'order' | 'subscription'; amount?: number };
  OrderDetails: { id: string }; SubscriptionDetails: { id: string }; Subscribe: { planId: string };
  CustomSubscription: undefined; Profile: undefined; Wallet: undefined; Referrals: undefined;
  Recovery: undefined; Notifications: undefined; Address: {checkoutCartKey?:string}|undefined; Privacy: undefined;
  Cart: undefined; Subscriptions: undefined; DeliveryArea: undefined;
};
export const useAppNavigation = () => useNavigation<NativeStackNavigationProp<Routes>>();

