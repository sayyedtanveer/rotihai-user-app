# Customer feature source map

All source paths below are relative to ../Replitrotihai. This is an implementation reference, not an assertion that features have been ported.

## Web routes

| Web route | Customer source | Future mobile destination |
| --- | --- | --- |
| / | client/src/pages/Home.tsx | Home |
| /landing | client/src/pages/Landing.tsx | Landing |
| /my-orders and /orders | client/src/pages/MyOrders.tsx | Orders |
| /track/:orderId | client/src/pages/OrderTracking.tsx | OrderTracking |
| /my-subscriptions | client/src/pages/MySubscriptions.tsx | Subscriptions |
| /custom-subscription | client/src/pages/CustomSubscriptionRequest.tsx | CustomSubscriptionRequest |
| /profile | client/src/pages/Profile.tsx | Profile |
| /invite | client/src/pages/InviteEarn.tsx | InviteEarn |
| /privacy-policy | client/src/pages/PrivacyPolicy.tsx | PrivacyPolicy |
| Fallback | client/src/pages/not-found.tsx | NotFound |

Review customer authentication gates in client/src/App.tsx when implementing native navigation.

## Customer flows embedded in web components

| Feature | Existing web references | Application folder |
| --- | --- | --- |
| Login, account creation, password changes | components/LoginDialog.tsx, AccountCreatedDialog.tsx, ChangePasswordDialog.tsx; hooks/useAuth.ts, usePhoneAuth.ts | auth |
| Categories, chefs, menus, products, variants | pages/Home.tsx; components/CategoryCard.tsx, CategoryMenuDrawer.tsx, ChefListDrawer.tsx, MenuDrawer.tsx, ProductCard.tsx, VariantSelectorDialog.tsx | catalog |
| Location, addresses, serviceability | contexts/DeliveryLocationContext.tsx; hooks/useLocation.ts, useDeliveryZone.ts, useDeliveryConfig.ts, useCheckoutAddress.ts; components/DeliveryAddressSelector.tsx, AreaSelector.tsx, AddressVerificationDrawer.tsx, StreetRefinementSheet.tsx | location |
| Cart and pricing | hooks/use-cart.ts; components/CartSidebar.tsx, CartCard.tsx, CartPricingBreakdown.tsx | cart |
| Checkout and address confirmation | components/CheckoutDialog.tsx, CheckoutAddressCard.tsx, OrderSummaryCard.tsx | checkout |
| Payment and QR/UPI flow | components/PaymentQRDialog.tsx; lib/upi-payment.ts, paymentConfig.ts | payments |
| Orders, details, cancellation, tracking | pages/MyOrders.tsx, OrderTracking.tsx; components/ActiveOrderBanner.tsx; hooks/useOrderNotifications.ts | orders |
| Subscription purchase, schedule and management | pages/MySubscriptions.tsx, CustomSubscriptionRequest.tsx; components/SubscriptionDrawer.tsx, SubscriptionCard.tsx, SubscriptionSchedule.tsx, SubscriptionAddressInput.tsx | subscriptions |
| Customer account | pages/Profile.tsx; types/profileuser.ts | profile |
| Wallet balance and updates | pages/Profile.tsx; hooks/useWalletUpdates.ts | wallet |
| Invite and referral rewards | pages/InviteEarn.tsx; hooks/useApplyReferral.ts, useValidateReferralCode.ts | referrals |
| Promotions, offers and coupon behavior | components/PromotionalBannersSection.tsx, ProductCardWithOffer.tsx; hooks/useOffers.ts; components/CheckoutDialog.tsx; hooks/use-cart.ts | offers |
| Customer notifications and push | components/NotificationBell.tsx; hooks/useCustomerNotifications.ts, useOrderNotifications.ts, usePushNotifications.ts | notifications |

Paths in the table use client/src/ as their base unless explicitly starting with client/src/.

## Native integration work for later

- Follow ../RotiHaiMobileApp/src/core for native infrastructure boundaries.
- Use customer auth semantics from the web app; do not reuse partner endpoints or token namespaces.
- Derive customer-only DTOs from actual backend responses rather than importing Drizzle/server dependencies.
- Review shared/timeFormatter.ts and shared/deliveryUtils.ts for customer-facing rules before deciding what to port.
- Preserve server-authoritative pricing, delivery eligibility, payment, coupon, and subscription rules.
- Review browser storage, geolocation, notifications, realtime events, and UPI behavior for native equivalents.
- Keep API and WebSocket origins configurable. Public Expo variables must never contain secrets.

## Excluded modules

All admin, partner management, and delivery-worker pages, hooks, dashboards, guards, endpoints, and role-specific providers are outside this app. Customer-facing chef selection, delivery addresses, delivery estimates, and order tracking are included in future customer scope.
