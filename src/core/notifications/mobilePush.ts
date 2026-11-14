import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { customerApi } from '../api/customerApi';
function nativeNotifications(){if(Constants.executionEnvironment==='storeClient')throw new Error('Push notifications require a native development or store build.');const notifications:typeof import('expo-notifications')=require('expo-notifications');notifications.setNotificationHandler({handleNotification:async()=>({shouldShowBanner:true,shouldShowList:true,shouldPlaySound:true,shouldSetBadge:false})});return notifications;}
export async function enableMobilePush(accessToken: string) {
  const Notifications=nativeNotifications();
  const projectId = Constants.easConfig?.projectId || Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) throw new Error('Notifications need the Expo project ID and a configured native build.');
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('orders', { name: 'Order updates', importance: Notifications.AndroidImportance.HIGH });
  const permission = await Notifications.requestPermissionsAsync();
  if (permission.status !== 'granted') throw new Error('Notification permission was not granted. You can enable it in Settings.');
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  await customerApi('/api/user/mobile-push', { token }, accessToken);
  await AsyncStorage.setItem('customer-push-token', token);
}
export async function disableMobilePush(accessToken: string) {
  const token = await AsyncStorage.getItem('customer-push-token');
  if (token) await customerApi('/api/user/mobile-push', { token }, accessToken, 'DELETE');
  await AsyncStorage.removeItem('customer-push-token');
}
