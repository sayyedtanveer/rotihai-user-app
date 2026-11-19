import {deliveryAreaSelection} from './deliveryAreaSelection';
import {provisionalContact} from './provisionalContact';
import {pendingPayment} from './pendingPayment';
import {checkoutAddress} from './checkoutState';
import {forgetCachedProfile} from '../api/offlineCache';
import * as SecureStore from 'expo-secure-store';
const KEY = 'rotihai.customer.access-token';
export const customerSession = {
  read: () => SecureStore.getItemAsync(KEY),
  save: (token: string) => SecureStore.setItemAsync(KEY, token),
  clear: async () => {await SecureStore.deleteItemAsync(KEY);await Promise.all([deliveryAreaSelection.clear(),forgetCachedProfile(),provisionalContact.clear(),pendingPayment.clear('guest'),checkoutAddress.clear('guest')]);},
};
