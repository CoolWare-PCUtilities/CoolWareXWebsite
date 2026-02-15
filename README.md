# CoolWareX Website

Static-first Netlify site for CoolWareX with optional Netlify Functions for Stripe fulfillment, license resend, and update subscriptions.

## Stack
- Static HTML/CSS/JS frontend (no build required)
- Netlify Functions (Node.js 20)
- Netlify Blobs stores for licenses, idempotency, and rate limits

## Local development (Windows/GitHub Actions friendly)
1. Install **Node.js 20.x** (or use `.nvmrc`).
2. Install dependencies:
   ```powershell
   npm ci
   ```
3. Copy `.env.example` to `.env` and fill values as needed.
4. Start Netlify local development:
   ```powershell
   npm run dev
   ```

`netlify dev` can pull environment variables from your Netlify site and also reads local `.env` values.

## Functions (optional)
- `/.netlify/functions/stripe-webhook`: verifies Stripe webhook signatures, enforces idempotency, issues a CoolAutoSorter lifetime key, and emails it.
- `/.netlify/functions/lookup-license`: accepts an email and sends the most recent matching license key by email using a generic non-enumerating response.
- `/.netlify/functions/subscribe-updates`: stores update subscription requests by product/email hash.

### Required environment variables
- `STRIPE_WEBHOOK_SECRET`
- `LICENSE_SIGNING_SSH_PRIVATE_KEY_B64`
- `EMAIL_PROVIDER`
- `EMAIL_PROVIDER_API_KEY`
- `EMAIL_FROM`
- `DEBUG_TOKEN`
- `NODE_ENV`

Optional:
- `STRIPE_WEBHOOK_TOLERANCE_SECONDS` (defaults to `300`)

## Commands
- `npm run dev` - run local Netlify site/functions
- `npm run lint` - ESLint checks for site script, functions, and tests
- `npm test` - Node built-in test runner
- `npm run format` - Prettier write
- `npm run format:check` - Prettier check


## Troubleshooting Deploy Preview "Not Found"
If a Netlify Deploy Preview shows a default "Not Found" page, check:
- The Deploy Preview build log and confirm **Publishing directory** points to a folder containing `index.html`.
- Deploy Previews are enabled in Netlify site settings.

Local checks:
```powershell
npm ci
npm test
node scripts/verify-publish.mjs
npx netlify dev
```
`npx netlify dev` is optional, but helpful to validate local static routing and functions behavior.


## Manual Deploy Preview (No GitHub Actions)
Use this flow when Actions minutes are unavailable and you want a preview deploy directly from your local machine (Windows-friendly).

1. Install dependencies:
   ```powershell
   npm ci
   ```
2. Run tests:
   ```powershell
   npm test
   ```
3. Run repository checks:
   ```powershell
   npm run doctor
   ```
4. Set required Netlify environment variables in your shell:
   ```powershell
   $env:NETLIFY_AUTH_TOKEN = "<your-token>"
   $env:NETLIFY_SITE_ID = "<your-site-id>"
   ```
5. Deploy preview:
   ```powershell
   npm run deploy:preview
   ```

The deploy script validates publish output first and prints the final preview URL when deployment succeeds.

### Troubleshooting
- If preview shows **Not Found**, check Netlify deploy/build logs and confirm **Publishing directory** points to the folder containing `index.html`.
- If preview is missing entirely, confirm Deploy Previews are enabled in Netlify and the repository is connected to the correct Netlify site.
