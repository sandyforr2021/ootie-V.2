# OOTIE Subscription and Credits Demo

This is a Development simulation, not payment processing.

## Provider contract

`PaymentProvider` exposes `subscribe`, `cancelSubscription`, `purchaseCredits`, and `getSubscriptionStatus`. `DemoPaymentProvider` is the only implementation. It calls scoped Supabase RPCs and never contacts a payment gateway.

Plans are FREE, PLUS and PRO. Displayed monthly prices are Demo values. There are no card fields, webhooks, recurring charges, refunds, or payment credentials.

## Points

The existing `ootie_point_transactions` ledger is the only wallet. Demo sources include subscription grants, credit packs, promotion and birthday reward. Image costs are configurable server values:

- `VTO_POINTS_COST=8`
- `OUTFIT_PREVIEW_POINTS_COST=12`

Points and the hard daily image quota are independent. Development remains capped at 3 images per member per day.

The Gateway claims an idempotent generation first, validates inputs, then debits once immediately before the provider call. A duplicate generation ID does not deduct twice. Insufficient points blocks the provider. If a provider call may already have incurred cost, the generation and point ledger remain auditable.

## Birthday reward

`grant_ootie_birthday_points` reads the private profile birth date server-side and keys the transaction by calendar year. The same member/year can be granted only once. Birth date is never copied to the public profile.

## Security and Production boundary

Authenticated members can only read their subscription and point history. Demo mutations are validated by SECURITY DEFINER RPCs using `auth.uid()`. Migration 021 grants the server-only seed runner access to canonical saved-outfit rows; review and replace Development seed grants before any Production plan.
