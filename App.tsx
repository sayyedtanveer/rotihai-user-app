import React from 'react';
import {useFonts} from 'expo-font';
import {StartupSplash} from './src/presentation/user/screens/StartupSplash';
import { View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
void SplashScreen.preventAutoHideAsync().catch(() => {});
import { StatusBar } from 'expo-status-bar';

import { AppProviders } from './src/core/providers/AppProviders';
import { UserAppNavigator } from './src/presentation/user/navigation/UserAppNavigator';

export default function App() {
 const [fontsLoaded,fontError]=useFonts({Inter_400Regular:require('@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf'),Inter_500Medium:require('@expo-google-fonts/inter/500Medium/Inter_500Medium.ttf'),Inter_600SemiBold:require('@expo-google-fonts/inter/600SemiBold/Inter_600SemiBold.ttf'),Inter_700Bold:require('@expo-google-fonts/inter/700Bold/Inter_700Bold.ttf'),Inter_800ExtraBold:require('@expo-google-fonts/inter/800ExtraBold/Inter_800ExtraBold.ttf')});
 React.useEffect(()=>{if(fontsLoaded||fontError)void SplashScreen.hideAsync().catch(()=>{});},[fontsLoaded,fontError]);
 if(!fontsLoaded&&!fontError)return <StartupSplash/>;
 if(__DEV__ && process.env.EXPO_PUBLIC_UI_REVIEW === '1'){const {ReviewApp}=require('./src/review/ReviewApp');return <ReviewApp/>;}
  return (
    <View style={{flex:1,backgroundColor: '#fbf8f4'}} onLayout={() => { void SplashScreen.hideAsync().catch(() => {}); }}><AppProviders>
      <StatusBar style="dark" />
      <UserAppNavigator />
    </AppProviders></View>
  );
}
