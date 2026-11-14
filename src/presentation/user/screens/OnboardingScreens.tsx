import {theme as t} from '../theme/theme';
import React, { useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';

type ActionState = { busy?: boolean; error?: string | null };

function Page({ title, subtitle, children, busy, error }: React.PropsWithChildren<ActionState & {
  title: string; subtitle: string;
}>) {
  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.brandRow}><View style={styles.brandMark}><Text style={styles.brandInitial}>R</Text></View><View><Text style={styles.brand}>RotiHai</Text><Text style={styles.brandCaption}>GHAR KA KHANA</Text></View></View>
        <Text accessibilityRole="header" style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        {children}
        {busy && <ActivityIndicator accessibilityLabel="Please wait" color="#c37322" />}
        {!!error && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Button({ title, onPress, disabled = false, secondary = false }: {
  title: string; onPress: () => void; disabled?: boolean; secondary?: boolean;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled }}
      disabled={disabled} onPress={onPress}
      style={[styles.button, secondary && styles.secondary, disabled && styles.disabled]}>
      <Text style={[styles.buttonText, secondary && styles.secondaryText]}>{title}</Text>
    </Pressable>
  );
}

export function LaunchScreen({ onContinue }: { onContinue: () => void }) {
  return (
    <Page title="Good food. Close to home." subtitle="Discover meals from kitchens around you.">
      <View style={styles.hero}><Text style={styles.heroText}>Fresh meals, made with care.</Text></View>
      <Button title="Get started" onPress={onContinue} />
    </Page>
  );
}

export function PhoneScreen({ onSubmit, onPrivacy, busy, error, provisional = false, initialPhone = "" }: ActionState & {
  onSubmit: (phone: string,name?:string) => void; onPrivacy: () => void; provisional?: boolean; initialPhone?: string;
}) {
  const [phone, setPhone] = useState(initialPhone),[name,setName]=useState('');
  const valid = /^[6-9][0-9]{9}$/.test(phone);
  return (
    <Page title="A little closer to home." subtitle={provisional ? "Homestyle meals from nearby kitchens. Start with your mobile number." : "Verify your number to access your account securely."} busy={busy} error={error}>
      <View style={styles.formCard}><Text style={styles.formTitle}>{provisional?'Welcome to RotiHai':'Welcome back'}</Text>
      {provisional&&<><Text style={styles.label}>Your name</Text><TextInput accessibilityLabel="Your name" style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Aisha" placeholderTextColor="#aaa092" autoCapitalize="words" autoComplete="name" maxLength={80} editable={!busy}/></>}
      <Text style={styles.label}>Mobile number</Text>
      <View style={styles.phoneRow}>
        <Text style={styles.prefix}>+91</Text>
        <TextInput accessibilityLabel="Mobile number" style={[styles.input, styles.phoneInput]}
          value={phone} onChangeText={value => setPhone(value.replace(/\D/g, '').slice(0, 10))}
          placeholder="Mobile number" placeholderTextColor="#aaa092" keyboardType="phone-pad" maxLength={10}
          autoComplete="tel-national" editable={!busy} />
      </View>
      {provisional && <Text style={styles.helper}>Already ordered with us? Use the same number. Your name is optional.</Text>}
      <Button title={provisional ? "Continue" : "Send verification code"} disabled={!valid || busy} onPress={() => onSubmit(phone,name)} />
      </View><Pressable accessibilityRole="link" onPress={onPrivacy} disabled={busy} style={styles.privacy}><Text style={styles.helper}>Your privacy matters. <Text style={styles.privacyLink}>Read our policy</Text></Text></Pressable>
    </Page>
  );
}

export function OtpScreen({ phone, codeLength, resendInSeconds, onVerify, onResend, onChangePhone, busy, error }: ActionState & {
  phone: string; codeLength: number; resendInSeconds: number;
  onVerify: (code: string) => void; onResend: () => void; onChangePhone: () => void;
}) {
  const [code, setCode] = useState('');
  return (
    <Page title="Verify your number" subtitle={'Enter the code sent to +91 ' + phone} busy={busy} error={error}>
      <TextInput accessibilityLabel="Verification code" style={styles.input}
        value={code} onChangeText={value => setCode(value.replace(/\D/g, '').slice(0, codeLength))}
        keyboardType="number-pad" maxLength={codeLength} textContentType="oneTimeCode"
        autoComplete="sms-otp" placeholder="Verification code" editable={!busy} />
      <Button title="Verify and continue" disabled={code.length !== codeLength || busy} onPress={() => onVerify(code)} />
      <Button title={resendInSeconds > 0 ? 'Resend in ' + resendInSeconds + 's' : 'Resend code'}
        secondary disabled={busy || resendInSeconds > 0} onPress={() => { setCode(''); onResend(); }} />
      <Button title="Change mobile number" secondary disabled={busy} onPress={onChangePhone} />
    </Page>
  );
}

export function NameScreen({ onSubmit, busy, error }: ActionState & { onSubmit: (name: string) => void }) {
  const [name, setName] = useState('');
  return (
    <Page title="Make yourself at home." subtitle="Tell us your name so we know who we’re cooking for." busy={busy} error={error}>
      <TextInput accessibilityLabel="Your name" style={styles.input} value={name} onChangeText={setName}
        placeholder="Your name" autoComplete="name" autoCapitalize="words" maxLength={100} editable={!busy} />
      <Button title="Continue" disabled={name.trim().length < 2 || busy} onPress={() => onSubmit(name.trim())} />
    </Page>
  );
}

export function LocationScreen({ onUseCurrentLocation, onChooseAddress, busy, error }: ActionState & {
  onUseCurrentLocation: () => void; onChooseAddress: () => void;
}) {
  return (
    <Page title="Where should we deliver?" subtitle="Use your current location or choose a delivery address to find kitchens nearby." busy={busy} error={error}>
      <Text style={styles.subtitle}>You can confirm the address before saving it and change it whenever you order.</Text>
      <Button title="Use my current location" onPress={onUseCurrentLocation} disabled={busy} />
      <Button title="Choose an address" onPress={onChooseAddress} secondary disabled={busy} />
    </Page>
  );
}

const styles = StyleSheet.create({
  brandRow:{flexDirection:'row',alignItems:'center',gap:11,marginBottom:20},
  brandMark:{width:46,height:46,borderRadius:15,backgroundColor:'#f6dfbb',alignItems:'center',justifyContent:'center'},
  brandInitial:{fontFamily:t.bold,fontSize:27,color:t.primary},
  brandCaption:{fontFamily:t.medium,fontSize:8,letterSpacing:1.7,color:'#9b7d60',marginTop:3},
  formCard:{padding:20,borderRadius:22,backgroundColor:'#fffdf9',borderWidth:1,borderColor:'#ecdfce',gap:14,marginTop:8},
  formTitle:{fontFamily:t.semibold,fontSize:16,color:t.ink,marginBottom:4},
  helper:{fontFamily:t.font,fontSize:11,lineHeight:18,color:t.muted},
  privacy:{minHeight:44,alignItems:'center',justifyContent:'center'},
  privacyLink:{color:t.primary,fontFamily:t.semibold},
  page: { flex: 1, backgroundColor: t.bg },
  content: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 64, paddingBottom: 32, gap: 18, justifyContent: 'center',width:'100%',maxWidth:520,alignSelf:'center' },
  brand: { color: t.primary, fontSize: 25, fontFamily: t.bold,letterSpacing:-.8 },
  title: { color: '#493427', fontSize: 33,lineHeight:40,letterSpacing:-1.1, fontFamily: t.bold },
  subtitle: { color: t.muted, fontFamily: t.font, fontSize: 14, lineHeight: 22 },
  label: { color: t.ink, fontSize: 14, fontFamily: t.semibold },
  input: { borderWidth: 1, borderColor: t.inputBorder, backgroundColor: '#fff', borderRadius: 14, padding: 16, fontFamily: t.font, fontSize: 16, color: t.ink, minHeight: 54 },
  phoneRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  phoneInput: { flex: 1 },
  prefix: { fontFamily: t.semibold, fontSize: 15, color: t.ink },
  button: { minHeight: 54, borderRadius: 14, backgroundColor: t.primary, padding: 16, alignItems: 'center', justifyContent: 'center' },
  secondary: { backgroundColor: t.pale },
  buttonText: { color: '#fff', fontFamily: t.bold, fontSize: 16, textAlign: 'center' },
  secondaryText: { color: t.primary },
  disabled: { opacity: 0.45 },
  error: { color: t.danger, fontFamily:t.font,fontSize: 13, lineHeight: 20 },
  hero: { backgroundColor: t.pale, padding: 30, borderRadius: 24, marginVertical: 24 },
  heroText: { color: t.ink, fontSize: 28, fontFamily: t.semibold, lineHeight: 38 },
});
