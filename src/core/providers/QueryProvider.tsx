import React, { useState, useEffect } from 'react';
import * as Network from 'expo-network';
import {isConnected} from '../api/connectivity';
import { AppState } from 'react-native';
import { QueryClient, QueryClientProvider, focusManager, onlineManager } from '@tanstack/react-query';
export function QueryProvider({ children }: React.PropsWithChildren) {
  const [client] = useState(() => new QueryClient({ defaultOptions: {
    queries: { staleTime: 20000, retry: 1, refetchOnWindowFocus: true, networkMode:'always', refetchOnReconnect:'always' },
    mutations: { retry: false },
  } }));
  useEffect(() => {
    onlineManager.setEventListener(setOnline=>{void isConnected().then(setOnline);const connection=Network.addNetworkStateListener(state=>setOnline(state.isConnected!==false&&state.isInternetReachable!==false));return()=>connection.remove();});
    const sub = AppState.addEventListener('change', state => focusManager.setFocused(state === 'active'));
    return () => sub.remove();
  }, []);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

