# Velora Skin — online shop

A complete online shop: product catalogue, categories, search, product pages, cart,
discount codes, card payments through Stripe Checkout, order confirmation, contact form,
policy pages and a password-protected admin dashboard for orders, stock and messages.

It has **no dependencies**. It runs on Node.js 22 or newer with nothing to install.

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
| Home with featured products | `/` |
| All products, category filter, sort, search | `/products`, `/products?category=…`, `/products?q=…` |
| Product page (quantity, add to cart, buy now, details, related products) | `/products/<slug>` |
| Cart (quantities, discount code, free-shipping progress, checkout) | `/cart` |
| Order confirmation | `/checkout/success` |
| Contact form | `/contact` |
| Shipping, returns, privacy, terms, legal notice | `/policies/<name>` |
| Admin: revenue, orders, mark shipped + tracking, edit prices/stock, messages | `/admin` |

Other details:

- The announcement bar's **Copy code** button copies the code and applies it to the cart.
- Prices, stock and discounts are always checked on the server. Nobody can change a price in their browser.
- Sold-out products show a **Sold out** badge and can't be bought. Stock goes down automatically when an order is paid.
- Stripe Checkout handles cards, Apple Pay and Google Pay, the delivery address, phone number and the email receipt.

## Make it yours

Everything you'll want to change is in `data/`:

| File | What it controls |
| --- | --- |
| `data/store.json` | Shop name, tagline, contact email, announcement bar, discount codes, delivery prices, free-shipping threshold |
| `data/products.json` | Products: name, price **in pence** (1600 = £16.00), stock, category, featured, description, how to use, ingredients |
| `data/categories.json` | Categories, and which ones appear in the footer |
| `data/pages.json` | Text of the policy pages (`{{storeName}}` and `{{contactEmail}}` are filled in for you) |

Product photos go in `public/images/products/`, named after the product's `slug`
(e.g. `tretinoin-cream-0-1-20g.jpg`). The images there now are placeholders.

Restart the server after editing these files. Price, stock and "featured" can also be
changed live from `/admin`.

## Take real payments (Stripe)

1. Create an account at https://stripe.com and complete the business verification.
2. In **Developers → API keys**, copy the secret key. Use `sk_test_…` while testing and `sk_live_…` when you launch.
3. In **Developers → Webhooks**, add an endpoint:
   - URL: `https://YOUR-DOMAIN/api/stripe/webhook`
   - Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
     `checkout.session.async_payment_failed`, `checkout.session.expired`
   - Copy the **signing secret** (`whsec_…`).
4. Copy `.env.example` to `.env` and fill in `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
   `ADMIN_PASSWORD`, `PUBLIC_URL` and `NODE_ENV=production`.
5. Make a test purchase with card `4242 4242 4242 4242`, any future date and any CVC.
   The order should appear in `/admin` as **paid**.

Discount codes in `data/store.json` are created as Stripe coupons automatically the first
time they're used. Refunds are made in the Stripe dashboard.

To test webhooks on your own computer, use the Stripe CLI:
`stripe listen --forward-to localhost:3000/api/stripe/webhook`.

## Put it online

Any host that runs Node.js works: Render, Railway, Fly.io, a VPS, and so on.

- Start command: `node server.js`
- Set the environment variables from `.env.example` in the host's dashboard.
- **Attach a persistent disk** and set `DATA_DIR` to its path (e.g. `/var/data`).
  Orders, messages and stock levels are saved there. Without a persistent disk, many
  hosts wipe them on every deploy. Files missing from `DATA_DIR` are read from `./data`,
  so the shop works on first boot.
- Point your domain at it. HTTPS is required for payments, and these hosts provide it for free.

Orders are stored as JSON files, which is fine for a small shop. If you grow to many
orders a day, move them to a database.

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
