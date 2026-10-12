const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shop-test-'));
process.env.DATA_DIR = dataDir;
process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
process.env.ADMIN_PASSWORD = 'admin-pass';
process.env.PUBLIC_URL = 'https://shop.example';

// Fixtures: a discount code and one sold-out product, layered over the shop's real data.
const seed = (name) => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', `${name}.json`), 'utf8'));
fs.writeFileSync(path.join(dataDir, 'store.json'), JSON.stringify({ ...seed('store'), discountCodes: { MAX: { percentOff: 10, label: '10% off' } } }));
fs.writeFileSync(
  path.join(dataDir, 'products.json'),
  JSON.stringify(seed('products').map((p) => (p.slug === 'tretinoin-cream-0-05-20g' ? { ...p, stock: 0 } : p)))
);

// Stand-in for Stripe's API: records requests and answers like Stripe would.
const realFetch = globalThis.fetch;
const stripeCalls = [];
globalThis.fetch = async (url, options = {}) => {
  if (!String(url).startsWith('https://api.stripe.com')) return realFetch(url, options);
  const body = new URLSearchParams(options.body || '');
  stripeCalls.push({ url: String(url), method: options.method, body });
  const json = (status, data) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
  if (url.includes('/coupons/') && options.method === 'GET') return json(404, { error: { message: 'No such coupon' } });
  if (url.endsWith('/coupons')) return json(200, { id: body.get('id') });
  if (url.endsWith('/checkout/sessions')) return json(200, { id: `cs_test_${stripeCalls.length}`, url: 'https://checkout.stripe.com/pay/test' });
  return json(404, { error: { message: 'unexpected' } });
};

const server = require('../server');
let base;

before(async () => {
  await new Promise((resolve) => server.listen(0, resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

const post = (p, body, headers = {}) =>
  realFetch(base + p, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });
const readData = (name) => JSON.parse(fs.readFileSync(path.join(dataDir, `${name}.json`), 'utf8'));
const stockOf = async (slug) => {
  const all = await realFetch(`${base}/api/admin/products`, { headers: { Authorization: `Basic ${Buffer.from('a:admin-pass').toString('base64')}` } }).then((r) => r.json());
  return all.find((p) => p.slug === slug).stock;
};

function signed(event) {
  const payload = JSON.stringify(event);
  const t = Math.floor(Date.now() / 1000);
  const sig = crypto.createHmac('sha256', 'whsec_test').update(`${t}.${payload}`).digest('hex');
  return { payload, header: `t=${t},v1=${sig}` };
}

test('quote prices from the server and applies discount codes case-insensitively', async () => {
  const res = await post('/api/cart/quote', { items: [{ slug: 'tretinoin-cream-0-1-20g', qty: 2, price: 1 }], code: 'max' });
  const q = await res.json();
  assert.equal(res.status, 200);
  assert.equal(q.subtotal, 3200);
  assert.equal(q.discount.amount, 320);
  assert.equal(q.afterDiscount, 2880);
});

test('unknown codes and prototype keys are not discounts', async () => {
  for (const code of ['NOPE', '__proto__', 'constructor']) {
    const q = await (await post('/api/cart/quote', { items: [{ slug: 'tretinoin-cream-0-1-20g', qty: 1 }], code })).json();
    assert.equal(q.discount, null, code);
    assert.equal(q.invalidCode, true, code);
  }
});

test('sold-out products and bad quantities are rejected', async () => {
  assert.equal((await post('/api/cart/quote', { items: [{ slug: 'tretinoin-cream-0-05-20g', qty: 1 }] })).status, 409);
  assert.equal((await post('/api/cart/quote', { items: [{ slug: 'tretinoin-cream-0-1-20g', qty: 0 }] })).status, 400);
  assert.equal((await post('/api/cart/quote', { items: [{ slug: 'tretinoin-cream-0-1-20g', qty: 1.5 }] })).status, 400);
  assert.equal((await post('/api/cart/quote', { items: [] })).status, 400);
  assert.equal((await post('/api/cart/quote', '{bad json')).status, 400);
});

let orderId;
let sessionId;

test('orders under £30 pay £3.49 standard shipping', async () => {
  stripeCalls.length = 0;
  assert.equal((await post('/api/checkout', { items: [{ slug: 'tretinoin-cream-0-1-20g', qty: 1 }] })).status, 200);
  const b = stripeCalls.find((c) => c.url.endsWith('/checkout/sessions')).body;
  assert.equal(b.get('shipping_options[0][shipping_rate_data][display_name]'), 'Standard');
  assert.equal(b.get('shipping_options[0][shipping_rate_data][fixed_amount][amount]'), '349');
  assert.equal(b.get('shipping_options[0][shipping_rate_data][delivery_estimate][minimum][value]'), '3');
  assert.equal(b.get('shipping_options[0][shipping_rate_data][delivery_estimate][maximum][value]'), '5');
});

test('checkout creates a Stripe session with server prices, coupon and free shipping', async () => {
  stripeCalls.length = 0;
  const res = await post('/api/checkout', { items: [{ slug: 'azelaic-acid-cream-20-20g', qty: 2 }], code: 'MAX' });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).url, 'https://checkout.stripe.com/pay/test');

  const session = stripeCalls.find((c) => c.url.endsWith('/checkout/sessions'));
  assert.ok(session, 'session created');
  const b = session.body;
  assert.equal(b.get('line_items[0][price_data][unit_amount]'), '1800');
  assert.equal(b.get('line_items[0][quantity]'), '2');
  assert.equal(b.get('line_items[0][price_data][currency]'), 'gbp');
  assert.equal(b.get('discounts[0][coupon]'), 'MAX-10');
  // 3600 - 10% = 3240, over the £30 threshold, so standard shipping is free.
  assert.equal(b.get('shipping_options[0][shipping_rate_data][fixed_amount][amount]'), '0');
  assert.equal(b.get('shipping_options[1][shipping_rate_data][fixed_amount][amount]'), null);
  assert.equal(b.get('success_url'), 'https://shop.example/checkout/success?session_id={CHECKOUT_SESSION_ID}');

  orderId = b.get('metadata[orderId]');
  const order = readData('orders').find((o) => o.id === orderId);
  assert.equal(order.status, 'pending');
  sessionId = order.stripeSessionId;
});

test('webhooks with a bad signature are rejected', async () => {
  const { payload } = signed({ type: 'checkout.session.completed', data: { object: {} } });
  const res = await post('/api/stripe/webhook', payload, { 'Stripe-Signature': `t=${Math.floor(Date.now() / 1000)},v1=deadbeef` });
  assert.equal(res.status, 400);
});

test('a paid webhook marks the order paid and takes stock exactly once', async () => {
  const before = await stockOf('azelaic-acid-cream-20-20g');
  const event = {
    type: 'checkout.session.completed',
    data: {
      object: {
        id: sessionId,
        payment_status: 'paid',
        amount_total: 3240,
        metadata: { orderId },
        total_details: { amount_discount: 360 },
        shipping_cost: { amount_total: 0 },
        customer_details: { email: 'jane@example.com', name: 'Jane' },
        collected_information: { shipping_details: { name: 'Jane Doe', address: { line1: '1 High St', city: 'London', postal_code: 'N1 1AA', country: 'GB' } } },
      },
    },
  };
  for (let i = 0; i < 2; i++) {
    const { payload, header } = signed(event);
    assert.equal((await post('/api/stripe/webhook', payload, { 'Stripe-Signature': header })).status, 200);
  }
  assert.equal(await stockOf('azelaic-acid-cream-20-20g'), before - 2);
  const order = readData('orders').find((o) => o.id === orderId);
  assert.equal(order.status, 'paid');
  assert.equal(order.customer.name, 'Jane Doe');
  assert.equal(order.total, 3240);

  const lookup = await (await realFetch(`${base}/api/order?session_id=${sessionId}`)).json();
  assert.equal(lookup.status, 'paid');
  assert.equal(lookup.email, 'jane@example.com');
});

test('admin API needs the password', async () => {
  assert.equal((await realFetch(`${base}/api/admin/orders`)).status, 401);
  const wrong = Buffer.from('a:nope').toString('base64');
  assert.equal((await realFetch(`${base}/api/admin/orders`, { headers: { Authorization: `Basic ${wrong}` } })).status, 401);
  const right = Buffer.from('a:admin-pass').toString('base64');
  assert.equal((await realFetch(`${base}/api/admin/orders`, { headers: { Authorization: `Basic ${right}` } })).status, 200);
});

test('static files cannot escape the public folder', async () => {
  for (const p of ['/../server.js', '/%2e%2e/server.js', '/..%2fserver.js', '/%2e%2e%2f.env']) {
    const res = await realFetch(base + p);
    assert.equal(res.status, 404, p);
  }
  assert.equal((await realFetch(`${base}/css/styles.css`)).status, 200);
});

test('contact form stores messages and rejects bad input', async () => {
  assert.equal((await post('/api/contact', { name: 'A', email: 'not-an-email', message: 'hi' })).status, 400);
  assert.equal((await post('/api/contact', { name: 'A', email: 'a@b.co', message: 'hello' })).status, 200);
  assert.equal(readData('messages').at(-1).message, 'hello');
});
