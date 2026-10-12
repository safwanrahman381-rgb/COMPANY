const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');

try {
  process.loadEnvFile(path.join(__dirname, '.env'));
} catch {
  // No .env file: rely on real environment variables.
}

const db = require('./lib/db');
const { productSvg } = require('./lib/productImage');
const { createStripe, verifyWebhook } = require('./lib/stripe');
const { createRouter, readBody, sendJson, sendFile, staticPath, HttpError } = require('./lib/http');

const PORT = process.env.PORT || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';
const PUBLIC_DIR = path.join(__dirname, 'public');
const PRODUCT_IMAGE_DIR = path.join(PUBLIC_DIR, 'images', 'products');

const stripe = process.env.STRIPE_SECRET_KEY ? createStripe(process.env.STRIPE_SECRET_KEY) : null;
// Without Stripe keys the shop runs in demo mode locally: checkout "succeeds" without taking payment.
// Never allowed in production, so a misconfigured live site can't give stock away.
const DEMO_MODE = !stripe && !IS_PROD;
if (!stripe && IS_PROD) console.warn('STRIPE_SECRET_KEY is not set: checkout is disabled.');

const router = createRouter();

// ---------- helpers ----------

const store = () => db.read('store', {});
const products = () => db.read('products', []);
const categories = () => db.read('categories', []);

function baseUrl(req) {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, '');
  const proto = req.headers['x-forwarded-proto'] || (req.socket.encrypted ? 'https' : 'http');
  return `${proto.split(',')[0]}://${req.headers.host}`;
}

function clientIp(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress;
}

function productImage(slug) {
  for (const ext of ['webp', 'jpg', 'jpeg', 'png']) {
    if (fs.existsSync(path.join(PRODUCT_IMAGE_DIR, `${slug}.${ext}`))) return `/images/products/${slug}.${ext}`;
  }
  return `/images/products/${slug}.svg`;
}

function publicProduct(p) {
  const category = categories().find((c) => c.slug === p.category);
  return {
    slug: p.slug,
    name: p.name,
    category: p.category,
    categoryName: category ? category.name : '',
    price: p.price,
    inStock: p.stock > 0,
    maxQty: Math.max(0, Math.min(p.stock, 10)),
    featured: !!p.featured,
    image: productImage(p.slug),
    description: p.description,
    howToUse: p.howToUse,
    ingredients: p.ingredients,
  };
}

function findDiscount(code) {
  if (!code) return null;
  const key = String(code).trim().toUpperCase();
  const codes = store().discountCodes || {};
  return Object.hasOwn(codes, key) ? { code: key, ...codes[key] } : null;
}

// Prices always come from the server, never from the browser.
function priceCart(items, code) {
  if (!Array.isArray(items) || items.length === 0) throw new HttpError(400, 'Your cart is empty.');
  const all = products();
  const lines = [];
  for (const item of items) {
    const p = all.find((x) => x.slug === (item && item.slug));
    const qty = Number(item && item.qty);
    if (!p) throw new HttpError(400, 'A product in your cart is no longer available.');
    if (!Number.isInteger(qty) || qty < 1 || qty > 99) throw new HttpError(400, 'Invalid quantity.');
    if (lines.some((l) => l.slug === p.slug)) throw new HttpError(400, 'Duplicate product in cart.');
    if (p.stock < qty) {
      throw new HttpError(409, p.stock > 0 ? `Only ${p.stock} of ${p.name} left in stock.` : `${p.name} is sold out.`);
    }
    lines.push({ slug: p.slug, name: p.name, qty, unitPrice: p.price, total: p.price * qty });
  }
  const subtotal = lines.reduce((s, l) => s + l.total, 0);
  const discount = findDiscount(code);
  const discountAmount = discount ? Math.round((subtotal * discount.percentOff) / 100) : 0;
  return { lines, subtotal, discount, discountAmount, afterDiscount: subtotal - discountAmount };
}

function shippingOptions(afterDiscount) {
  const s = store().shipping || {};
  const free = s.freeOver != null && afterDiscount >= s.freeOver;
  return (s.options || []).map((o, i) => ({ ...o, amount: free && i === 0 ? 0 : o.amount, name: free && i === 0 ? `${o.name} (free)` : o.name }));
}

// Marks an order paid and takes the stock. Safe to call more than once per order.
function fulfilOrder(orderId, details = {}) {
  const justPaid = db.update('orders', [], (orders) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order || order.status !== 'pending') return null;
    Object.assign(order, details, { status: 'paid', paidAt: new Date().toISOString() });
    return order;
  });
  if (!justPaid) return;
  db.update('products', [], (all) => {
    for (const line of justPaid.items) {
      const p = all.find((x) => x.slug === line.slug);
      if (p) p.stock = Math.max(0, p.stock - line.qty);
    }
  });
  console.log(`Order ${justPaid.id} paid: ${(justPaid.total / 100).toFixed(2)}`);
}

// ---------- Stripe webhook ----------

router.post('/api/stripe/webhook', async (req, res, { rawBody }) => {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) return sendJson(res, 503, { error: 'Webhook not configured' });
  let event;
  try {
    event = verifyWebhook(rawBody, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return sendJson(res, 400, { error: `Webhook signature error: ${err.message}` });
  }

  const session = event.data.object;
  const orderId = session.metadata && session.metadata.orderId;
  if (orderId) {
    if (
      (event.type === 'checkout.session.completed' && session.payment_status === 'paid') ||
      event.type === 'checkout.session.async_payment_succeeded'
    ) {
      const shipping = (session.collected_information && session.collected_information.shipping_details) || session.shipping_details;
      const cd = session.customer_details || {};
      fulfilOrder(orderId, {
        total: session.amount_total,
        discountAmount: (session.total_details && session.total_details.amount_discount) || 0,
        shippingAmount: (session.shipping_cost && session.shipping_cost.amount_total) || 0,
        customer: {
          name: (shipping && shipping.name) || cd.name || '',
          email: cd.email || '',
          phone: cd.phone || '',
          address: (shipping && shipping.address) || cd.address || null,
        },
        paymentIntent: session.payment_intent,
      });
    } else if (event.type === 'checkout.session.expired' || event.type === 'checkout.session.async_payment_failed') {
      db.update('orders', [], (orders) => {
        const order = orders.find((o) => o.id === orderId);
        if (order && order.status === 'pending') order.status = event.type.endsWith('expired') ? 'expired' : 'failed';
      });
    }
  }
  sendJson(res, 200, { received: true });
});

// ---------- public API ----------

router.get('/api/store', (req, res) => {
  const s = store();
  sendJson(res, 200, {
    name: s.name,
    tagline: s.tagline,
    currency: s.currency,
    currencySymbol: s.currencySymbol,
    contactEmail: s.contactEmail,
    announcement: s.announcement,
    shipping: { freeOver: s.shipping && s.shipping.freeOver, options: (s.shipping && s.shipping.options) || [] },
    categories: categories(),
    featuredLimit: s.featuredLimit || 6,
    demoMode: DEMO_MODE,
  });
});

router.get('/api/products', (req, res, { query }) => {
  let list = products();
  const category = query.get('category');
  const q = query.get('q');
  if (category) list = list.filter((p) => p.category === category);
  if (query.get('featured')) list = list.filter((p) => p.featured);
  if (q) {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    list = list.filter((p) => {
      const hay = `${p.name} ${p.category} ${p.description}`.toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
  }
  sendJson(res, 200, list.map(publicProduct));
});

router.get('/api/products/:slug', (req, res, { params }) => {
  const p = products().find((x) => x.slug === params.slug);
  if (!p) throw new HttpError(404, 'Product not found');
  sendJson(res, 200, publicProduct(p));
});

router.get('/images/products/:slug.svg', (req, res, { params }) => {
  const p = products().find((x) => x.slug === params.slug);
  if (!p) throw new HttpError(404, 'Not found');
  res.writeHead(200, { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=3600' });
  res.end(productSvg(p, store().name));
});

router.post('/api/cart/quote', (req, res, { body }) => {
  const priced = priceCart(body.items, body.code);
  sendJson(res, 200, {
    lines: priced.lines,
    subtotal: priced.subtotal,
    discount: priced.discount ? { code: priced.discount.code, label: priced.discount.label, amount: priced.discountAmount } : null,
    invalidCode: !!body.code && !priced.discount,
    afterDiscount: priced.afterDiscount,
    shippingFrom: Math.min(...shippingOptions(priced.afterDiscount).map((o) => o.amount)),
    freeShippingOver: (store().shipping || {}).freeOver,
  });
});

async function stripeCoupon(discount) {
  const id = `${discount.code}-${discount.percentOff}`.replace(/[^A-Za-z0-9_-]/g, '');
  try {
    return await stripe.coupons.retrieve(id);
  } catch (err) {
    if (err.statusCode !== 404) throw err;
    return stripe.coupons.create({ id, percent_off: discount.percentOff, duration: 'once', name: discount.label || discount.code });
  }
}

router.post('/api/checkout', async (req, res, { body }) => {
  if (!stripe && !DEMO_MODE) throw new HttpError(503, 'Checkout is temporarily unavailable. Please try again later.');
  const s = store();
  const priced = priceCart(body.items, body.code);
  const shipping = shippingOptions(priced.afterDiscount);
  const order = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    status: 'pending',
    items: priced.lines,
    subtotal: priced.subtotal,
    discountCode: priced.discount ? priced.discount.code : null,
    discountAmount: priced.discountAmount,
    shippingAmount: 0,
    total: priced.afterDiscount,
  };

  if (DEMO_MODE) {
    order.demo = true;
    order.shippingAmount = shipping.length ? shipping[0].amount : 0;
    order.total += order.shippingAmount;
    db.update('orders', [], (orders) => { orders.push(order); });
    fulfilOrder(order.id, { customer: { name: 'Demo Customer', email: 'demo@example.com' } });
    return sendJson(res, 200, { url: `/checkout/success?order=${order.id}` });
  }

  const url = baseUrl(req);
  const coupon = priced.discount ? await stripeCoupon(priced.discount) : null;
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: priced.lines.map((l) => {
      const image = productImage(l.slug);
      return {
        quantity: l.qty,
        price_data: {
          currency: s.currency,
          unit_amount: l.unitPrice,
          // Stripe can't show SVGs, so only real photos are passed through.
          product_data: { name: l.name, images: image.endsWith('.svg') ? undefined : [`${url}${image}`] },
        },
      };
    }),
    discounts: coupon ? [{ coupon: coupon.id }] : undefined,
    shipping_address_collection: { allowed_countries: (s.shipping && s.shipping.allowedCountries) || ['GB'] },
    shipping_options: shipping.map((o) => ({
      shipping_rate_data: {
        type: 'fixed_amount',
        display_name: o.name,
        fixed_amount: { amount: o.amount, currency: s.currency },
        delivery_estimate: {
          minimum: { unit: 'business_day', value: o.minDays },
          maximum: { unit: 'business_day', value: o.maxDays },
        },
      },
    })),
    phone_number_collection: { enabled: true },
    metadata: { orderId: order.id },
    payment_intent_data: { metadata: { orderId: order.id } },
    success_url: `${url}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${url}/cart`,
  });

  order.stripeSessionId = session.id;
  db.update('orders', [], (orders) => { orders.push(order); });
  sendJson(res, 200, { url: session.url });
});

// Order lookup for the confirmation page. Order ids and Stripe session ids are unguessable.
router.get('/api/order', (req, res, { query }) => {
  const id = query.get('order');
  const sessionId = query.get('session_id');
  if (!id && !sessionId) throw new HttpError(400, 'Missing order reference');
  const order = db.read('orders', []).find((o) => (id && o.id === id) || (sessionId && o.stripeSessionId === sessionId));
  if (!order) throw new HttpError(404, 'Order not found');
  sendJson(res, 200, {
    reference: order.id.slice(0, 8).toUpperCase(),
    status: order.status,
    items: order.items,
    subtotal: order.subtotal,
    discountAmount: order.discountAmount,
    shippingAmount: order.shippingAmount,
    total: order.total,
    email: order.customer && order.customer.email,
  });
});

const contactHits = new Map();
router.post('/api/contact', (req, res, { body }) => {
  const { name, email, orderNumber, message, website } = body;
  if (website) return sendJson(res, 200, { ok: true }); // honeypot field: bots fill it in, people never see it
  const ip = clientIp(req);
  const now = Date.now();
  const recent = (contactHits.get(ip) || []).filter((t) => now - t < 60 * 60 * 1000);
  if (recent.length >= 5) throw new HttpError(429, 'Too many messages. Please try again later.');
  if (!name || !email || !message || !/^\S+@\S+\.\S+$/.test(email)) {
    throw new HttpError(400, 'Please fill in your name, a valid email and a message.');
  }
  if (contactHits.size > 10000) contactHits.clear();
  contactHits.set(ip, [...recent, now]);
  db.update('messages', [], (messages) => {
    messages.push({
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      name: String(name).slice(0, 200),
      email: String(email).slice(0, 200),
      orderNumber: String(orderNumber || '').slice(0, 50),
      message: String(message).slice(0, 5000),
      read: false,
    });
  });
  sendJson(res, 200, { ok: true });
});

router.get('/api/pages/:slug', (req, res, { params }) => {
  const pages = db.read('pages', {});
  if (!Object.hasOwn(pages, params.slug)) throw new HttpError(404, 'Page not found');
  const s = store();
  const fill = (t) => t.replace(/\{\{storeName\}\}/g, s.name).replace(/\{\{contactEmail\}\}/g, s.contactEmail);
  sendJson(res, 200, { title: pages[params.slug].title, html: fill(pages[params.slug].html) });
});

// ---------- admin API (HTTP Basic auth, password from ADMIN_PASSWORD) ----------

function requireAdmin(req) {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) throw new HttpError(503, 'Admin is disabled. Set ADMIN_PASSWORD to enable it.');
  const [scheme, encoded] = (req.headers.authorization || '').split(' ');
  const given = scheme === 'Basic' && encoded ? Buffer.from(encoded, 'base64').toString().split(':').slice(1).join(':') : '';
  const a = crypto.createHash('sha256').update(given).digest();
  const b = crypto.createHash('sha256').update(password).digest();
  if (!crypto.timingSafeEqual(a, b)) throw new HttpError(401, 'Wrong password');
}

router.get('/api/admin/summary', (req, res) => {
  const orders = db.read('orders', []);
  const paid = orders.filter((o) => o.status === 'paid' || o.status === 'shipped');
  sendJson(res, 200, {
    revenue: paid.reduce((s, o) => s + o.total, 0),
    paidOrders: paid.length,
    toShip: orders.filter((o) => o.status === 'paid').length,
    unreadMessages: db.read('messages', []).filter((m) => !m.read).length,
    lowStock: products().filter((p) => p.stock <= 3).map((p) => ({ slug: p.slug, name: p.name, stock: p.stock })),
    demoMode: DEMO_MODE,
  });
});

router.get('/api/admin/orders', (req, res, { query }) => {
  const orders = db.read('orders', []).filter((o) => query.get('all') || o.status !== 'pending');
  sendJson(res, 200, orders.reverse());
});

router.patch('/api/admin/orders/:id', (req, res, { params, body }) => {
  const { status, trackingNumber } = body;
  if (status && !['paid', 'shipped', 'refunded', 'cancelled'].includes(status)) throw new HttpError(400, 'Invalid status');
  const updated = db.update('orders', [], (orders) => {
    const order = orders.find((o) => o.id === params.id);
    if (!order) return null;
    if (status) order.status = status;
    if (status === 'shipped') order.shippedAt = new Date().toISOString();
    if (trackingNumber != null) order.trackingNumber = String(trackingNumber).slice(0, 100);
    return order;
  });
  if (!updated) throw new HttpError(404, 'Order not found');
  sendJson(res, 200, updated);
});

router.get('/api/admin/products', (req, res) => sendJson(res, 200, products()));

router.patch('/api/admin/products/:slug', (req, res, { params, body }) => {
  const updated = db.update('products', [], (all) => {
    const p = all.find((x) => x.slug === params.slug);
    if (!p) return null;
    for (const key of ['price', 'stock']) {
      if (body[key] != null) {
        const n = Number(body[key]);
        if (!Number.isInteger(n) || n < 0) throw new HttpError(400, `Invalid ${key}`);
        p[key] = n;
      }
    }
    if (body.featured != null) p.featured = !!body.featured;
    return p;
  });
  if (!updated) throw new HttpError(404, 'Product not found');
  sendJson(res, 200, updated);
});

router.get('/api/admin/messages', (req, res) => sendJson(res, 200, db.read('messages', []).slice().reverse()));

router.patch('/api/admin/messages/:id', (req, res, { params, body }) => {
  db.update('messages', [], (messages) => {
    const m = messages.find((x) => x.id === params.id);
    if (m) m.read = !!body.read;
  });
  sendJson(res, 200, { ok: true });
});

// ---------- pages ----------

const PAGES = {
  '/': 'index.html',
  '/products': 'products.html',
  '/products/:slug': 'product.html',
  '/cart': 'cart.html',
  '/contact': 'contact.html',
  '/checkout/success': 'success.html',
  '/policies/:slug': 'policy.html',
  '/admin': 'admin.html',
};
for (const [route, file] of Object.entries(PAGES)) {
  router.get(route, (req, res) => sendFile(res, path.join(PUBLIC_DIR, file)));
}

// ---------- server ----------

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

const server = http.createServer(async (req, res) => {
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v);
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;
  try {
    const route = router.match(req.method, pathname);
    if (!route) {
      if (pathname.startsWith('/api/')) throw new HttpError(404, 'Not found');
      if (req.method === 'GET' || req.method === 'HEAD') {
        const file = staticPath(PUBLIC_DIR, pathname);
        if (file && fs.existsSync(file) && fs.statSync(file).isFile()) return sendFile(res, file, 200, IS_PROD ? 3600 : 0);
      }
      return sendFile(res, path.join(PUBLIC_DIR, '404.html'), 404);
    }

    if (pathname.startsWith('/api/admin/')) requireAdmin(req);

    const ctx = { params: route.params, query: url.searchParams, body: {}, rawBody: null };
    if (req.method === 'POST' || req.method === 'PATCH') {
      ctx.rawBody = await readBody(req);
      if (pathname !== '/api/stripe/webhook' && ctx.rawBody.length) {
        try {
          ctx.body = JSON.parse(ctx.rawBody.toString('utf8'));
        } catch {
          throw new HttpError(400, 'Invalid JSON');
        }
        if (!ctx.body || typeof ctx.body !== 'object') throw new HttpError(400, 'Invalid JSON');
      }
    }
    await route.handler(req, res, ctx);
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error(err);
    if (res.headersSent) return res.end();
    sendJson(res, status, { error: status >= 500 ? 'Something went wrong. Please try again.' : err.message });
  }
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`${store().name} running at http://localhost:${PORT}`);
    if (DEMO_MODE) console.log('Demo mode: no STRIPE_SECRET_KEY set, checkout will not take real payments.');
  });
}

module.exports = server;
