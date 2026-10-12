# Velora Skin — online shop

A complete online shop with a black-and-gold design: home page, shop with filters and
search, product pages with a strength picker, a slide-out bag, card payments through
Stripe Checkout, order confirmation, contact form, policy pages and a password-protected
admin dashboard for orders, stock and messages.

It runs on Node.js 22 or newer. Running it locally needs nothing installed; on Netlify the
only dependency (`@netlify/blobs`, for storage) is installed automatically.

## Run it on your computer

```bash
node server.js
```

Open http://localhost:3000. With no Stripe keys set, the shop runs in **demo mode**:
checkout skips payment so you can try the whole flow. Demo mode is switched off
automatically when `NODE_ENV=production`.

To see the admin dashboard locally:

```bash
ADMIN_PASSWORD=choose-a-password node server.js
```

Then open http://localhost:3000/admin.

Run the tests with `npm test`.

## What's included

| Page | URL |
| --- | --- |
| Home: hero, shop by concern, bestsellers, how it works, FAQ | `/` |
| Shop: treatment filter, in-stock filter, sort, search | `/products`, `/products?category=…`, `/products?q=…` |
| Product page: strength picker, quantity, add to bag, details, related products | `/products/<slug>` |
| Slide-out bag on every page, plus a full bag page | `/cart` |
| About page | `/about` |
| Order confirmation | `/checkout/success` |
| Contact form | `/contact` |
| Shipping, returns, privacy, terms, legal notice | `/policies/<name>` |
| Admin: revenue, orders, mark shipped + tracking, edit prices/stock, messages | `/admin` |

Other details:

- Products that share a `group` (e.g. the three tretinoin strengths) get a strength picker on their product page.
- Discount codes are off. Add one under `discountCodes` in `data/store.json` (e.g. `"WELCOME10": { "percentOff": 10, "label": "10% off" }`) and a code box appears on the bag page.
- Prices, stock and discounts are always checked on the server. Nobody can change a price in their browser.
- Sold-out products show a **Sold out** badge and can't be bought. Stock goes down automatically when an order is paid.
- Stripe Checkout handles cards, Apple Pay and Google Pay, the delivery address, phone number and the email receipt.

## Make it yours

Everything you'll want to change is in `data/`:

| File | What it controls |
| --- | --- |
| `data/store.json` | Shop name, tagline, contact email, the notices in the thin top bar, discount codes, delivery price, free-delivery threshold |
| `data/products.json` | Products: name, price **in pence** (1600 = £16.00), starting stock, category, group, strength, form, size, badge, featured, image, summary, description, how to use, ingredients |
| `data/categories.json` | Treatments: name, the concern they target, and the short blurb shown on the home page |
| `data/pages.json` | Text of the policy pages (`{{storeName}}` and `{{contactEmail}}` are filled in for you) |

Product photos go in `public/images/products/`, named after the product's `slug`
(e.g. `tretinoin-cream-0-1-20g.jpg`), square, at least 700×700.

Changes to these files go live when you push them (Netlify redeploys automatically).
Price, stock and "featured" can also be changed instantly from `/admin`; changes made there
take priority over the file.

## Take real payments (Stripe)

1. Create an account at https://stripe.com and complete the business verification.
2. In **Developers → API keys**, copy the secret key. Use `sk_test_…` while testing and `sk_live_…` when you launch.
3. In **Developers → Webhooks**, add an endpoint:
   - URL: `https://YOUR-DOMAIN/api/stripe/webhook`
   - Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
     `checkout.session.async_payment_failed`, `checkout.session.expired`
   - Copy the **signing secret** (`whsec_…`).
4. Copy `.env.example` to `.env` and fill in `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
   `ADMIN_PASSWORD` and `NODE_ENV=production` (plus `PUBLIC_URL` if you host it somewhere other than Netlify).
5. Make a test purchase with card `4242 4242 4242 4242`, any future date and any CVC.
   The order should appear in `/admin` as **paid**.

Discount codes in `data/store.json` are created as Stripe coupons automatically the first
time they're used. Refunds are made in the Stripe dashboard.

To test webhooks on your own computer, use the Stripe CLI:
`stripe listen --forward-to localhost:3000/api/stripe/webhook`.

## Put it online (Netlify, free)

The site is set up for Netlify: pages are served as files and the shop's API runs as a
Netlify Function. Orders, messages and stock changes are saved in Netlify Blobs, so nothing
is lost between deploys and the site never "sleeps".

1. Sign in at https://app.netlify.com with GitHub → **Add new site → Import an existing project** → pick this repo and branch.
   Netlify reads `netlify.toml`, so leave the build settings as they are.
2. **Site configuration → Environment variables → Add a variable → Import from a .env file**, and paste:
   ```
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   ADMIN_PASSWORD=...
   NODE_ENV=production
   ```
   `PUBLIC_URL` is not needed on Netlify: the site uses whatever address it's visited on.
3. **Deploys → Trigger deploy**.
4. In Stripe → Webhooks → your destination → **Edit destination**, set the URL to
   `https://YOUR-SITE.netlify.app/api/stripe/webhook`. The signing secret stays the same.
5. **Site configuration → Change site name** to choose the `.netlify.app` address, or add your own
   domain under **Domain management**. (After changing the address, update the webhook URL again.)

### Other hosts

`node server.js` runs the same shop on any Node host (Render, a VPS, your computer). It saves
data as JSON files in `.data/`, or in `DATA_DIR` if set, so use a persistent disk there.

## Before you launch: legal checklist

This is not legal advice, but please don't skip it:

- **Medicines regulation.** In the UK, tretinoin, tazarotene, hydroquinone, estriol and
  higher-strength azelaic acid are **prescription-only medicines**. Selling them online
  without a prescription is a criminal offence under the Human Medicines Regulations 2012.
  Selling them legally means working through a GPhC-registered pharmacy with a prescriber,
  an online consultation for each customer, and the MHRA distance-selling logo.
  Talk to the MHRA and GPhC, or a regulatory adviser, before you take orders.
- **Payment provider.** Stripe restricts pharmacies and prescription medicines. Check that
  your business is allowed under Stripe's terms before going live, or the account can be
  frozen with the money held.
- **Policies.** The policy pages are templates. Fill in the [bracketed] details and have them checked.
- Register with the ICO (data protection fee), and with HMRC/Companies House as needed.
