import React, { useState, useEffect } from 'react';
import { AppState } from 'react-native';
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
export function QueryProvider({ children }: React.PropsWithChildren) {
  const [client] = useState(() => new QueryClient({ defaultOptions: {
    queries: { staleTime: 20000, retry: 1, refetchOnWindowFocus: true },
    mutations: { retry: false },
  } }));
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => focusManager.setFocused(state === 'active'));
    return () => sub.remove();
  }, []);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

