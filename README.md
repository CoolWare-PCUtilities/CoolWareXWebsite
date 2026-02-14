# CoolWareX Website

Static Netlify site + Netlify Functions for **CoolAutoSorter** fulfillment and support flows.

## Stack
- Static HTML/CSS/vanilla JS
- Netlify Functions (`netlify/functions`)
- Netlify Blobs for fulfillment records + lookup + update subscriptions

## Local development
1. Install dependencies:
   ```bash
   npm install
   ```
2. Set env vars in `.env` for local dev, and in the Netlify UI for deployed functions.
3. Run locally:
   ```bash
   npx netlify dev
   ```

## Required environment variables
- `SITE_URL` (e.g. `https://coolwarex.netlify.app`)
- `STRIPE_WEBHOOK_SECRET`
- `LICENSE_SIGNING_SSH_PRIVATE_KEY_B64`
- `EMAIL_PROVIDER` (`resend` or `sendgrid`)
- `EMAIL_PROVIDER_API_KEY`
- `EMAIL_FROM` (e.g. `CoolWareX <coolwarex@proton.me>`)
- `SUPPORT_EMAIL` (`coolwarex@proton.me`)

### `LICENSE_SIGNING_SSH_PRIVATE_KEY_B64` format
This value is **base64 of the raw bytes of your OpenSSH private key file** (for example `~/.ssh/id_ed25519`).

Example:
```bash
base64 < ~/.ssh/id_ed25519 | tr -d '\n'
```

At runtime, functions parse this OpenSSH key, derive the Ed25519 signing secret, and expose the raw public key as base64 via `/.netlify/functions/debug-license-key` in non-production (or with `DEBUG_TOKEN`).

Expected public key for this app:
- `1yYXI2GP9UUbYGozDUGof1KRQyx8WOeNeKx5aW8cgq0=`

Use the debug endpoint response field `derivedPublicKeyB64` to confirm it matches.

License key output format:

`COOLWAREX-<base64url(payload_json)>.<base64url(signature)>`

Payload fields:
- `product` (`CoolAutoSorter`)
- `license_type` (`lifetime`)
- `issued_at` (ISO timestamp)
- `order_id` (Stripe Payment Link checkout session id)
- `purchaser_email_hash` (`sha256(lowercase(trim(email)))`)

## Stripe test mode flow
1. Create/update the Stripe Payment Link used on the site for **CoolAutoSorter** at **$14.99 one-time**.
2. Configure webhook endpoint:
   - URL: `https://<site>/.netlify/functions/stripe-webhook`
   - Event: `checkout.session.completed`
3. Complete a test purchase with a Stripe test card from the Payment Link.
4. Confirm:
   - Redirect to `/success`
   - webhook returns `200`
   - fulfillment is stored idempotently by `session_id`
   - license email is sent
   - lookup by purchase email returns license


## Netlify environment variable scope note
Do **not** rely on `netlify.toml` environment variables for function runtime secrets. Set function secrets in the Netlify UI with **Functions** scope (Site configuration → Environment variables), including:
- `LICENSE_SIGNING_SSH_PRIVATE_KEY_B64`
- `STRIPE_WEBHOOK_SECRET`
- `EMAIL_PROVIDER_API_KEY`
- `DEBUG_TOKEN` (optional)
