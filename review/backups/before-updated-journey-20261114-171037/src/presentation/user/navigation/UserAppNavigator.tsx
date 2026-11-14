import {useDeliveryArea} from '../../../core/location/DeliveryAreaProvider';
import {DeliveryAreaScreen} from '../screens/DeliveryAreaScreen';
import {validArea} from '../../../core/location/discoveryRules';
import {readAddress} from '../../../application/user/cart/cartRules';
import {SafeAreaProvider,SafeAreaView} from 'react-native-safe-area-context';
import { StartupSplash } from '../screens/StartupSplash';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, BackHandler, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { LaunchScreen, PhoneScreen, OtpScreen, NameScreen, LocationScreen } from '../screens/OnboardingScreens';
import { ConfirmAddressScreen } from '../screens/ConfirmAddressScreen';
import { CustomerNavigator } from './CustomerNavigator';
import { ApiError, customerApi, type Customer, type Session } from '../../../core/api/customerApi';
import { customerSession } from '../../../core/storage/customerSession';
import { currentDeliveryLocation, searchDeliveryAddress, type DeliveryAddress } from '../../../core/location/customerLocation';

type Step = 'restore' | 'launch' | 'phone' | 'otp' | 'name' | 'location' | 'search' | 'confirm' | 'home';
export function UserAppNavigator() {
  const [showSplash, setShowSplash] = useState(true);
  const splashOpacity = useRef(new Animated.Value(1)).current;
  const delivery=useDeliveryArea();
  const [step, setStep] = useState<Step>('restore');
  const [destination,setDestination] = useState<any>();
  const [phone, setPhone] = useState('');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [codeLength, setCodeLength] = useState(6);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [query, setQuery] = useState('');
  const [address, setAddress] = useState<DeliveryAddress | null>(null);

  useEffect(() => {
    // Show splash for at least 3 seconds, then fade out
    const timer = setTimeout(() => {
      Animated.timing(splashOpacity, {
        toValue: 0,
        duration: 800, // Smooth fade out duration
        useNativeDriver: true,
      }).start(() => {
        setShowSplash(false);
      });
    }, 3000);
    return () => clearTimeout(timer);
  }, [splashOpacity]);
  const logout = useCallback(() => { 

    void customerSession.clear();
    setToken(''); setAddress(null); setDestination(undefined); setStep('home'); 
  }, []);
  const go = (next: Step) => { 

    setError(null); 
    if (next === 'home') {

    }
    setStep(next); 
  };
  const run = async (action: () => Promise<void>) => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(null);
    try { await action(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Please try again.'); }
    finally { pending.current = false; setBusy(false); }
  };
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  useEffect(() => {
    if(!delivery.ready)return;
    let cancelled = false;
    (async () => {
      try {
        const saved = await customerSession.read();

        if (!saved) { if (!cancelled) { setStep('home'); } return; }
        if(!cancelled)setToken(saved);
        
        let user: Customer;
        

          user = await customerApi<Customer>('/api/user/profile', undefined, saved);
        

        if (cancelled) return;
        setToken(saved);
        const savedAddress=readAddress(user);
        if(!delivery.area && savedAddress && validArea(savedAddress)) await delivery.select({...savedAddress,source:'address'});
        const nextStep = 'home';

        setStep(nextStep);
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) { await customerSession.clear(); setToken(''); }
        if (!cancelled) { setStep('home'); setError('Could not restore your session. Please sign in again.'); }
      }
    })();
    return () => { cancelled = true; };
  }, [delivery.ready]);
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (busy) return true;
      const previous: Partial<Record<Step, Step>> = { phone: 'home', otp: 'phone', search: 'location', confirm: 'location' };
      if (previous[step]) { go(previous[step]!); return true; }
      return false;
    });
    return () => subscription.remove();
  }, [step, busy]);
  const send = (value: string) => run(async () => {
    
      const response = await customerApi<{ codeLength: number; retryAfterSeconds: number }>('/api/user/otp/send', { phone: value });
      setPhone(value); setCodeLength(response.codeLength);
      setResendAt(Date.now() + response.retryAfterSeconds * 1000); go('otp');
    
  });
  const renderContent = () => {
    if (step === 'restore' || !delivery.ready) return null;
    if (step === 'home' && !delivery.area) return <SafeAreaProvider><SafeAreaView style={{flex:1}}><DeliveryAreaScreen/></SafeAreaView></SafeAreaProvider>;
    if (step === 'launch') return <LaunchScreen onContinue={() => go('phone')} />;
    if (step === 'phone') return <PhoneScreen busy={busy} error={error} onSubmit={send} onPrivacy={() => {
      const base = process.env.EXPO_PUBLIC_WEB_BASE_URL;
      if (base?.startsWith('https://') && !base.includes('example.com')) {
        void Linking.openURL(base.replace(/\/$/, '') + '/privacy-policy').catch(() => setError('Unable to open privacy policy.'));
      } else setError('Privacy policy is currently unavailable.');
    }} />;
    if (step === 'otp') return <OtpScreen phone={phone} busy={busy} error={error} codeLength={codeLength}
      resendInSeconds={Math.max(0, Math.ceil((resendAt - now) / 1000))}
      onResend={() => { if (Date.now() >= resendAt) void send(phone); }} onChangePhone={() => go('phone')}
      onVerify={code => run(async () => {
        const session = await customerApi<Session>('/api/user/otp/verify', { phone, code });
        const guestCart = await AsyncStorage.getItem('customer-cart:guest');
        if (guestCart && Array.isArray(JSON.parse(guestCart)) && JSON.parse(guestCart).length > 0) {
          // Guest basket replaces the device basket after explicit checkout login; never append quantities.
          await AsyncStorage.setItem('customer-cart:' + session.user.id, guestCart);
          await AsyncStorage.removeItem('customer-cart:guest');
        }
        await customerSession.save(session.accessToken);
        setToken(session.accessToken);
        go(session.isNewUser ? 'name' : 'home');
      })} />;
    if (step === 'name') return <NameScreen busy={busy} error={error} onSubmit={name => run(async () => {
      await customerApi('/api/user/profile', { name }, token, 'PUT');
      go('home');
    })} />;
    if (step === 'location') return <LocationScreen busy={busy} error={error} onChooseAddress={() => go('search')}
      onUseCurrentLocation={() => run(async () => { 
          setAddress(await currentDeliveryLocation()); 
        go('confirm'); 
      })} />;
    if (step === 'search') return <View style={{ flex: 1, padding: 24, paddingTop: 80, gap: 20 }}>
      <Text style={{ fontSize: 26, fontWeight: '700' }}>Find your delivery address</Text>
      <TextInput accessibilityLabel="Full delivery address" placeholder="Street, area, city, pincode" value={query} onChangeText={setQuery} editable={!busy} style={{ borderWidth: 1, padding: 16, borderRadius: 12 }} />
      {!!error && <Text accessibilityRole="alert">{error}</Text>}
      {busy && <ActivityIndicator />}
      <Pressable accessibilityRole="button" disabled={busy || query.trim().length < 10} onPress={() => run(async () => { 
          setAddress(await searchDeliveryAddress(query.trim())); 
        go('confirm'); 
      })}><Text>Find address</Text></Pressable>
      <Pressable accessibilityRole="button" disabled={busy} onPress={() => go('location')}><Text>Back</Text></Pressable>
    </View>;
    if (step === 'confirm' && address) return <ConfirmAddressScreen initial={address} busy={busy} error={error} onBack={() => go('location')}
      onSave={selected => run(async () => {
          await customerApi('/api/user/profile', { latitude: selected.latitude, longitude: selected.longitude,
            defaultDeliveryAddress: selected }, token, 'PUT');
        setAddress(selected); go('home');
      })} />;
    return <CustomerNavigator token={token} onLogout={logout} destination={token ? destination : undefined} onLogin={target=>{setDestination(target);go('phone');}} />;
  };

  return (
    <View style={{ flex: 1 }}>
      {renderContent()}
      {showSplash && (
        <Animated.View 
          pointerEvents="none" 
          style={[StyleSheet.absoluteFill, { opacity: splashOpacity, zIndex: 9999 }]}
        >
          <StartupSplash />
        </Animated.View>
      )}
    </View>
  );
}
