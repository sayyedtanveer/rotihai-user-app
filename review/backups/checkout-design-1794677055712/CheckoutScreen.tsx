import {verifyCheckoutCoupon} from '../../../application/user/cart/couponRules';
import {checkoutDraftKey} from '../../../core/storage/checkoutState';
import {pendingPayment} from '../../../core/storage/pendingPayment';
import {cartSignature,type PendingPayment} from '../../../application/user/payments/paymentRules';
import {requireConnection} from '../../../core/api/connectivity';
import {readPrivateJson,writePrivateJson} from '../../../core/storage/privateJson';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useApi, useCustomer } from '../../../core/providers/CustomerProvider';
import type { Category, Chef, Order, PaymentSettings, Slot, WalletSettings, CartSettings, Product, ProductOffer, RotiSettings } from '../../../core/api/models';
import { useCart } from '../../../application/user/cart/CartProvider';
import { addressText, businessDate, lineTotal, money, platformFee, readAddress, validateAddress } from '../../../application/user/cart/cartRules';
import { validateFreshItem, slotTiming,rotiOrderingBlocked,assertRotiOrderingAllowed } from '../../../application/user/cart/checkoutRules';
import type { Routes } from '../navigation/types';
import { Page, Title, Card, Heading, Body, Button, Field, Row, Chip, Toggle, ErrorView, Empty, Loading, currency } from '../components/UI';
const confirm = (title: string, message: string) => new Promise<boolean>(resolve => Alert.alert(title, message, [{ text: 'Go back', style: 'cancel', onPress: () => resolve(false) }, { text: 'Continue', onPress: () => resolve(true) }], { cancelable: false }));
export function CheckoutScreen({ route, navigation }: NativeStackScreenProps<Routes, 'Checkout'>) {
  const cart = useCart(), { user, token, login, deliveryAddress:address, request: apiRequest } = useCustomer(), client = useQueryClient();
  const request=React.useCallback(<T,>(path:string,body?:unknown,method?:string)=>apiRequest<T>(path,body,method,{'X-RotiHai-Require-Fresh':'1'}),[apiRequest]);
  const group = cart.groups.find(g => g.key === route.params.cartKey);
  const subtotal = money(group?.items.reduce((sum, item) => sum + lineTotal(item), 0));
  const payment = useApi<PaymentSettings>('/api/payment-settings');
  const wallet = useApi<{balance: number}>('/api/user/wallet',{enabled:!!token});
  const walletSettings = useApi<WalletSettings>('/api/wallet-settings');
  const categories = useApi<Category[]>('/api/categories');
  const cartSettings = useApi<CartSettings[]>('/api/cart-settings');
  const slots = useApi<Slot[]>('/api/delivery-slots');
  const preorderSettings = useApi<Record<string, string>>('/api/admin-settings');
  const [date, setDate] = useState(businessDate(1)), [slotId, setSlotId] = useState(''), [meal, setMeal] = useState('preorder-lunch');
  const [coupon, setCoupon] = useState(''), [applied, setApplied] = useState<{code: string; discountAmount: number; subtotal: number} | null>(null);
  const [showDetails,setShowDetails]=useState(false),[showCoupon,setShowCoupon]=useState(false);
  const [useWallet, setUseWallet] = useState(false), [useBonus, setUseBonus] = useState(false);
  const [instructions, setInstructions] = useState(''), [email, setEmail] = useState(user.email || '');
  const [error, setError] = useState<string | null>(null), [busy, setBusy] = useState(false), lock = useRef(false);
  const attemptKey = 'customer-order-attempt:' + user.id;
  const [savedPayment,setSavedPayment]=useState<PendingPayment|null>(null),[draftReady,setDraftReady]=useState(false);
  const draftKey=checkoutDraftKey(user.id,route.params.cartKey);
  useEffect(()=>{let active=true;void Promise.all([pendingPayment.read(user.id),readPrivateJson<any>(draftKey)]).then(([payment,draft])=>{if(!active)return;setSavedPayment(payment);if(draft){setEmail(draft.email||'');setInstructions(draft.instructions||'');setDate(draft.date||businessDate(1));setSlotId(draft.slotId||'');setMeal(draft.meal||'preorder-lunch');setCoupon(draft.coupon||'');}setDraftReady(true);}).catch(()=>setError('Your saved checkout could not be restored. Please review it before continuing.'));return()=>{active=false;};},[draftKey,user.id]);
  useEffect(()=>{if(!draftReady)return;const timer=setTimeout(()=>void writePrivateJson(draftKey,{email,instructions,date,slotId,meal,coupon}).catch(()=>setError('Could not save checkout on this device.')),300);return()=>clearTimeout(timer);},[draftReady,draftKey,email,instructions,date,slotId,meal,coupon]);
  const [unresolved,setUnresolved] = useState(false), [attemptReady,setAttemptReady] = useState(false);
  useEffect(()=>{let active=true;void AsyncStorage.getItem(attemptKey).then(value=>{if(active){setUnresolved(!!value);setAttemptReady(true);}}).catch(()=>{if(active)setError('Cannot check the previous order attempt. Restart the app before placing an order.');});return()=>{active=false;};},[attemptKey]);
  const preorder = group?.items.some(i => i.effectiveMode === 'preorder') || false;
  const category = categories.data?.find(c => c.id === group?.categoryId);
  const rotiCategory=!!(category?.name||group?.categoryName||'').toLowerCase().includes('roti');
  const requiresSlot = preorder || !!category?.requiresDeliverySlot || rotiCategory;
  const rotiSettings=useApi<RotiSettings>('/api/roti-settings',{enabled:rotiCategory,interval:60000});
  const rotiBlocked=rotiOrderingBlocked(rotiSettings.data,rotiCategory);
  const fee = useQuery({ queryKey: ['customer', user.id, 'delivery-quote', group?.key, subtotal, address?.latitude, address?.longitude],
    enabled: !!group && !!address, retry: 1,
    queryFn: () => request<{distance: number; deliveryFee: number; freeDeliveryEligible: boolean; deliveryRangeName?: string}>('/api/calculate-delivery', { chefId: group!.chefId, latitude: address!.latitude, longitude: address!.longitude, subtotal }) });
  const bonus = useQuery({ queryKey: ['customer', user.id, 'bonus', subtotal], enabled: !!token && subtotal > 0,
    queryFn: () => request<{eligible: boolean; bonus: number; reason?: string}>('/api/user/check-bonus-eligibility', { orderTotal: subtotal }) });
  const discount = applied?.subtotal === subtotal ? applied.discountAmount : 0;
  const convenience = platformFee(subtotal, payment.data || {});
  const deliveryFee = fee.data?.freeDeliveryEligible ? 0 : money(fee.data?.deliveryFee);
  const beforeCredit = Math.max(0, money(subtotal + deliveryFee + convenience - discount));
  const bonusAmount = useBonus && bonus.data?.eligible ? Math.min(bonus.data.bonus, beforeCredit) : 0;
  const afterBonus = Math.max(0, beforeCredit - bonusAmount);
  const walletAmount = useWallet && afterBonus >= (walletSettings.data?.minOrderAmount || 0) ? Math.min(money(wallet.data?.balance), walletSettings.data?.maxUsagePerOrder || 0, afterBonus) : 0;
  const total = money(afterBonus - walletAmount);
  const setting = cartSettings.data?.find(s => s.categoryId === group?.categoryId);
  const run = async (fn: () => Promise<void>) => {
    if (lock.current) return; lock.current = true; setBusy(true); setError(null);
    try { await fn(); } catch (e) { setError((e as Error).message); }
    finally { lock.current = false; setBusy(false); }
  };
  const placeOrder = () => run(async () => {
    await requireConnection();
    if(!token){if(!address||validateAddress(address))throw new Error('Complete your delivery address first.');await writePrivateJson(draftKey,{email,instructions,date,slotId,meal,coupon});login({name:'Checkout',params:route.params});return;}
    const previousPayment=await pendingPayment.read(user.id);if(previousPayment&&!['backend_recorded','closed'].includes(previousPayment.phase)){navigation.navigate('Payment',{id:previousPayment.id,kind:previousPayment.kind,amount:previousPayment.amount});return;}
    if (!attemptReady || unresolved || await AsyncStorage.getItem(attemptKey)) throw new Error('A previous order may have been received. Review Your orders or contact support before placing another order.');
    if (!group || !address) throw new Error('Choose a delivery address first.');
    const invalid = validateAddress(address); if (invalid) throw new Error(invalid);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.');
    if (requiresSlot && !(preorder ? meal : slotId)) throw new Error('Select a delivery slot.');
    if (coupon.trim() && (!applied || applied.code !== coupon.trim().toUpperCase() || applied.subtotal !== subtotal)) throw new Error('Apply or remove the coupon before continuing.');
    const latestCategories=await request<Category[]>('/api/categories'),currentCategory=latestCategories.find(c=>c.id===group.categoryId);if(!currentCategory)throw new Error('This food category is no longer available.');client.setQueryData(['customer',user.id,'/api/categories'],latestCategories);
    const latestRoti=currentCategory.name.toLowerCase().includes('roti');if((preorder||!!currentCategory.requiresDeliverySlot||latestRoti)!==requiresSlot||latestRoti!==rotiCategory)throw new Error('The delivery options changed. Review your refreshed checkout before continuing.');
    if(latestRoti){const rules=await request<RotiSettings>('/api/roti-settings');assertRotiOrderingAllowed(rules);}
    const chef = await request<Chef>('/api/chefs/' + encodeURIComponent(group.chefId));
    if (!(chef.isCurrentlyOpen ?? chef.isActive) && !preorder) throw new Error('This kitchen is currently closed.');
    // Validate stock/variants against fresh responses before a mutation.
    await Promise.all(group.items.map(async item => {
      const [product, offer] = await Promise.all([
        request<Product>('/api/products/' + encodeURIComponent(item.id)),
        request<{offer: ProductOffer | null}>('/api/products/' + encodeURIComponent(item.id) + '/offer'),
      ]);
      validateFreshItem(item, product, offer.offer);
    }));
    if (requiresSlot && !preorder) {
      const freshSlots=await request<Slot[]>('/api/delivery-slots');client.setQueryData(['customer',user.id,'/api/delivery-slots'],freshSlots);
      const selected = freshSlots.find(s => s.id === slotId && s.isActive !== false);
      if (!selected || slotTiming(selected, date).ended) throw new Error('This slot has passed or is unavailable. Choose another slot.');
      if (slotTiming(selected, date).late && !await confirm('Kitchen confirmation required', 'The booking cutoff has passed. The kitchen must confirm this delivery. Continue?')) return;
    }
    if (applied) {
      try {
        const fresh = await verifyCheckoutCoupon(request,applied.code,subtotal);
        if (money(fresh.discountAmount) !== money(applied.discountAmount)) {
          setApplied({...fresh, subtotal}); throw new Error('The coupon discount changed. Review your total and continue.');
        }
      } catch (e) {
        throw e;
      }
    }
    const [freshPayment, freshWallet, freshWalletSettings] = await Promise.all([payment.refetch(), wallet.refetch(), walletSettings.refetch()]);
    if (freshPayment.error || freshWallet.error || freshWalletSettings.error) throw new Error('Could not refresh checkout settings. Please try again.');
    const freshCredit = useWallet && afterBonus >= (freshWalletSettings.data?.minOrderAmount || 0) ? Math.min(money(freshWallet.data?.balance), freshWalletSettings.data?.maxUsagePerOrder || 0, afterBonus) : 0;
    if (platformFee(subtotal, freshPayment.data || {}) !== convenience || money(freshCredit) !== money(walletAmount)) throw new Error('Your fees or wallet credit changed. Review the updated total and continue.');
    let preorderTime: string | undefined;
    if (preorder) {
      const settings = await preorderSettings.refetch();
      if (settings.error || !settings.data) throw new Error('Could not load meal delivery times. Please try again.');
      preorderTime = meal === 'preorder-lunch' ? settings.data.preorder_lunch_start_time || '11:00' : settings.data.preorder_dinner_start_time || '18:00';
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(preorderTime)) throw new Error('The kitchen delivery time is not configured correctly. Choose another slot.');
      const check = await request<{allowed: boolean; requiresChefConfirmation: boolean; warning?: string}>('/api/orders/validate-preorder', { chefId: group.chefId, deliverySlotId: meal, deliveryDate: date });
      if (!check.allowed) throw new Error(check.warning || 'This preorder slot is unavailable.');
      if (check.requiresChefConfirmation && !await confirm('Kitchen confirmation required', check.warning || 'This preorder needs confirmation from the kitchen. Continue?')) return;
    }
    const freshFee = await fee.refetch();
    if (freshFee.error || !freshFee.data) throw freshFee.error || new Error('Unable to validate delivery charges.');
    if (freshFee.data.deliveryRangeName?.toLowerCase().includes('outside')) throw new Error('This kitchen does not deliver to your selected location. Choose another kitchen or address.');
    const freshDelivery = freshFee.data.freeDeliveryEligible ? 0 : money(freshFee.data.deliveryFee);
    if (Math.abs(freshDelivery - deliveryFee) > 0.01) throw new Error('Delivery charges changed. Review the updated total and continue.');

    let claimed = 0;
    if (bonusAmount > 0) { throw new Error('Referral bonus checkout requires a backend fix. Turn off bonus use; your wallet balance can still be used.'); }
    const selectedSlot = slots.data?.find(s => s.id === slotId);
    const payload = {
      customerName: user.name, phone: user.phone, email, address: addressText(address),
      addressBuilding: address.building, addressStreet: address.street, addressArea: address.area, addressCity: address.city, addressPincode: address.pincode,
      customerLatitude: address.latitude, customerLongitude: address.longitude, deliveryInstructions: instructions.trim(),
      chefId: group.chefId, categoryId: group.categoryId, categoryName: currentCategory.name,
      items: group.items.map(item => ({ id: item.id, name: item.name, price: money(lineTotal(item) / item.quantity), quantity: item.quantity,
        chefId: item.chefId, categoryId: item.categoryId, variantId: item.variantId, variantName: item.variantName, specialInstructions: item.specialInstructions })),
      subtotal, deliveryFee: freshDelivery, discount, total, couponCode: applied?.code, walletAmountUsed: walletAmount, bonusUsedAtCheckout: claimed,
      effectiveMode: preorder ? 'preorder' : undefined, deliverySlotId: requiresSlot ? (preorder ? meal : slotId) : undefined,
      deliveryDate: requiresSlot ? date : undefined, deliveryTime: requiresSlot ? (preorder ? preorderTime : selectedSlot?.startTime) : undefined,
      status: 'pending', paymentStatus: 'pending',
    };
    await AsyncStorage.setItem(attemptKey, JSON.stringify({createdAt:new Date().toISOString(),cartKey:group.key,items:group.items.map(i=>({id:i.id,variantId:i.variantId,quantity:i.quantity}))}));
    setUnresolved(true);
    const result = await request<Order | {order: Order}>('/api/orders', payload);
    const order = 'order' in result ? result.order : result;
    if (!order?.id) throw new Error('Order submission returned an unexpected response. Check My Orders before trying again.');
    await pendingPayment.save(user.id,{id:order.id,kind:'order',amount:Number(order.total),phase:'ready',createdAt:new Date().toISOString(),cartKey:group.key,cartSignature:cartSignature(group.items),deliveryAddress:addressText(address)});
    await AsyncStorage.removeItem(attemptKey);
    setUnresolved(false);
    await client.invalidateQueries({ queryKey: ['customer'] });
    navigation.replace('Payment', { id: order.id, kind: 'order', amount: Number(order.total) });
  });
  const reconcile = () => run(async () => {
    const raw = await AsyncStorage.getItem(attemptKey);
    if (!raw) {setUnresolved(false);return;}
    const attempt = JSON.parse(raw);
    const orders = await request<Order[]>('/api/user/orders');
    const signature = (items: Array<{id:string;variantId?:string;quantity:number}>) => items.map(i=>i.id+':'+(i.variantId||'')+':'+i.quantity).sort().join('|');
    const matches = orders.filter(o => o.chefId+':'+o.categoryId === attempt.cartKey && Date.parse(o.createdAt) >= Date.parse(attempt.createdAt)-30000 && Array.isArray(o.items) && signature(o.items) === signature(attempt.items || []));
    if (matches.length !== 1) throw new Error('We cannot uniquely identify this order yet. Check Your orders or contact support. Resubmission remains blocked to avoid a duplicate.');
    const found = matches[0];
    if (!await confirm('Is this your submitted order?', 'Order '+found.id+' · '+currency(found.total)+' · '+found.status+'. Confirm only if this matches the order you just placed.')) return;
    const kept=cart.groups.find(g=>g.key===attempt.cartKey);
    await pendingPayment.save(user.id,{id:found.id,kind:'order',amount:Number(found.total),phase:'ready',createdAt:found.createdAt,cartKey:attempt.cartKey,cartSignature:kept?cartSignature(kept.items):undefined,deliveryAddress:found.address});
    await AsyncStorage.removeItem(attemptKey);
    setUnresolved(false);
    navigation.replace('Payment',{id:found.id,kind:'order',amount:Number(found.total)});
  });
  if (!cart.ready) return <Loading />;
  if (!group) return <Page><Empty title="This basket is empty" /><Button title="View baskets" onPress={() => navigation.navigate('Cart')} /></Page>;
  return <Page><Title>Fresh food, almost home.</Title><Body muted>{group.chefName}</Body>
    {!!user.phone&&<Card><Heading>Delivery contact</Heading><Body>+91 {user.phone}</Body>{!token&&<Body muted>Your number is saved. Verify it when placing your order.</Body>}</Card>}
    <Card><Heading>Delivery address</Heading><Body>{address ? addressText(address) : 'Choose your delivery location'}</Body><Button title="Change address" secondary onPress={() => navigation.navigate('Address')} />
      {address && validateAddress(address) && <Body>{validateAddress(address)}</Body>}</Card>
    {requiresSlot && <Card><Heading>Delivery schedule</Heading><Row>{[0, 1].map(offset => <Chip key={offset} title={offset ? 'Tomorrow' : 'Today'} selected={date === businessDate(offset)} onPress={() => setDate(businessDate(offset))} />)}</Row>
      <Row>{preorder ? ['preorder-lunch', 'preorder-dinner'].map(value => <Chip key={value} title={value === 'preorder-lunch' ? 'Lunch · ' + (preorderSettings.data?.preorder_lunch_start_time || '11:00') : 'Dinner · ' + (preorderSettings.data?.preorder_dinner_start_time || '18:00')} selected={meal === value} onPress={() => setMeal(value)} />) : (slots.data || []).filter(s => s.isActive !== false).map(s => <Chip key={s.id} title={(s.label || s.name || s.startTime + '–' + s.endTime) + (slotTiming(s, date).ended ? ' · passed' : slotTiming(s, date).late ? ' · kitchen confirmation' : '')} selected={slotId === s.id} onPress={() => setSlotId(s.id)} />)}</Row>
      <Body muted>Availability and cutoff times are confirmed by the kitchen at checkout.</Body><ErrorView error={slots.error} /></Card>}
    <Card><Button title={showDetails?'Hide optional details':instructions||email?'Edit delivery note & email':'Add delivery note or email'} secondary onPress={()=>setShowDetails(value=>!value)}/>
      {!showDetails&&!!instructions&&<Body muted>{instructions}</Body>}
      {showDetails&&<><Field label="Delivery instructions (optional)" multiline value={instructions} onChangeText={setInstructions} maxLength={300}/><Field label="Email (optional)" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none"/></>}
    </Card>
    <Card><Heading>Offers & credits</Heading>{applied?.subtotal===subtotal&&<Card><Heading>{applied.code} applied</Heading><Body>You save {currency(applied.discountAmount)}</Body>{!token&&<Body muted>Final eligibility is checked after your number is verified.</Body>}<Button title="Remove coupon" secondary disabled={busy} onPress={()=>{setCoupon('');setApplied(null);}}/></Card>}<Button title={showCoupon?'Hide coupon entry':'Have a coupon?'} secondary onPress={()=>setShowCoupon(value=>!value)}/>{showCoupon&&<><Field label="Coupon code" editable={!busy} value={coupon} onChangeText={value => { setCoupon(value); setApplied(null); }} autoCapitalize="characters" />
      <Button title="Apply coupon" secondary disabled={busy || !coupon.trim()} onPress={() => run(async () => {
        try {
          const result = await verifyCheckoutCoupon(request,coupon,subtotal);
          setCoupon(result.code); setApplied({ ...result, subtotal });
        } catch (e) {
          throw e;
        }
      })} /></>}
      {token&&<>{wallet.data?<Toggle title={'Use wallet balance · ' + currency(wallet.data.balance)} value={useWallet} onChange={setUseWallet}/>:<Body muted>{wallet.isPending?'Checking wallet balance…':'Wallet balance unavailable. Refresh to use credits.'}</Body>}
      <Body muted>Up to {currency(walletSettings.data?.maxUsagePerOrder)} per order; minimum {currency(walletSettings.data?.minOrderAmount)}.</Body>
      {false && bonus.data?.eligible && <Toggle title={'Use referral bonus · ' + currency(bonus.data?.bonus)} value={useBonus} onChange={setUseBonus} />}
      <Button title="Apply a referral code" secondary onPress={() => navigation.navigate('Referrals')} /></>}
    </Card>
    <Card><Heading>Bill details</Heading>{group.items.map(item => <Body key={item.key}>{item.quantity} × {item.name}{item.variantName ? ' (' + item.variantName + ')' : ''} · {currency(lineTotal(item))}</Body>)}
      <Body>Items: {currency(subtotal)}</Body><Body>Delivery: {fee.isPending ? 'Calculating…' : currency(deliveryFee)}</Body><Body>Convenience fee: {currency(convenience)}</Body>
      {discount>0&&<Body>Coupon: −{currency(discount)}</Body>}{bonusAmount>0&&<Body>Referral bonus: −{currency(bonusAmount)}</Body>}{walletAmount>0&&<Body>Wallet: −{currency(walletAmount)}</Body>}<Heading>Total: {currency(total)}</Heading>
      {!!setting?.minOrderAmount && <Body muted>Delivery-fee threshold: {currency(setting.minOrderAmount)}. Delivery charges are confirmed for your address.</Body>}</Card>
    <Card><Heading>Pay with UPI</Heading><Body muted>Choose GPay, a compatible UPI app or QR after reviewing your order. Payment is confirmed by RotiHai.</Body></Card>
    {unresolved && <Card><Heading>Check your previous request</Heading><Body>Your basket is safe. Check your orders before submitting again.</Body><Button title="Check order status" disabled={busy} onPress={reconcile}/></Card>}
    {savedPayment&&!['backend_recorded','closed'].includes(savedPayment.phase)&&<Card><Heading>Continue your existing payment</Heading><Body>Your basket is kept until payment is recorded. Reuse the existing order reference before placing another order.</Body><Button title="Resume saved payment" onPress={()=>navigation.navigate('Payment',{id:savedPayment.id,kind:savedPayment.kind,amount:savedPayment.amount})}/></Card>}
    {rotiBlocked&&<Card><Heading>Ordering window</Heading><Body>{rotiSettings.data?.blockMessage}</Body></Card>}
    <ErrorView error={error || fee.error || payment.error || walletSettings.error || (rotiCategory?rotiSettings.error:null)} retry={() => { void fee.refetch(); void payment.refetch(); }} />
    <Button title={busy ? 'Please wait…' : (token?'Place order · ':'Verify & place order · ') + currency(total)} disabled={busy || !!rotiBlocked || (rotiCategory&&(rotiSettings.isPending||!!rotiSettings.error||!rotiSettings.data)) || unresolved || !attemptReady || !draftReady || !address || !!validateAddress(address) || fee.isPending || !!fee.error || !payment.data || !walletSettings.data} onPress={placeOrder} />
  </Page>;
}

