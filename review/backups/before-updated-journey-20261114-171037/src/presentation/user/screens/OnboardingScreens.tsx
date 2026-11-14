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
        <Text style={styles.brand}>RotiHai</Text>
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

export function PhoneScreen({ onSubmit, onPrivacy, busy, error }: ActionState & {
  onSubmit: (phone: string) => void; onPrivacy: () => void;
}) {
  const [phone, setPhone] = useState('');
  const valid = /^[6-9][0-9]{9}$/.test(phone);
  return (
    <Page title="Your next meal starts here" subtitle="Enter your mobile number to sign in or create an account." busy={busy} error={error}>
      <Text style={styles.label}>Mobile number</Text>
      <View style={styles.phoneRow}>
        <Text style={styles.prefix}>+91</Text>
        <TextInput accessibilityLabel="Mobile number" style={[styles.input, styles.phoneInput]}
          value={phone} onChangeText={value => setPhone(value.replace(/\D/g, '').slice(0, 10))}
          placeholder="10-digit mobile number" keyboardType="phone-pad" maxLength={10}
          autoComplete="tel-national" editable={!busy} />
      </View>
      <Button title="Send verification code" disabled={!valid || busy} onPress={() => onSubmit(phone)} />
      <Button title="Privacy policy" secondary onPress={onPrivacy} disabled={busy} />
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
    <Page title="What should we call you?" subtitle="Add your name to complete your account." busy={busy} error={error}>
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
  page: { flex: 1, backgroundColor: '#faf7f4' },
  content: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 72, paddingBottom: 40, gap: 16, justifyContent: 'center' },
  brand: { color: '#c37322', fontSize: 32, fontFamily: t.display, marginBottom: 32 },
  title: { color: '#32251b', fontSize: 30, fontFamily: t.bold },
  subtitle: { color: '#846e5c', fontFamily: t.font, fontSize: 16, lineHeight: 24 },
  label: { color: '#32251b', fontSize: 14, fontFamily: t.semibold },
  input: { borderWidth: 1, borderColor: '#e2d6c9', backgroundColor: '#fff', borderRadius: 14, padding: 16, fontFamily: t.font, fontSize: 18, color: '#32251b', minHeight: 56 },
  phoneRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  phoneInput: { flex: 1 },
  prefix: { fontFamily: t.font, fontSize: 18, color: '#32251b' },
  button: { minHeight: 54, borderRadius: 14, backgroundColor: '#c37322', padding: 16, alignItems: 'center', justifyContent: 'center' },
  secondary: { backgroundColor: '#fff3e2' },
  buttonText: { color: '#fff', fontFamily: t.bold, fontSize: 16, textAlign: 'center' },
  secondaryText: { color: '#bc6b1d' },
  disabled: { opacity: 0.45 },
  error: { color: '#b42318', fontSize: 15, lineHeight: 22 },
  hero: { backgroundColor: '#fff3e2', padding: 30, borderRadius: 24, marginVertical: 24 },
  heroText: { color: '#713908', fontSize: 28, fontFamily: t.semibold, lineHeight: 38 },
});
