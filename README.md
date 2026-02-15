# CoolWareX Website

Static Netlify site for CoolWareX with Netlify Functions for Stripe webhook fulfillment, license lookup, and update subscriptions.

## Stack
- Static HTML/CSS/JS frontend
- Netlify Functions (Node.js 20)
- Netlify Blobs stores for licenses, idempotency, and rate limits

## Local development (Windows)
1. Install **Node.js 20.x** and npm.
2. Install dependencies:
   ```powershell
   npm ci
   ```
3. Copy `.env.example` to `.env` and fill in required secrets.
4. Run local Netlify dev:
   ```powershell
   npm run dev
   ```
5. Open the URL shown by Netlify CLI (usually `http://localhost:8888`).

## Required environment variables
Set these in Netlify (Site settings → Environment variables) and locally in `.env` for `npm run dev`.

### Licensing and webhook
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret (`whsec_...`)
- `STRIPE_WEBHOOK_TOLERANCE_SECONDS` - optional webhook timestamp tolerance (defaults to `300`)
- `LICENSE_SIGNING_SSH_PRIVATE_KEY_B64` - Base64-encoded Ed25519 OpenSSH private key for license signing

### Email delivery
- `EMAIL_PROVIDER` - `resend` (default) or `sendgrid`
- `EMAIL_PROVIDER_API_KEY` - provider API key
- `EMAIL_FROM` - optional sender, defaults to `CoolWareX <coolwarex@proton.me>`

### Debug endpoint
- `DEBUG_TOKEN` - required in production for `debug-license-key` endpoint access

### Optional storage scopes
Netlify Blobs site token/config is managed by Netlify runtime. Functions use these stores:
- `licenses`
- `webhook_events`
- `rate_limits`
- `updates`

## License flow (high level)
1. Customer completes Stripe Checkout.
2. Stripe sends `checkout.session.completed` to `/.netlify/functions/stripe-webhook`.
3. Function verifies signature against raw body, enforces idempotency by event ID, generates signed license key, stores fulfillment, and emails the key.
4. Support lookup endpoint (`lookup-license`) accepts email and returns a safe, non-enumerating response message.

## Testing webhook locally
1. Start local site with functions:
   ```powershell
   npm run dev
   ```
2. In another terminal, forward Stripe events to local webhook using Stripe CLI:
   ```powershell
   stripe listen --forward-to localhost:8888/.netlify/functions/stripe-webhook
   ```
3. Copy the shown webhook secret into `STRIPE_WEBHOOK_SECRET`.
4. Trigger a test event:
   ```powershell
   stripe trigger checkout.session.completed
   ```

## CI
GitHub Actions workflow (`.github/workflows/ci.yml`) runs on `windows-latest` with Node 20 and executes:
- `npm ci`
- `node --test`

## Commands
- `npm run dev` - run local Netlify site/functions via local CLI
- `npm test` - run Node.js unit tests
- `npm run lint` - syntax/lint checks for repository JavaScript files
