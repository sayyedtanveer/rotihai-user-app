import {pendingPayment} from '../../../core/storage/pendingPayment';
import type {PendingPayment} from '../../../application/user/payments/paymentRules';
import React, { useEffect,useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useApi, useCustomer } from '../../../core/providers/CustomerProvider';
import { useCart } from '../../../application/user/cart/CartProvider';
import { restoreCartItems, type SavedBasket } from '../../../application/user/cart/restoreCart';
import type { Order } from '../../../core/api/models';
import { useAppNavigation } from '../navigation/types';
import { Page, Title, Body, Heading, Card, Button, ErrorView, Loading, Empty, currency } from '../components/UI';
type Pending = SavedBasket & {id: string; status: string; isDeleted?: boolean; orderId?: string; expiresAt: string; total: string; address?: string};
export function RecoveryScreen() {
  const nav = useAppNavigation(), cart = useCart(), {request,user} = useCustomer();
  const pending = useApi<Pending | null>('/api/pending-checkouts/latest');
  const orders = useApi<Order[]>('/api/user/orders');
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null), lock = useRef(false);
  const [localPayment,setLocalPayment]=useState<PendingPayment|null>(null);
  useEffect(()=>{void pendingPayment.read(user.id).then(setLocalPayment).catch(()=>{});},[user.id]);
  const draft = pending.data;
  const restorable = draft && draft.status === 'pending' && !draft.isDeleted && !draft.orderId && Date.parse(draft.expiresAt) > Date.now();
  const unpaid = (orders.data || []).filter(o => !['cancelled','rejected','delivered'].includes(o.status) && !['paid','verified','completed','confirmed'].includes(o.paymentStatus));
  async function restore() {
    if (!draft || lock.current) return;
    lock.current = true; setBusy(true); setError(null);
    try {
      // Reload before restoring so a checkout completed on the web is not offered as a new order.
      const current = await request<Pending | null>('/api/pending-checkouts/latest');
      if (!current || current.id !== draft.id || current.orderId || current.isDeleted || current.status !== 'pending' || Date.parse(current.expiresAt) <= Date.now()) throw new Error('This saved checkout changed or expired. Refresh Your orders.');
      const freshOrders = await request<Order[]>('/api/user/orders');
      const linked = freshOrders.find(order => order.pendingCheckoutId === current.id);
      if (linked) { nav.navigate('OrderDetails', {id: linked.id}); return; }
      const fresh=<T,>(path:string)=>request<T>(path,undefined,'GET',{'X-RotiHai-Require-Fresh':'1'});
      const items = await restoreCartItems(current, fresh);
      cart.restore(items);
      nav.navigate('Cart');
    } catch(e) {setError((e as Error).message);} finally {lock.current=false;setBusy(false);}
  }
  return <Page onRefresh={() => {void pending.refetch(); void orders.refetch();}} refreshing={pending.isRefetching || orders.isRefetching}>
    <Title>Continue where you left off</Title>
    <Body>Your unsubmitted baskets are saved on this device. Unpaid orders can be continued on any device.</Body>
    {localPayment&&!['backend_recorded','closed'].includes(localPayment.phase)&&<Card><Heading>Saved payment reference</Heading><Body>{localPayment.id} · {currency(localPayment.amount)}</Body><Body>Opening a payment app never creates a second order. Check this reference first.</Body><Button title="Resume payment & check status" onPress={()=>nav.navigate('Payment',{id:localPayment.id,kind:localPayment.kind,amount:localPayment.amount})}/></Card>}
    <Button title="View saved baskets" secondary onPress={() => nav.navigate('Cart')}/>
    {(pending.isPending || orders.isPending) && <Loading/>}
    <ErrorView error={error || pending.error || orders.error} retry={() => {void pending.refetch();void orders.refetch();}}/>
    {restorable && <Card><Heading>Saved web checkout</Heading><Body>{draft.items.map(i => i.quantity + ' × ' + i.name).join(', ')}</Body><Body>Previous total: {currency(draft.total)}</Body><Body>{draft.address}</Body>
      <Body>Restores dishes at current prices. Review your current delivery address, schedule and offers at checkout.</Body>
      <Button title={busy ? 'Restoring…' : 'Restore basket'} disabled={busy || !cart.ready} onPress={() => Alert.alert('Restore saved basket?', 'This replaces any basket for the same kitchen and category. It does not place an order or confirm payment.', [{text:'Keep current basket',style:'cancel'},{text:'Restore',onPress:()=>void restore()}])}/>
    </Card>}
    <Heading>Orders awaiting payment</Heading>
    {!orders.isPending && !orders.error && !unpaid.length && <Empty title="No payments to continue"/>}
    {unpaid.map(order => <Card key={order.id}><Heading>{order.chefName || order.categoryName || 'RotiHai order'}</Heading><Body>{order.id}</Body><Body>{currency(order.total)}</Body><Button title="Review order & continue" onPress={() => nav.navigate('OrderDetails', {id:order.id})}/></Card>)}
  </Page>;
}
