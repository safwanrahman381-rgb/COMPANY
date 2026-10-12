// Minimal Stripe client over the REST API using Node's built-in fetch and crypto.
const crypto = require('crypto');

const API = 'https://api.stripe.com/v1';

// Stripe takes form-encoded bodies with bracket notation: line_items[0][price_data][currency]=gbp
function encode(params, prefix, out = []) {
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    const name = prefix ? `${prefix}[${key}]` : key;
    if (typeof value === 'object') encode(value, name, out);
    else out.push(`${encodeURIComponent(name)}=${encodeURIComponent(value)}`);
  }
  return out.join('&');
}

function createStripe(secretKey) {
  async function request(method, path, params) {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params ? encode(params) : undefined,
    });
    const data = await res.json();
    if (!res.ok) {
      const err = new Error((data.error && data.error.message) || `Stripe error ${res.status}`);
      err.statusCode = res.status;
      throw err;
    }
    return data;
  }

  return {
    coupons: {
      retrieve: (id) => request('GET', `/coupons/${encodeURIComponent(id)}`),
      create: (params) => request('POST', '/coupons', params),
    },
    checkout: {
      sessions: {
        create: (params) => request('POST', '/checkout/sessions', params),
      },
    },
  };
}

// Verifies the Stripe-Signature header and returns the parsed event, or throws.
function verifyWebhook(rawBody, header, secret, toleranceSeconds = 300) {
  const parts = Object.create(null);
  const signatures = [];
  for (const item of String(header || '').split(',')) {
    const [k, v] = item.split('=');
    if (k === 'v1') signatures.push(v);
    else parts[k] = v;
  }
  if (!parts.t || signatures.length === 0) throw new Error('Missing signature');
  if (Math.abs(Date.now() / 1000 - Number(parts.t)) > toleranceSeconds) throw new Error('Signature timestamp too old');
  const expected = crypto.createHmac('sha256', secret).update(`${parts.t}.${rawBody}`).digest();
  const ok = signatures.some((sig) => {
    const given = Buffer.from(sig, 'hex');
    return given.length === expected.length && crypto.timingSafeEqual(given, expected);
  });
  if (!ok) throw new Error('Signature mismatch');
  return JSON.parse(rawBody.toString('utf8'));
}

module.exports = { createStripe, verifyWebhook, encode };
