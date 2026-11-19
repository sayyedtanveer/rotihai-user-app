import {theme as t} from '../theme/theme';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, ActivityIndicator } from 'react-native';
import {DeliveryMap} from '../components/DeliveryMap';
import type { DeliveryAddress } from '../../../core/location/customerLocation';
export function ConfirmAddressScreen({ initial, busy, error, onSave, onBack }: {
  initial: DeliveryAddress; busy: boolean; error: string | null;
  onSave: (address: DeliveryAddress) => void; onBack: () => void;
}) {
  const [ready,setReady]=useState(false),[mapVersion,setMapVersion]=useState(0);
  const [pin, setPin] = useState({ latitude: initial.latitude, longitude: initial.longitude });
  const [street, setStreet] = useState(initial.street || '');
  const [area, setArea] = useState(initial.area || '');
  const [city, setCity] = useState(initial.city || 'Mumbai');
  const [houseNumber, setHouseNumber] = useState(initial.houseNumber);
  const [landmark, setLandmark] = useState(initial.landmark);
  const [pincode, setPincode] = useState(initial.pincode);
  return <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
    <Text style={s.title}>Confirm delivery address</Text>
    <Text style={s.text}>{initial.address || 'Current GPS location'}</Text>
    <Text style={s.text}>Drag the pin to your entrance, then confirm the address below.</Text>
    <DeliveryMap key={mapVersion} onReady={setReady} coordinate={pin} disabled={busy} onChange={setPin} height={240}/>
    <Pressable accessibilityRole="button" onPress={()=>{setReady(false);setMapVersion(v=>v+1);}}><Text style={s.link}>Reload map</Text></Pressable>
    <TextInput accessibilityLabel="Street" style={s.input} placeholder="Street" value={street} onChangeText={setStreet} editable={!busy} />
    <TextInput accessibilityLabel="Area" style={s.input} placeholder="Area" value={area} onChangeText={setArea} editable={!busy} />
    <TextInput accessibilityLabel="City" style={s.input} placeholder="City" value={city} onChangeText={setCity} editable={!busy} />
    <TextInput accessibilityLabel="Flat or house number" style={s.input} placeholder="Flat / house / building" value={houseNumber} onChangeText={setHouseNumber} editable={!busy} />
    <TextInput accessibilityLabel="Landmark" style={s.input} placeholder="Landmark (optional)" value={landmark} onChangeText={setLandmark} editable={!busy} />
    <TextInput accessibilityLabel="Pincode" style={s.input} placeholder="6-digit pincode" keyboardType="number-pad" maxLength={6} value={pincode} onChangeText={v => setPincode(v.replace(/\D/g, ''))} editable={!busy} />
    {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
    {busy && <ActivityIndicator />}
    <Pressable accessibilityRole="button" disabled={busy || !ready || !street.trim() || !area.trim() || !city.trim() || !houseNumber.trim() || !/^[0-9]{6}$/.test(pincode)} onPress={() => onSave({ ...initial, ...pin, building: houseNumber.trim(), street: street.trim(), area: area.trim(), city: city.trim(), houseNumber: houseNumber.trim(), landmark: landmark.trim(), pincode,locationConfirmed:true,locationSource:'customer_pin',locationPrecision:'customer_selected' })} style={s.button}><Text style={s.buttonText}>Confirm Delivery Location</Text></Pressable>
    <Pressable accessibilityRole="button" disabled={busy} onPress={onBack}><Text style={s.link}>Choose another location</Text></Pressable>
  </ScrollView>;
}
const s = StyleSheet.create({
 page: { flexGrow: 1, backgroundColor: '#faf7f4', padding: 24, paddingTop: 72, gap: 20 },
 title: { fontSize: 28, fontFamily: t.bold, color: '#32251b' }, text: { fontFamily: t.font, fontSize: 16, color: '#846e5c' },
 input: { padding: 16, borderWidth: 1, borderColor: '#e2d6c9', borderRadius: 14, fontSize: 16 },
 button: { padding: 18, backgroundColor: '#c37322', borderRadius: 14 }, buttonText: { color: '#fff', textAlign: 'center', fontFamily: t.bold },
 link: { color: '#c37322', textAlign: 'center', padding: 12 }, error: { color: '#b42318' },
});
