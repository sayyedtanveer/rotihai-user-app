import React, { type PropsWithChildren } from 'react';
import {QueryProvider} from './QueryProvider';
import {DeliveryAreaProvider} from '../location/DeliveryAreaProvider';

// Provider boundary matching the chef app. Add customer providers during implementation.
export function AppProviders({ children }: PropsWithChildren) {
  return <QueryProvider><DeliveryAreaProvider>{children}</DeliveryAreaProvider></QueryProvider>;
}
