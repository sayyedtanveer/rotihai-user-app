import {checkoutAddress} from '../storage/checkoutState';
import {provisionalContact} from '../storage/provisionalContact';
import {readAddress} from '../../application/user/cart/cartRules';
import {cachedProfile,isCachedDelivery,subscribeCacheDelivery} from '../api/offlineCache';
import {useConnectivity} from '../api/connectivity';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { AppState,View,Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, customerApi } from '../api/customerApi';
import type { User, Notice, Address } from '../api/models';
import { ErrorView, Loading, Page, Button } from '../../presentation/user/components/UI';

type Context = { deliveryAddress:Address|null; saveDeliveryAddress:(address:Address)=>Promise<void>; login: (destination?: any) => void; user: User; token: string; request: <T>(path: string, body?: unknown, method?: string, headers?: Record<string,string>) => Promise<T>; logout: () => void; notices: Notice[]; markRead: () => void };
const CustomerContext = createContext<Context | null>(null);
export function CustomerProvider({ token, onLogout, onLogin, children }: React.PropsWithChildren<{ token: string; onLogin: (destination?: any, contactPhone?:string) => void; onLogout: () => void }>) {
  const client = useQueryClient();
  const request = useCallback(async <T,>(path: string, body?: unknown, method?: string, headers?: Record<string,string>): Promise<T> => {
    try { return await customerApi<T>(path, body, token, method, headers); }
    catch (e) { if (e instanceof ApiError && e.status === 401 && token && path !== '/api/user/change-password') onLogout(); throw e; }
  }, [token, onLogout]);
  const profile = useQuery({queryKey:['customer',token,'/api/user/profile'], enabled:!!token, queryFn:()=>request<User>('/api/user/profile')});
  const online=useConnectivity();
  const [localProfile,setLocalProfile]=useState<{token:string;user:User}|null>(null);
  useEffect(()=>{let alive=true;if(token)void cachedProfile(token).then(p=>{if(alive)setLocalProfile(p?{token,user:p}:null);});else setLocalProfile(null);return()=>{alive=false;};},[token]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const userId = profile.data?.id || (token&&localProfile?.token===token?localProfile.user.id:undefined);
  useEffect(() => {
    if (!userId) return;
    let active = true;
    void AsyncStorage.getItem('notices:' + userId).then(value => {
      if (!active || !value) return;
      try { const data = JSON.parse(value); if (Array.isArray(data)) setNotices(data.slice(0, 100)); } catch {}
    });
    return () => { active = false; };
  }, [userId]);
  useEffect(() => {
    if (!userId || (__DEV__&&process.env.EXPO_PUBLIC_UI_REVIEW==='1')) return;
    const base = process.env.EXPO_PUBLIC_API_BASE_URL;
    if (!base?.startsWith('https://') || base.includes('example.com')) return;
    let socket: WebSocket | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    let delay = 1000;
    const connect = () => {
      if (stopped || AppState.currentState !== 'active') return;
      socket = new WebSocket(base.replace(/^https:/, 'wss:').replace(/\/$/, '') + '/ws?type=browser&userId=' + encodeURIComponent(userId));
      socket.onopen = () => { delay = 1000; void client.invalidateQueries({ queryKey: ['customer'] }); };
      socket.onmessage = e => {
        try {
          const event = JSON.parse(e.data);
          if (!event || typeof event.type !== 'string') return;
          void client.invalidateQueries({ queryKey: ['customer'] });
          const data = event.data || {};
          // Persist account-specific events only, never other customers' order data.
          if (data.userId !== userId) return;
          const title = event.type.replace(/_/g, ' ');
          const id = String(data.id || data.orderId || title) + ':' + String(data.status || data.amount || '');
          setNotices(previous => {
            if (previous.some(n => n.id === id)) return previous;
            const next = [{ id, title, message: String(data.message || data.status || title), createdAt: new Date().toISOString(), read: false, orderId: event.type.includes('order') ? String(data.orderId || data.id || '') : undefined }, ...previous].slice(0, 100);
            void AsyncStorage.setItem('notices:' + userId, JSON.stringify(next)).catch(() => {});
            return next;
          });
        } catch {}
      };
      socket.onclose = () => { if (!stopped) { timer = setTimeout(connect, delay); delay = Math.min(delay * 2, 30000); } };
      socket.onerror = () => socket?.close();
    };
    connect();
    const appState = AppState.addEventListener('change', state => {
      if (timer) clearTimeout(timer);
      if (state === 'active') { if (socket) { socket.onclose = null; socket.close(); } connect(); }
      else { if (socket) { socket.onclose = null; socket.close(); } }
    });
    return () => { stopped = true; if (timer) clearTimeout(timer); socket?.close(); appState.remove(); };
  }, [userId, client]);
  const markRead = useCallback(() => setNotices(previous => {
    const next = previous.map(n => ({ ...n, read: true }));
    if (userId) void AsyncStorage.setItem('notices:' + userId, JSON.stringify(next)).catch(() => {});
    return next;
  }), [userId]);
  const profileCached=useSyncExternalStore(subscribeCacheDelivery,()=>isCachedDelivery('/api/user/profile',userId));
  const resolvedProfile=profile.data||(localProfile?.token===token?localProfile.user:null);
  const [contact,setContact]=useState(''),[contactName,setContactName]=useState('');
  const owner=token?resolvedProfile?.id:'guest';
  const [localAddress,setLocalAddress]=useState<{owner:string;address:Address|null}|null>(null);
  useEffect(()=>{let alive=true;if(!token){if(__DEV__&&process.env.EXPO_PUBLIC_UI_REVIEW==='1')setContact('9000000000');else void Promise.all([provisionalContact.read(),provisionalContact.readName()]).then(([value,name])=>{if(alive){setContact(value||'');setContactName(name);}});}return()=>{alive=false;};},[token]);
  useEffect(()=>{let alive=true;if(owner)void checkoutAddress.read(owner).then(address=>{if(alive)setLocalAddress({owner,address});});return()=>{alive=false;};},[owner]);
  const guest: User = {id:'guest', name:contactName||'Guest', phone:contact};
  const deliveryAddress=owner&&localAddress?.owner===owner&&localAddress.address?localAddress.address:readAddress(resolvedProfile||guest);
  const saveDeliveryAddress=async(address:Address)=>{if(!owner)throw new Error('Your delivery details are still loading.');if(token)await request('/api/user/profile',{latitude:address.latitude,longitude:address.longitude,defaultDeliveryAddress:address},'PUT');await checkoutAddress.save(owner,address);setLocalAddress({owner,address});if(token)await client.invalidateQueries({queryKey:['customer']});};
  const value = {deliveryAddress,saveDeliveryAddress,user: token ? resolvedProfile! : guest, token, request, logout:onLogout, notices, markRead, login:(destination?:any)=>onLogin(destination,(token?resolvedProfile?.phone:contact)||undefined)};
  if(owner&&localAddress?.owner!==owner)return <Loading/>;
  if (token && profile.isPending && !resolvedProfile) return <Loading/>;
  if (token && !resolvedProfile) return <Page><ErrorView error={profile.error} retry={()=>void profile.refetch()}/><Button title="Continue browsing" onPress={onLogout}/></Page>;
  return <CustomerContext.Provider value={value}>{(!online||profileCached)&&<View style={{paddingHorizontal:16,paddingVertical:8,backgroundColor:"#fff3e2"}}><Text accessibilityRole="alert" style={{fontSize:11,color:"#713908"}}>{online?'Saved profile · refresh to check current account information.':'Offline · showing saved information. Prices and availability must be refreshed before ordering.'}</Text></View>}{children}</CustomerContext.Provider>;
}
export function useCustomer() { const value = useContext(CustomerContext); if (!value) throw new Error('CustomerProvider missing'); return value; }
export function useApi<T>(path: string, options: { enabled?: boolean; interval?: number } = {}) {
  const { request, user } = useCustomer();
  const isCached=useSyncExternalStore(subscribeCacheDelivery,()=>isCachedDelivery(path,user.id));
  const result=useQuery({ queryKey: ['customer', user.id, path], queryFn: () => request<T>(path), enabled: options.enabled, refetchInterval: options.interval });
  return {...result,isCached};
}

