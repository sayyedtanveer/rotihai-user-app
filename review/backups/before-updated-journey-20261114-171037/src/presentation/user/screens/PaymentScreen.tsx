import React, { useRef, useState } from 'react';
import { Alert, Linking, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';
import { useApi, useCustomer } from '../../../core/providers/CustomerProvider';
import type { Order, PaymentSettings, Schedule } from '../../../core/api/models';
import type { Routes } from '../navigation/types';
import { PaymentQR } from '../components/PaymentQR';
import { Page, Title, Heading, Body, Card, Button, Field, Toggle, ErrorView, Loading, currency } from '../components/UI';
export function PaymentScreen({ route, navigation }: NativeStackScreenProps<Routes, 'Payment'>) {
  const { id, kind } = route.params, { request } = useCustomer(), client = useQueryClient();
  const settings = useApi<PaymentSettings>('/api/payment-settings');
  const order = useApi<Order>('/api/orders/' + encodeURIComponent(id), { enabled: kind === 'order', interval: 10000 });
  const subscriptions = useApi<Schedule>('/api/subscriptions/' + encodeURIComponent(id) + '/schedule', { enabled: kind === 'subscription', interval: 10000 });
  const subscription = subscriptions.data?.subscription;
  const amount = kind === 'order' ? Number(order.data?.total ?? route.params.amount ?? 0) : Number(subscription?.finalAmount ?? subscription?.totalAmount ?? subscription?.price ?? subscriptions.data?.plan?.price ?? route.params.amount ?? 0);
  const [paid, setPaid] = useState(false), [transaction, setTransaction] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const upi = settings.data?.upiId;
  // Match web personal-account flow: user enters the amount in their UPI app.
  const intent = upi ? 'upi://pay?pa=' + encodeURIComponent(upi) + '&cu=INR' : '';
  const isPaid = kind === 'order' ? ['paid', 'verified', 'completed', 'confirmed'].includes(order.data?.paymentStatus || '') : !!subscription?.isPaid;
  const closed = ['cancelled', 'rejected', 'expired'].includes(kind === 'order' ? order.data?.status || '' : subscription?.status || '');
  const unavailable = kind === 'order' ? !order.data || !!order.error : !subscription || !!subscriptions.error;
  const run = async (action: () => Promise<void>) => {
    if (lock.current) return; lock.current = true; setBusy(true); setError(null);
    try { await action(); } catch (e) { setError((e as Error).message); } finally { lock.current = false; setBusy(false); }
  };
  const details = () => kind === 'order' ? navigation.replace('OrderDetails', { id }) : navigation.replace('SubscriptionDetails', { id });
  if (settings.isPending || (kind === 'order' && order.isPending) || (kind === 'subscription' && subscriptions.isPending)) return <Loading />;
  return <Page><Title>{closed ? 'Payment unavailable' : isPaid ? 'Payment recorded' : 'Complete payment'}</Title><Body muted>Reference: {id}</Body>
    <Card><Heading>{currency(amount)}</Heading><Body>{settings.data?.merchantName || 'RotiHai'}</Body>{upi && <Body>{upi}</Body>}
      {!isPaid && !closed && !unavailable && intent && <View style={{ alignItems: 'center' }}><PaymentQR value={intent} /></View>}
      {!isPaid && !closed && !unavailable && <Body>Pay exactly {currency(amount)} in your UPI app. Returning to this app does not confirm payment.</Body>}</Card>
    <ErrorView error={error || settings.error || order.error || subscriptions.error} retry={() => { void settings.refetch(); if (kind === 'order') void order.refetch(); else void subscriptions.refetch(); }} />
    {closed && <Body>This order or subscription is closed. Review its details before making any payment.</Body>}
    {isPaid || closed || unavailable ? <Button title="View details" onPress={details} /> : <>
      {!upi && <Body>Payment details are unavailable. Please try again later.</Body>}
      <Button title="Open UPI app" disabled={busy || !upi || amount <= 0} onPress={() => run(async () => {
        if (kind === 'order') await request('/api/orders/' + encodeURIComponent(id) + '/payment-initiated', {});
        await Linking.openURL(intent);
      })} />
      <Field label={kind === 'subscription' ? 'UPI transaction/reference ID' : 'UPI reference ID (optional)'} value={transaction} onChangeText={setTransaction} autoCapitalize="none" maxLength={100} />
      <Toggle title="I have completed the payment" value={paid} onChange={setPaid} />
      <Button title={busy ? 'Submitting…' : 'Submit payment confirmation'} disabled={busy || !paid || !upi || !Number.isFinite(amount) || amount < 0 || (kind === 'subscription' && transaction.trim().length < 6)} onPress={() => run(async () => {
        const latest = kind === 'order' ? await order.refetch() : await subscriptions.refetch();
        if (latest.error || !latest.data) throw new Error('Could not refresh payment status. Try again before submitting.');
        const current = kind === 'order' ? latest.data as Order : (latest.data as Schedule).subscription;
        if (['cancelled','rejected','expired'].includes(current.status)) throw new Error('This payment can no longer be submitted.');
        if (kind === 'order' ? ['paid','verified','completed','confirmed'].includes((current as Order).paymentStatus) : (current as Schedule['subscription']).isPaid) { details(); return; }
        await request(kind === 'order' ? '/api/orders/' + encodeURIComponent(id) + '/payment-confirmed' : '/api/subscriptions/' + encodeURIComponent(id) + '/payment-confirmed', { paymentTransactionId: transaction.trim() || undefined });
        await client.invalidateQueries({ queryKey: ['customer'] });
        Alert.alert('Confirmation submitted', 'Your payment will be verified. You can follow its status in your account.', [{ text: 'View status', onPress: details }]);
      })} />
      <Button title="Pay later · view details" secondary disabled={busy} onPress={details} />
      {kind === 'order' && <Button title="Cancel this order" secondary disabled={busy} onPress={() => Alert.alert('Cancel order?', 'The server will check whether this order can still be cancelled.', [{ text: 'Keep order', style: 'cancel' }, { text: 'Cancel order', style: 'destructive', onPress: () => void run(async () => {
        await request('/api/orders/' + encodeURIComponent(id) + '/cancel', { reason: 'Customer cancelled before payment' });
        await client.invalidateQueries({ queryKey: ['customer'] }); details();
      }) }])} />}
    </>}
  </Page>;
}

