# CoolWareX Website

Production-ready static marketing + sales site for **CoolWareX**.

## Deployment (Netlify)
- **Build command:** none (leave empty)
- **Publish directory:** `.`
- **Functions directory:** `netlify/functions` (optional only; static site works without functions)
- No secrets are required for a standard static deploy.

## Netlify domain + HTTPS behavior
Configured in `netlify.toml`:
- Canonical domain: `https://coolwarex.com`
- Redirect `www` → apex
- Redirect `http` → `https`
- Security headers enabled (HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, CSP upgrade)

## Local preview
```bash
python3 -m http.server 8080
```
Then open `localhost:8080`.

## Product and CTA configuration
Single source of truth is in `config.js`:
- `BUY_URL`: Stripe payment link for all **Buy CoolAutoSorter** buttons
- `TRIAL_DOWNLOAD_URL`: GitHub Releases URL for all **Download Trial** buttons

Current values:
- Buy link: `https://buy.stripe.com/bJe14g1fqdesbrIc7w7N600`
- Trial link: `https://github.com/CoolWare-PCUtilities/CoolAutoSorter/releases`
- Product: `CoolAutoSorter`
- Price: `$14.99 lifetime`
- Support email: `coolwarex@proton.me`

## Content map
- Home: `index.html`
- Products: `products/index.html`
- Trial: `downloads/index.html`
- Support + FAQ: `support/index.html`
- Legal hub: `legal/index.html`
