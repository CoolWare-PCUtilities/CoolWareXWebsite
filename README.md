# CoolWareX Website

Marketing + checkout site for **CoolWareX** (static pages + Netlify Functions).

## Stack
- Static HTML/CSS/JS frontend
- Netlify Functions for Stripe checkout + webhook fulfillment + license lookup
- Netlify Blobs for fulfillment storage

## Local development
1. Install dependencies:
   ```bash
   npm install
   ```
2. Add environment variables in `.env` (or Netlify UI).
3. Run:
   ```bash
   npx netlify dev
   ```

## Required environment variables
- `SITE_URL` (example: `https://coolwarex.netlify.app`)
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ID`
- `LICENSE_SIGNING_PRIVATE_KEY` (base64-encoded PKCS8 DER Ed25519 private key)
- `EMAIL_PROVIDER_API_KEY` (Resend or SendGrid)
- `EMAIL_FROM` (example: `CoolWareX <coolwarex@proton.me>`)
- `SUPPORT_EMAIL` (`coolwarex@proton.me`)

## Stripe setup
1. Create product **CoolAutoSorter** with a `$14.99` one-time price.
2. Copy the Stripe price id to `STRIPE_PRICE_ID`.
3. Create webhook endpoint in Stripe:
   - URL: `https://<your-site>/.netlify/functions/stripe-webhook`
   - Event: `checkout.session.completed`
4. Copy webhook signing secret to `STRIPE_WEBHOOK_SECRET`.

## Checkout + fulfillment flow
1. User clicks **Buy Lifetime License**.
2. Frontend calls `/.netlify/functions/create-checkout-session`.
3. Stripe Checkout handles payment.
4. Stripe webhook calls `/.netlify/functions/stripe-webhook`.
5. Webhook verifies signature, creates signed license key, stores fulfillment in Netlify Blobs, and emails the license key.

License format:

`COOLWAREX-<base64url(payload_json)>.<base64url(signature_bytes)>`

Payload claims include:
- `product`
- `license_type`
- `issued_at`
- `purchaser_email`
- `order_id`

## Signing key rotation
1. Generate a new Ed25519 keypair.
2. Update app with the **new public key** while still accepting prior keys during rollout.
3. Update Netlify `LICENSE_SIGNING_PRIVATE_KEY` to the new private key.
4. Remove old public key support in a later app release.

## Test mode checklist
- Use Stripe test keys.
- Complete checkout with a Stripe test card.
- Confirm redirect to `success.html`.
- Confirm webhook in Stripe dashboard is `200`.
- Confirm blob records are created (`session:*`, `email:*`).
- Confirm support lookup returns key for the purchase email.
