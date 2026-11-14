import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, customerApi } from '../api/customerApi';
import type { User, Notice } from '../api/models';
import { ErrorView, Loading, Page, Button } from '../../presentation/user/components/UI';

type Context = { login: (destination?: any) => void; user: User; token: string; request: <T>(path: string, body?: unknown, method?: string, headers?: Record<string,string>) => Promise<T>; logout: () => void; notices: Notice[]; markRead: () => void };
const CustomerContext = createContext<Context | null>(null);
export function CustomerProvider({ token, onLogout, onLogin, children }: React.PropsWithChildren<{ token: string; onLogin: (destination?: any) => void; onLogout: () => void }>) {
  const client = useQueryClient();
  const request = useCallback(async <T,>(path: string, body?: unknown, method?: string, headers?: Record<string,string>): Promise<T> => {
    try { return await customerApi<T>(path, body, token, method, headers); }
    catch (e) { if (e instanceof ApiError && e.status === 401 && token && path !== '/api/user/change-password') onLogout(); throw e; }
  }, [token, onLogout]);
  const profile = useQuery({queryKey:['customer',token,'/api/user/profile'], enabled:!!token, queryFn:()=>request<User>('/api/user/profile')});
  const [notices, setNotices] = useState<Notice[]>([]);
  const userId = profile.data?.id;
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
    if (!userId) return;
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
  const guest: User = {id:'guest', name:'Guest', phone:''};
  const value = {user: token ? profile.data! : guest, token, request, logout:onLogout, notices, markRead, login:onLogin};
  if (token && profile.isPending) return <Loading/>;
  if (token && !profile.data) return <Page><ErrorView error={profile.error} retry={()=>void profile.refetch()}/><Button title="Continue browsing" onPress={onLogout}/></Page>;
  return <CustomerContext.Provider value={value}>{children}</CustomerContext.Provider>;
}
export function useCustomer() { const value = useContext(CustomerContext); if (!value) throw new Error('CustomerProvider missing'); return value; }
export function useApi<T>(path: string, options: { enabled?: boolean; interval?: number } = {}) {
  const { request, user } = useCustomer();
  return useQuery({ queryKey: ['customer', user.id, path], queryFn: () => request<T>(path), enabled: options.enabled, refetchInterval: options.interval });
}

