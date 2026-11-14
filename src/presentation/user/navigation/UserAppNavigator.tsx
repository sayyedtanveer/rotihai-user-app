import {useQueryClient} from '@tanstack/react-query';
import {useReducedMotion} from '../hooks/useReducedMotion';
import {migrateGuestCheckout,migrateGuestSubscription} from '../../../core/storage/checkoutState';
import {provisionalContact} from '../../../core/storage/provisionalContact';
import {initialCustomerStep,normalizeProvisionalPhone,verificationContact,recognizeCustomer,databaseCustomerSession} from '../../../application/user/auth/entryRules';
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
  const queryClient=useQueryClient();
  const [showSplash, setShowSplash] = useState(true);
  const reducedMotion=useReducedMotion(),splashStarted=useRef(Date.now());
  const splashOpacity = useRef(new Animated.Value(1)).current;
  const delivery=useDeliveryArea();
  const [step, setStep] = useState<Step>('restore');
  const [destination,setDestination] = useState<any>();
  const [phone, setPhone] = useState('');
  const [entryOnly,setEntryOnly]=useState(false);
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [codeLength, setCodeLength] = useState(6);
  const [resendAt, setResendAt] = useState(0);
  const sentPhone=useRef('');
  const [now, setNow] = useState(Date.now());
  const [query, setQuery] = useState('');
  const [address, setAddress] = useState<DeliveryAddress | null>(null);

  useEffect(() => {
    if(!showSplash||step==='restore'||!delivery.ready||reducedMotion===null)return;
    const timer=setTimeout(()=>{Animated.timing(splashOpacity,{toValue:0,duration:reducedMotion?0:800,useNativeDriver:true}).start(({finished})=>{if(finished)setShowSplash(false);});},reducedMotion?0:Math.max(0,2500-(Date.now()-splashStarted.current)));
    return()=>{clearTimeout(timer);splashOpacity.stopAnimation();};
  }, [showSplash,step,delivery.ready,reducedMotion,splashOpacity]);
  const logout = useCallback(() => { 

    void queryClient.cancelQueries({queryKey:['customer']}).then(()=>{queryClient.removeQueries({queryKey:['customer']});return customerSession.clear();}).catch(()=>setError('Could not fully clear saved sign-in. Please restart and sign out again before sharing this device.'));
    setToken('');setPhone('');setEntryOnly(true);setAddress(null);setDestination(undefined);setStep('phone'); 
  }, [queryClient]);
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
        const [saved,contact] = await Promise.all([customerSession.read(),provisionalContact.read()]);
        if(contact&&!cancelled)setPhone(contact);

        if (!saved) { if (!cancelled) { if(contact){await signInMvp(contact,await provisionalContact.readName());}else{setEntryOnly(true);setStep('phone');} } return; }
        if(!cancelled)setToken(saved);
        
        let user: Customer;
        

          user = await customerApi<Customer>('/api/user/profile', undefined, saved);
        

        if (cancelled) return;
        setToken(saved);
        try{const restoredPhone=normalizeProvisionalPhone(user.phone);setPhone(restoredPhone);void provisionalContact.save(restoredPhone).catch(()=>{});}catch{}
        const savedAddress=readAddress(user);
        if(!delivery.area && savedAddress && validArea(savedAddress)) await delivery.select({...savedAddress,source:'address'});
        const nextStep = 'home';

        setStep(nextStep);
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) { await customerSession.clear(); setToken(''); }
        if (!cancelled) { setEntryOnly(true);setStep('phone');setError('Could not restore your account. Check your connection and continue with your mobile number.'); }
      }
    })();
    return () => { cancelled = true; };
  }, [delivery.ready]);
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (busy||showSplash) return true;
      if(step==='phone'&&entryOnly)return false;
      const previous: Partial<Record<Step, Step>> = { phone: 'home', otp: 'home', search: 'location', confirm: 'location' };
      if (previous[step]) { go(previous[step]!); return true; }
      return false;
    });
    return () => subscription.remove();
  }, [step,busy,showSplash,entryOnly]);
  const sendCode = async (value:string) => {
    const response=await customerApi<{codeLength:number;retryAfterSeconds:number}>('/api/user/otp/send',{phone:value});
    sentPhone.current=value;setPhone(value);setCodeLength(response.codeLength);
    setResendAt(Date.now()+response.retryAfterSeconds*1000);go('otp');
  };
  const send=(value:string)=>run(()=>sendCode(value));
  const beginVerification=(target:any,contactPhone?:string)=>void run(async()=>{
    const savedPhone=await verificationContact([contactPhone,phone],()=>provisionalContact.read());
    setEntryOnly(false);setDestination(target);
    if(!savedPhone){go('phone');return;}
    setPhone(savedPhone);go('otp');
    if(sentPhone.current!==savedPhone||Date.now()>=resendAt)await sendCode(savedPhone);
  });

  const signInMvp=async(value:string,name?:string)=>{
    const session=await databaseCustomerSession(value,name,customerApi),profile=session.user,normalized=normalizeProvisionalPhone(profile.phone);
    const guestCart=await AsyncStorage.getItem('customer-cart:guest');
    if(guestCart&&Array.isArray(JSON.parse(guestCart))&&JSON.parse(guestCart).length>0){await AsyncStorage.setItem('customer-cart:'+profile.id,guestCart);await AsyncStorage.removeItem('customer-cart:guest');}
    await migrateGuestCheckout(profile.id);
    await provisionalContact.save(normalized,profile.name);
    await customerSession.save(session.accessToken);
    setPhone(normalized);setToken(session.accessToken);setEntryOnly(false);go('home');
  };
  const renderContent = () => {
    if (step === 'restore' || !delivery.ready) return null;

    if (step === 'launch') return <LaunchScreen onContinue={() => go('phone')} />;
    if (step === 'phone') return <PhoneScreen provisional={entryOnly} initialPhone={phone} busy={busy} error={error} onSubmit={entryOnly ? (value,name)=>void run(async()=>{const result=await recognizeCustomer(value,phone=>customerApi<{exists:boolean}>('/api/user/check-phone',{phone}));const saved=await provisionalContact.save(result.phone,name);setPhone(saved);if(!result.exists&&!name?.trim()){go('name');return;}await signInMvp(saved,name);}) : send} onPrivacy={() => {
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
        await migrateGuestCheckout(session.user.id,destination?.name==='Checkout'?destination.params?.cartKey:undefined);
        if(destination?.name==='Subscribe'&&destination.params?.planId)await migrateGuestSubscription(session.user.id,destination.params.planId);
        await provisionalContact.save(phone);
        await customerSession.save(session.accessToken);
        setToken(session.accessToken);
        go(session.isNewUser ? 'name' : 'home');
      })} />;
    if (step === 'name') return <NameScreen busy={busy} error={error} onSubmit={name => run(async () => {
      if(entryOnly){await signInMvp(phone,name);return;}else await customerApi('/api/user/profile', { name }, token, 'PUT');
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
    return <CustomerNavigator token={token} onLogout={logout} destination={destination} onLogin={beginVerification} />;
  };

  return (
    <View style={{ flex: 1 }}>
      {renderContent()}
      {showSplash && (
        <Animated.View 
          pointerEvents="auto" 
          style={[StyleSheet.absoluteFill, { opacity: splashOpacity, zIndex: 9999 }]}
        >
          <StartupSplash />
        </Animated.View>
      )}
    </View>
  );
}
