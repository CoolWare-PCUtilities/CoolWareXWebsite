# CoolWareX Website

Static Netlify site + Netlify Functions for direct sales of **CoolAutoSorter**.

## Stack
- Static HTML/CSS/vanilla JS
- Netlify Functions (`netlify/functions`)
- Netlify Blobs for fulfillment records + lookup + update subscriptions

## Local development
1. Install dependencies:
   ```bash
   npm install
   ```
2. Set env vars in `.env` (or Netlify UI).
3. Run locally:
   ```bash
   npx netlify dev
   ```

## Required environment variables
- `SITE_URL` (e.g. `https://coolwarex.netlify.app`)
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ID`
- `LICENSE_SIGNING_PRIVATE_KEY_B64`
- `EMAIL_PROVIDER` (`resend` or `sendgrid`)
- `EMAIL_PROVIDER_API_KEY`
- `EMAIL_FROM` (e.g. `CoolWareX <coolwarex@proton.me>`)
- `SUPPORT_EMAIL` (`coolwarex@proton.me`)

### `LICENSE_SIGNING_PRIVATE_KEY_B64` format
Ed25519 private key base64. Two formats are accepted:
- 32-byte raw private key bytes (base64 encoded)
- PKCS8 DER private key bytes (base64 encoded)

License key output format:

`COOLWAREX-<base64url(payload_json)>.<base64url(signature)>`

Payload fields:
- `product` (`CoolAutoSorter`)
- `license_type` (`lifetime`)
- `issued_at` (ISO timestamp)
- `order_id` (Stripe checkout session id)
- `purchaser_email_hash` (`sha256(lowercase(trim(email)))`)

## Stripe test mode flow
1. Create a Stripe product/price for **CoolAutoSorter** at **$14.99 one-time**.
2. Set `STRIPE_PRICE_ID` to that price.
3. Configure webhook endpoint:
   - URL: `https://<site>/.netlify/functions/stripe-webhook`
   - Event: `checkout.session.completed`
4. Complete a test purchase with a Stripe test card from site checkout.
5. Confirm:
   - Redirect to `/success`
   - webhook returns `200`
   - fulfillment is stored idempotently by `session_id`
   - license email is sent
   - lookup by purchase email returns license
