import React, { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import type * as NotificationTypes from 'expo-notifications';
import Constants from 'expo-constants';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCustomer } from '../../../core/providers/CustomerProvider';
import type { Order } from '../../../core/api/models';
import type { Routes } from './types';
export function NotificationNavigation() {
  const navigation = useNavigation<NativeStackNavigationProp<Routes>>();
  const { request, user, token } = useCustomer();
  const handled = useRef(new Set<string>());
  useEffect(() => {
    if (!token || Constants.executionEnvironment==='storeClient' || (__DEV__ && process.env.EXPO_PUBLIC_UI_REVIEW==='1')) return;
    const Notifications:typeof import('expo-notifications')=require('expo-notifications');
    Notifications.setNotificationHandler({handleNotification:async()=>({shouldShowBanner:true,shouldShowList:true,shouldPlaySound:true,shouldSetBadge:false})});
    let active = true;
    const handle = async (response: NotificationTypes.NotificationResponse | null) => {
      if (!response || !active) return;
      const notification = response.notification.request;
      if (handled.current.has(notification.identifier)) return;
      handled.current.add(notification.identifier);
      const data = notification.content.data || {};
      // Never navigate arbitrary URLs or trust an order ID from a device payload.
      if (typeof data.orderId !== 'string' || (data.userId && data.userId !== user.id)) return;
      try {
        const orders = await request<Order[]>('/api/user/orders');
        if (!active) return;
        if (orders.some(order => order.id === data.orderId)) navigation.navigate('OrderDetails', {id: data.orderId});
        else navigation.navigate('Tabs', {screen: 'Orders'});
        await Notifications.clearLastNotificationResponseAsync();
      } catch { if (active) Alert.alert('Unable to open order', 'Open Your orders to refresh its status.'); }
    };
    const listener = Notifications.addNotificationResponseReceivedListener(response => { void handle(response); });
    void Notifications.getLastNotificationResponseAsync().then(handle).catch(() => {});
    return () => { active = false; listener.remove(); };
  }, [navigation, request, user.id, token]);
  return null;
}
