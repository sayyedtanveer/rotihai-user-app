import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CartItem } from '../../../core/api/models';
import { useCustomer } from '../../../core/providers/CustomerProvider';
import { assertCanAdd, groupCart, groupKey } from './cartRules';
type Context = { items: CartItem[]; restore: (items: CartItem[]) => void; ready: boolean; error: string | null; add: (item: CartItem) => void; quantity: (key: string, count: number) => void; instructions: (key: string, text: string) => void; clear: (group: string) => void };
const CartContext = createContext<Context | null>(null);
export function CartProvider({ children }: React.PropsWithChildren) {
  const { user } = useCustomer();
  const [items, setItems] = useState<CartItem[]>([]);
  const current = useRef(items);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const writes = useRef(Promise.resolve());
  const key = 'customer-cart:' + ((__DEV__&&process.env.EXPO_PUBLIC_UI_REVIEW==='1'&&user.id==='guest')?'ui-review-guest':user.id);
  useEffect(() => {
    let active = true;
    setReady(false); current.current = []; setItems([]); setError(null);
    void AsyncStorage.getItem(key).then(raw => {
      if (!active) return;
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const valid = parsed.filter((item): item is CartItem => item && typeof item.key === 'string' && typeof item.id === 'string' && typeof item.chefId === 'string' && Number.isFinite(item.quantity) && item.quantity > 0);
          current.current = valid; setItems(valid);
        }
      }
    }).catch(() => { if (active) setError('Your saved cart could not be loaded.'); }).finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, [key]);
  const commit = (next: CartItem[]) => {
    if (!ready) throw new Error('Your cart is still loading.');
    current.current = next; setItems(next); setError(null);
    writes.current = writes.current.catch(() => {}).then(() => AsyncStorage.setItem(key, JSON.stringify(next))).catch(() => setError('Could not save your cart on this device.'));
  };
  const value: Context = {
    items, ready, error,
    restore(restored) {
      const keys = new Set(restored.map(groupKey));
      const next = current.current.filter(item => !keys.has(groupKey(item)));
      for (const item of restored) {
        assertCanAdd(next, item);
        if (next.some(existing => existing.key === item.key)) throw new Error('The saved basket contains duplicate items. Please add these dishes from the menu.');
        next.push(item);
      }
      commit(next);
    },
    add(item) {
      assertCanAdd(current.current, item);
      const old = current.current.find(v => v.key === item.key);
      commit(old ? current.current.map(v => v.key === item.key ? { ...item, quantity: old.quantity + item.quantity } : v) : [...current.current, item]);
    },
    quantity(itemKey, count) {
      if (!Number.isInteger(count) || count < 0) throw new Error('Choose a whole quantity.');
      const item = current.current.find(v => v.key === itemKey);
      if (!item) return;
      if (count > Math.min(item.stockQuantity, item.offer?.maxOrderQuantity ?? Infinity)) throw new Error('The requested quantity is not available.');
      commit(count <= 0 ? current.current.filter(v => v.key !== itemKey) : current.current.map(v => v.key === itemKey ? { ...v, quantity: count } : v));
    },
    instructions(itemKey, text) { commit(current.current.map(v => v.key === itemKey ? { ...v, specialInstructions: text } : v)); },
    clear(group) { commit(current.current.filter(v => groupKey(v) !== group)); },
  };
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
export function useCart() { const context = useContext(CartContext); if (!context) throw new Error('CartProvider missing'); return { ...context, groups: useMemo(() => groupCart(context.items), [context.items]) }; }

