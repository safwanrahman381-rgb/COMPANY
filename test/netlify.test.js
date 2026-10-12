// Runs the shop the way the Netlify function does, against an in-memory stand-in for a
// Netlify Blobs store (same get/setJSON/list calls as @netlify/blobs).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createShop } = require('../lib/shop');
const { blobStorage } = require('../lib/storage');

function fakeBlobStore() {
  const data = new Map();
  return {
    async get(key, options) {
      assert.deepEqual(options, { type: 'json' });
      return data.has(key) ? JSON.parse(data.get(key)) : null;
    },
    async setJSON(key, value) {
      data.set(key, JSON.stringify(value));
    },
    async list({ prefix }) {
      return { blobs: [...data.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key, etag: 'x' })), directories: [] };
    },
  };
}

const call = (shop, method, path, body, headers = {}) =>
  shop.handle({
    method,
    path: path.split('?')[0],
    query: new URLSearchParams(path.split('?')[1] || ''),
    headers,
    rawBody: body ? Buffer.from(JSON.stringify(body)) : null,
    ip: '1.2.3.4',
    baseUrl: 'https://velora.netlify.app',
  });

test('orders, stock and messages persist through the Blobs adapter', async () => {
  const shop = createShop({ storage: blobStorage(fakeBlobStore()), env: { ADMIN_PASSWORD: 'pw' } });
  assert.equal(shop.demoMode, true);

  const checkout = await call(shop, 'POST', '/api/checkout', { items: [{ slug: 'tretinoin-cream-0-1-20g', qty: 2 }] });
  assert.equal(checkout.status, 200);
  const orderId = new URL(JSON.parse(checkout.body).url, 'https://x').searchParams.get('order');

  const lookup = JSON.parse((await call(shop, 'GET', `/api/order?order=${orderId}`)).body);
  assert.equal(lookup.status, 'paid');
  assert.equal(lookup.total, 3400); // 2 × £17, free delivery over £30

  const product = JSON.parse((await call(shop, 'GET', '/api/products/tretinoin-cream-0-1-20g')).body);
  assert.equal(product.maxQty, 10); // 20 - 2 = 18 left, capped at 10 per order
  const auth = { authorization: `Basic ${Buffer.from('a:pw').toString('base64')}` };
  const all = JSON.parse((await call(shop, 'GET', '/api/admin/products', null, auth)).body);
  assert.equal(all.find((p) => p.slug === 'tretinoin-cream-0-1-20g').stock, 18);

  assert.equal((await call(shop, 'POST', '/api/contact', { name: 'A', email: 'a@b.co', message: 'hi' })).status, 200);
  const summary = JSON.parse((await call(shop, 'GET', '/api/admin/summary', null, auth)).body);
  assert.equal(summary.paidOrders, 1);
  assert.equal(summary.unreadMessages, 1);
});

test('unknown paths fall through so Netlify can serve static files', async () => {
  const shop = createShop({ storage: blobStorage(fakeBlobStore()), env: {} });
  assert.equal(await call(shop, 'GET', '/images/products/tretinoin-cream-0-1-20g.jpg'), null);
  assert.equal((await call(shop, 'GET', '/api/nope')).status, 404);
  assert.equal((await call(shop, 'GET', '/images/products/hydroquinone-cream-4-20g.svg')).status, 200);
});
