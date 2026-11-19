import {Platform} from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {customerApi} from '../api/customerApi';
const KEY='customer-push-token';
function nativeNotifications(){
 if(Constants.executionEnvironment==='storeClient')throw new Error('Notifications require the installed RotiHai app.');
 const notifications:typeof import('expo-notifications')=require('expo-notifications');
 notifications.setNotificationHandler({handleNotification:async()=>({shouldShowBanner:true,shouldShowList:true,shouldPlaySound:true,shouldSetBadge:false})});
 return notifications;
}
export async function enableMobilePush(accessToken:string,requestPermission=true){
 const Notifications=nativeNotifications();
 const projectId=Constants.easConfig?.projectId||Constants.expoConfig?.extra?.eas?.projectId;
 if(!projectId)throw new Error('Notifications are not available in this build yet.');
 const config=await customerApi<{enabled:boolean}>('/api/mobile/push/config');
 if(!config.enabled)throw new Error('Order notifications are being set up. Please try again later.');
 if(Platform.OS==='android')await Notifications.setNotificationChannelAsync('orders',{name:'Order updates',importance:Notifications.AndroidImportance.HIGH,sound:'default',vibrationPattern:[0,200,120,200],lightColor:'#C37322'});
 let permission=await Notifications.getPermissionsAsync();
 if(permission.status!=='granted'&&requestPermission)permission=await Notifications.requestPermissionsAsync();
 if(permission.status!=='granted'){if(!requestPermission)return;throw new Error('Allow notifications in your phone settings to receive order updates.');}
 const token=(await Notifications.getExpoPushTokenAsync({projectId})).data;
 await customerApi('/api/mobile/push/devices',{token,platform:Platform.OS},accessToken);
 await AsyncStorage.setItem(KEY,token);
}
export async function disableMobilePush(accessToken:string){
 const token=await AsyncStorage.getItem(KEY);
 if(token)await customerApi('/api/mobile/push/devices',{token},accessToken,'DELETE');
 await AsyncStorage.removeItem(KEY);
}
