# CoolWareX Website

Production-ready static marketing + sales site for **CoolWareX**.

## Deployment (Netlify)
- **Build command:** none (leave empty)
- **Publish directory:** `.`
- **Functions directory:** `netlify/functions` (optional for advanced workflows)
- This site works as a plain static deployment and does not require paid Netlify add-ons or secret keys to build.

## Local preview
```bash
python3 -m http.server 8080
```
Then open `http://localhost:8080`.

## Product and sales configuration
Update these values in HTML files when pricing or links change:

- **Buy link** (all Buy buttons should use the same URL):
  - `https://buy.stripe.com/bJe14g1fqdesbrIc7w7N600`
- **Current product name:** `CoolAutoSorter`
- **Price text:** `$14.99 lifetime`
- **Support email:** `coolwarex@proton.me`

Primary files to edit:
- `index.html`
- `products/index.html`
- `downloads/index.html`
- `support/index.html`

## Trial downloads
- Trial page is located at `downloads/index.html`.
- Placeholder file path: `downloads/CoolAutoSorter-trial-placeholder.txt`.
- Replace placeholder with real binaries or a GitHub Releases link when available.

## Domain and HTTPS
- Canonical domain: `https://coolwarex.com`
- `netlify.toml` includes redirects for `www` and `http` traffic to the secure apex domain.
