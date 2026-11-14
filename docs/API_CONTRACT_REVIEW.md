# Customer API contract review

Source: read-only web routes/schema/admin code. All mobile calls use the existing customerApi and CustomerProvider. Private calls use the existing bearer session. Public reads never receive admin credentials.

| Consumer | Existing endpoint / key fields | Refresh / errors / cache |
|---|---|---|
| Startup contact | Local provisionalContact; phone and verified:false | Normalized Indian number; does not create an authenticated identity. |
| Verification | POST /api/user/otp/send {phone}; POST /api/user/otp/verify {phone,code} | Reuses the captured number, existing resend cooldown and server errors. No live SMS test. |
| Profile / address | GET /api/user/profile; PUT same structured defaultDeliveryAddress and coordinates | Protected; exact token-bound offline snapshot; no fallback on 401. Guest address stays local until verified migration. |
| Home / menus | GET categories, products, chefs/by-location, product detail/offer | Preserve section/sectionOrder/sortOrder, variants, actual image URL and inactive state. Public saved snapshots are labelled. |
| CMS promotions | GET /api/promotional-banners | title, subtitle, buttonText, gradients, actionType/actionValue, isActive/displayOrder. Supported subscription/category/http(s) actions only. |
| Plans | GET /api/subscription-plans | categoryId, sectionName/sectionOrder, frequency, price, deliveryDays, items; fresh recheck before creation. |
| Cart / inventory | Product, variant, offer, chef and radius reads | Local Add has no optional-network dependency. Explicit refresh replaces only its basket after checking concurrent edits. Checkout requires current values. |
| Coupon | POST /api/coupons/verify {code,orderAmount} | Server supplies discount and eligibility errors. No spoofed userId or privileged admin coupon list. Fresh verification before submission. |
| Referrals | GET /api/referral-settings; private referral-stats/referrals/eligibility | Actual totalEarnings, bonus/minimum/expiry/limits. Missing monthly fields do not become fabricated statistics. |
| Wallet | Private /api/user/wallet and wallet/transactions; public wallet-settings | Actual balance and server limits; unknown balance is not zero. Financial use requires connectivity. |
| Delivery / scheduling | POST /api/calculate-delivery; GET delivery-slots, cart-settings, admin-settings, roti-settings | Fresh delivery quote and slot checks. minOrderAmount is a fee-waiver threshold. Actual morning roti block applies to Roti; past-last-order is not a blanket ban on preorder meals. |
| Order creation / history | POST /api/orders; GET /api/orders and /api/orders/:id | Existing pending-order lifecycle. Unknown creation response is retained for reconciliation. Mobile checks owner before displaying detail. Public detail lookup still needs server authorization. |
| Subscription management | Existing subscriptions, /:id/schedule, pause/resume, skip-delivery, delivery-time and renew routes | Real schedules and statuses. Creation/renewal ambiguity is persisted. No invented customer cancel API. Non-monthly renewal calculation needs a backend fix. |
| Custom roti | GET /api/custom-subscription/price-per-roti; GET requests; POST request | Current admin price, web 7/30-day estimate, actual approval statuses, active/ambiguous request checks. Server must enforce trusted calculation/idempotency. |
| Payment | GET payment-settings and fresh order/schedule status; order payment-initiated | Same UPI payee/currency-only protocol as web; no fake paid signal from app return. Persist before handoff. |
| Manual reference | POST /api/subscriptions/:id/payment-confirmed {paymentTransactionId} | Distinct subscription route records a reference for review without isPaid. Fresh existing-reference guard. Unsafe order route is not called. |
| Newsletter | POST /api/newsletter/subscribe {email} | Existing optional user action; server response/errors shown. Review does not submit it. |

Public snapshots expire after seven days. Private cached profile/orders/subscriptions use SecureStore and exact token binding. Financial reads require fresh responses; offline mutations fail rather than queue. Reconnect refreshes reads only.

The web's phone-only login-or-create returns existing-account tokens without verification. It is not used as identity proof by mobile. Backend quote/idempotency, public order-detail authorization, atomic referral credit, campaign deactivation and non-monthly renewal remain explicit server dependencies.
