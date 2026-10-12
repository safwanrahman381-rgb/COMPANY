// The shop's API (/api/*) and generated product images, independent of where it runs.
// server.js (Node, Render, your computer) and netlify/functions/api.mjs (Netlify) both call handle().
const crypto = require('crypto');
const { productSvg } = require('./productImage');
const { createStripe, verifyWebhook } = require('./stripe');
const { createRouter, HttpError } = require('./http');

// Catalogue and settings ship with the code. Price, stock and "featured" changes made in the
// admin are saved in storage under "inventory" and layered on top.
const SEED = {
  store: require('../data/store.json'),
  products: require('../data/products.json'),
  categories: require('../data/categories.json'),
  pages: require('../data/pages.json'),
};

const ORDER_STATUSES = ['paid', 'shipped', 'refunded', 'cancelled'];

function json(status, data) {
  return {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    body: JSON.stringify(data),
  };
}

function createShop({ storage, env = process.env, seed = SEED } = {}) {
  const stripe = env.STRIPE_SECRET_KEY ? createStripe(env.STRIPE_SECRET_KEY) : null;
  const isProd = env.NODE_ENV === 'production';
  // Without Stripe keys the shop runs in demo mode locally: checkout "succeeds" without taking payment.
  // Never allowed in production, so a misconfigured live site can't give stock away.
  const demoMode = !stripe && !isProd;
  if (!stripe && isProd) console.warn('STRIPE_SECRET_KEY is not set: checkout is disabled.');

  const store = seed.store;
  const categories = seed.categories;
  const router = createRouter();

  // Storage writes that read-modify-write (stock, order status) run one at a time per process.
  let queue = Promise.resolve();
  const serial = (fn) => {
    const run = queue.then(fn, fn);
    queue = run.catch(() => {});
    return run;
  };

  // ---------- helpers ----------

  async function products() {
    const inventory = await storage.get('inventory', {});
    return seed.products.map((p) => ({ ...p, ...(inventory[p.slug] || {}) }));
  }

  const productImage = (p) => p.image || `/images/products/${p.slug}.svg`;

  function publicProduct(p) {
    const category = categories.find((c) => c.slug === p.category);
    return {
      slug: p.slug,
      name: p.name,
      category: p.category,
      categoryName: category ? category.name : '',
      concern: category ? category.concern : '',
      group: p.group || p.slug,
      strength: p.strength || '',
      form: p.form || '',
      size: p.size || '',
      badge: p.badge || '',
      summary: p.summary || '',
      price: p.price,
      inStock: p.stock > 0,
      maxQty: Math.max(0, Math.min(p.stock, 10)),
      featured: !!p.featured,
      image: productImage(p),
      description: p.description,
      howToUse: p.howToUse,
      ingredients: p.ingredients,
    };
  }

  function findDiscount(code) {
    if (!code) return null;
    const key = String(code).trim().toUpperCase();
    const codes = store.discountCodes || {};
    return Object.hasOwn(codes, key) ? { code: key, ...codes[key] } : null;
  }

  // Prices always come from the server, never from the browser.
  async function priceCart(items, code) {
    if (!Array.isArray(items) || items.length === 0) throw new HttpError(400, 'Your cart is empty.');
    const all = await products();
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
      lines.push({ slug: p.slug, name: p.name, qty, unitPrice: p.price, total: p.price * qty, image: productImage(p) });
    }
    const subtotal = lines.reduce((s, l) => s + l.total, 0);
    const discount = findDiscount(code);
    const discountAmount = discount ? Math.round((subtotal * discount.percentOff) / 100) : 0;
    return { lines, subtotal, discount, discountAmount, afterDiscount: subtotal - discountAmount };
  }

  function shippingOptions(afterDiscount) {
    const s = store.shipping || {};
    const free = s.freeOver != null && afterDiscount >= s.freeOver;
    return (s.options || []).map((o, i) => ({ ...o, amount: free && i === 0 ? 0 : o.amount, name: free && i === 0 ? `${o.name} (free)` : o.name }));
  }

  const getOrder = (id) => storage.get(`orders/${id}`, null);
  const saveOrder = (order) => storage.set(`orders/${order.id}`, order);

  async function allRecords(prefix) {
    const keys = await storage.list(prefix);
    const records = await Promise.all(keys.map((k) => storage.get(k, null)));
    return records.filter(Boolean).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }

  // Marks an order paid and takes the stock. Safe to call more than once per order.
  function fulfilOrder(orderId, details = {}) {
    return serial(async () => {
      const order = await getOrder(orderId);
      if (!order || order.status !== 'pending') return;
      Object.assign(order, details, { status: 'paid', paidAt: new Date().toISOString() });
      await saveOrder(order);
      const inventory = await storage.get('inventory', {});
      for (const line of order.items) {
        const p = seed.products.find((x) => x.slug === line.slug);
        if (!p) continue;
        const current = inventory[p.slug] && inventory[p.slug].stock != null ? inventory[p.slug].stock : p.stock;
        inventory[p.slug] = { ...(inventory[p.slug] || {}), stock: Math.max(0, current - line.qty) };
      }
      await storage.set('inventory', inventory);
      console.log(`Order ${order.id} paid: ${(order.total / 100).toFixed(2)}`);
    });
  }

  // ---------- Stripe webhook ----------

  router.post('/api/stripe/webhook', async ({ rawBody, headers }) => {
    if (!stripe || !env.STRIPE_WEBHOOK_SECRET) return json(503, { error: 'Webhook not configured' });
    let event;
    try {
      event = verifyWebhook(rawBody, headers['stripe-signature'], env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      return json(400, { error: `Webhook signature error: ${err.message}` });
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
        await fulfilOrder(orderId, {
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
        await serial(async () => {
          const order = await getOrder(orderId);
          if (order && order.status === 'pending') {
            order.status = event.type.endsWith('expired') ? 'expired' : 'failed';
            await saveOrder(order);
          }
        });
      }
    }
    return json(200, { received: true });
  });

  // ---------- public API ----------

  router.get('/api/store', () =>
    json(200, {
      name: store.name,
      tagline: store.tagline,
      currency: store.currency,
      currencySymbol: store.currencySymbol,
      contactEmail: store.contactEmail,
      notices: store.notices || [],
      hasDiscounts: Object.keys(store.discountCodes || {}).length > 0,
      shipping: { freeOver: store.shipping && store.shipping.freeOver, options: (store.shipping && store.shipping.options) || [] },
      categories,
      featuredLimit: store.featuredLimit || 6,
      demoMode,
    })
  );

  router.get('/api/products', async ({ query }) => {
    let list = await products();
    const category = query.get('category');
    const q = query.get('q');
    if (category) list = list.filter((p) => p.category === category);
    if (query.get('featured')) list = list.filter((p) => p.featured);
    if (q) {
      const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
      list = list.filter((p) => {
        const hay = `${p.name} ${p.category} ${p.form || ''} ${p.summary || ''} ${p.description}`.toLowerCase();
        return terms.every((t) => hay.includes(t));
      });
    }
    return json(200, list.map(publicProduct));
  });

  router.get('/api/products/:slug', async ({ params }) => {
    const p = (await products()).find((x) => x.slug === params.slug);
    if (!p) throw new HttpError(404, 'Product not found');
    return json(200, publicProduct(p));
  });

  router.get('/images/products/:slug.svg', ({ params }) => {
    const p = seed.products.find((x) => x.slug === params.slug);
    if (!p) throw new HttpError(404, 'Not found');
    return { status: 200, headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=3600' }, body: productSvg(p, store.name) };
  });

  router.post('/api/cart/quote', async ({ body }) => {
    const priced = await priceCart(body.items, body.code);
    return json(200, {
      lines: priced.lines,
      subtotal: priced.subtotal,
      discount: priced.discount ? { code: priced.discount.code, label: priced.discount.label, amount: priced.discountAmount } : null,
      invalidCode: !!body.code && !priced.discount,
      afterDiscount: priced.afterDiscount,
      shippingFrom: Math.min(...shippingOptions(priced.afterDiscount).map((o) => o.amount)),
      freeShippingOver: (store.shipping || {}).freeOver,
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

  router.post('/api/checkout', async ({ body, baseUrl }) => {
    if (!stripe && !demoMode) throw new HttpError(503, 'Checkout is temporarily unavailable. Please try again later.');
    const priced = await priceCart(body.items, body.code);
    const shipping = shippingOptions(priced.afterDiscount);
    const order = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      status: 'pending',
      items: priced.lines.map(({ image, ...line }) => line),
      subtotal: priced.subtotal,
      discountCode: priced.discount ? priced.discount.code : null,
      discountAmount: priced.discountAmount,
      shippingAmount: 0,
      total: priced.afterDiscount,
    };

    if (demoMode) {
      order.demo = true;
      order.shippingAmount = shipping.length ? shipping[0].amount : 0;
      order.total += order.shippingAmount;
      await saveOrder(order);
      await fulfilOrder(order.id, { customer: { name: 'Demo Customer', email: 'demo@example.com' } });
      return json(200, { url: `/checkout/success?order=${order.id}` });
    }

    const coupon = priced.discount ? await stripeCoupon(priced.discount) : null;
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: priced.lines.map((l) => ({
        quantity: l.qty,
        price_data: {
          currency: store.currency,
          unit_amount: l.unitPrice,
          // Stripe can't show SVGs, so only real photos are passed through.
          product_data: { name: l.name, images: l.image.endsWith('.svg') ? undefined : [`${baseUrl}${l.image}`] },
        },
      })),
      discounts: coupon ? [{ coupon: coupon.id }] : undefined,
      shipping_address_collection: { allowed_countries: (store.shipping && store.shipping.allowedCountries) || ['GB'] },
      shipping_options: shipping.map((o) => ({
        shipping_rate_data: {
          type: 'fixed_amount',
          display_name: o.name,
          fixed_amount: { amount: o.amount, currency: store.currency },
          delivery_estimate: {
            minimum: { unit: 'business_day', value: o.minDays },
            maximum: { unit: 'business_day', value: o.maxDays },
          },
        },
      })),
      phone_number_collection: { enabled: true },
      metadata: { orderId: order.id },
      payment_intent_data: { metadata: { orderId: order.id } },
      success_url: `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/cart`,
    });

    order.stripeSessionId = session.id;
    await saveOrder(order);
    await storage.set(`sessions/${session.id}`, { orderId: order.id });
    return json(200, { url: session.url });
  });

  // Order lookup for the confirmation page. Order ids and Stripe session ids are unguessable.
  // Deliberately leaves out the customer's name, email and address: the page URL can be shared.
  router.get('/api/order', async ({ query }) => {
    const id = query.get('order');
    const sessionId = query.get('session_id');
    if (!id && !sessionId) throw new HttpError(400, 'Missing order reference');
    let order = null;
    if (id && /^[0-9a-f-]{36}$/.test(id)) order = await getOrder(id);
    if (!order && sessionId && /^cs_[A-Za-z0-9_]+$/.test(sessionId)) {
      const link = await storage.get(`sessions/${sessionId}`, null);
      if (link) order = await getOrder(link.orderId);
    }
    if (!order) throw new HttpError(404, 'Order not found');
    return json(200, {
      reference: order.id.slice(0, 8).toUpperCase(),
      status: order.status,
      items: order.items,
      subtotal: order.subtotal,
      discountAmount: order.discountAmount,
      shippingAmount: order.shippingAmount,
      total: order.total,
    });
  });

  // Best effort only: on Netlify each function instance keeps its own counts.
  const contactHits = new Map();
  router.post('/api/contact', async ({ body, ip }) => {
    const { name, email, orderNumber, message, website } = body;
    if (website) return json(200, { ok: true }); // honeypot field: bots fill it in, people never see it
    const now = Date.now();
    const recent = (contactHits.get(ip) || []).filter((t) => now - t < 60 * 60 * 1000);
    if (recent.length >= 5) throw new HttpError(429, 'Too many messages. Please try again later.');
    if (!name || !email || !message || !/^\S+@\S+\.\S+$/.test(email)) {
      throw new HttpError(400, 'Please fill in your name, a valid email and a message.');
    }
    if (contactHits.size > 10000) contactHits.clear();
    contactHits.set(ip, [...recent, now]);
    const id = crypto.randomUUID();
    await storage.set(`messages/${id}`, {
      id,
      createdAt: new Date().toISOString(),
      name: String(name).slice(0, 200),
      email: String(email).slice(0, 200),
      orderNumber: String(orderNumber || '').slice(0, 50),
      message: String(message).slice(0, 5000),
      read: false,
    });
    return json(200, { ok: true });
  });

  router.get('/api/pages/:slug', ({ params }) => {
    if (!Object.hasOwn(seed.pages, params.slug)) throw new HttpError(404, 'Page not found');
    const fill = (t) => t.replace(/\{\{storeName\}\}/g, store.name).replace(/\{\{contactEmail\}\}/g, store.contactEmail);
    return json(200, { title: seed.pages[params.slug].title, html: fill(seed.pages[params.slug].html) });
  });

  // ---------- admin API (HTTP Basic auth, password from ADMIN_PASSWORD) ----------

  function requireAdmin(headers) {
    const password = env.ADMIN_PASSWORD;
    if (!password) throw new HttpError(503, 'Admin is disabled. Set ADMIN_PASSWORD to enable it.');
    const [scheme, encoded] = (headers.authorization || '').split(' ');
    const given = scheme === 'Basic' && encoded ? Buffer.from(encoded, 'base64').toString().split(':').slice(1).join(':') : '';
    const a = crypto.createHash('sha256').update(given).digest();
    const b = crypto.createHash('sha256').update(password).digest();
    if (!crypto.timingSafeEqual(a, b)) throw new HttpError(401, 'Wrong password');
  }

  router.get('/api/admin/summary', async () => {
    const [orders, messages, all] = await Promise.all([allRecords('orders/'), allRecords('messages/'), products()]);
    const paid = orders.filter((o) => o.status === 'paid' || o.status === 'shipped');
    return json(200, {
      revenue: paid.reduce((s, o) => s + o.total, 0),
      paidOrders: paid.length,
      toShip: orders.filter((o) => o.status === 'paid').length,
      unreadMessages: messages.filter((m) => !m.read).length,
      lowStock: all.filter((p) => p.stock <= 3).map((p) => ({ slug: p.slug, name: p.name, stock: p.stock })),
      demoMode,
    });
  });

  router.get('/api/admin/orders', async ({ query }) => {
    const orders = await allRecords('orders/');
    return json(200, orders.filter((o) => query.get('all') || o.status !== 'pending'));
  });

  router.patch('/api/admin/orders/:id', async ({ params, body }) => {
    const { status, trackingNumber } = body;
    if (status && !ORDER_STATUSES.includes(status)) throw new HttpError(400, 'Invalid status');
    if (!/^[0-9a-f-]{36}$/.test(params.id)) throw new HttpError(404, 'Order not found');
    const updated = await serial(async () => {
      const order = await getOrder(params.id);
      if (!order) return null;
      if (status) order.status = status;
      if (status === 'shipped') order.shippedAt = new Date().toISOString();
      if (trackingNumber != null) order.trackingNumber = String(trackingNumber).slice(0, 100);
      await saveOrder(order);
      return order;
    });
    if (!updated) throw new HttpError(404, 'Order not found');
    return json(200, updated);
  });

  router.get('/api/admin/products', async () => json(200, await products()));

  router.patch('/api/admin/products/:slug', async ({ params, body }) => {
    const base = seed.products.find((x) => x.slug === params.slug);
    if (!base) throw new HttpError(404, 'Product not found');
    const changes = {};
    for (const key of ['price', 'stock']) {
      if (body[key] != null) {
        const n = Number(body[key]);
        if (!Number.isInteger(n) || n < 0) throw new HttpError(400, `Invalid ${key}`);
        changes[key] = n;
      }
    }
    if (body.featured != null) changes.featured = !!body.featured;
    await serial(async () => {
      const inventory = await storage.get('inventory', {});
      inventory[base.slug] = { ...(inventory[base.slug] || {}), ...changes };
      await storage.set('inventory', inventory);
    });
    return json(200, (await products()).find((x) => x.slug === base.slug));
  });

  router.get('/api/admin/messages', async () => json(200, await allRecords('messages/')));

  router.patch('/api/admin/messages/:id', async ({ params, body }) => {
    if (!/^[0-9a-f-]{36}$/.test(params.id)) throw new HttpError(404, 'Message not found');
    await serial(async () => {
      const m = await storage.get(`messages/${params.id}`, null);
      if (m) {
        m.read = !!body.read;
        await storage.set(`messages/${params.id}`, m);
      }
    });
    return json(200, { ok: true });
  });

  // ---------- entry point ----------

  // request: { method, path, query (URLSearchParams), headers (lower-case keys), rawBody (Buffer|null), ip, baseUrl }
  // Returns { status, headers, body }, or null when the path isn't one of ours.
  async function handle(request) {
    const route = router.match(request.method, request.path);
    if (!route) return request.path.startsWith('/api/') ? json(404, { error: 'Not found' }) : null;
    try {
      if (request.path.startsWith('/api/admin/')) requireAdmin(request.headers);
      let body = {};
      const raw = request.rawBody;
      if (raw && raw.length && request.path !== '/api/stripe/webhook') {
        try {
          body = JSON.parse(raw.toString('utf8'));
        } catch {
          throw new HttpError(400, 'Invalid JSON');
        }
        if (!body || typeof body !== 'object') throw new HttpError(400, 'Invalid JSON');
      }
      return await route.handler({ ...request, params: route.params, body });
    } catch (err) {
      const status = err.status || 500;
      if (status >= 500) console.error(err);
      return json(status, { error: status >= 500 ? 'Something went wrong. Please try again.' : err.message });
    }
  }

  return { handle, demoMode };
}

module.exports = { createShop, SEED };
