// Runs the shop as a plain Node server: on your computer, on Render, or on any Node host.
// On Netlify the same shop runs from netlify/functions/api.mjs instead.
const fs = require('fs');
const http = require('http');
const path = require('path');

try {
  process.loadEnvFile(path.join(__dirname, '.env'));
} catch {
  // No .env file: rely on real environment variables.
}

const { createShop } = require('./lib/shop');
const { fileStorage } = require('./lib/storage');
const { readBody, sendFile, staticPath } = require('./lib/http');

const PUBLIC_DIR = path.join(__dirname, 'public');

const PAGES = [
  [/^\/$/, 'index.html'],
  [/^\/products\/?$/, 'products.html'],
  [/^\/products\/[^/]+\/?$/, 'product.html'],
  [/^\/cart\/?$/, 'cart.html'],
  [/^\/contact\/?$/, 'contact.html'],
  [/^\/checkout\/success\/?$/, 'success.html'],
  [/^\/policies\/[^/]+\/?$/, 'policy.html'],
  [/^\/about\/?$/, 'policy.html'],
  [/^\/admin\/?$/, 'admin.html'],
];

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

function createApp({ dataDir = process.env.DATA_DIR || path.join(__dirname, '.data'), env = process.env, seed } = {}) {
  const shop = createShop({ storage: fileStorage(dataDir), env, seed });
  const isProd = env.NODE_ENV === 'production';

  function baseUrl(req) {
    if (env.PUBLIC_URL) return env.PUBLIC_URL.replace(/\/$/, '');
    const proto = req.headers['x-forwarded-proto'] || (req.socket.encrypted ? 'https' : 'http');
    return `${proto.split(',')[0]}://${req.headers.host}`;
  }

  return http.createServer(async (req, res) => {
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v);
    const url = new URL(req.url, 'http://localhost');
    const pathname = url.pathname;
    try {
      const rawBody = req.method === 'POST' || req.method === 'PATCH' ? await readBody(req) : null;
      const result = await shop.handle({
        method: req.method === 'HEAD' ? 'GET' : req.method,
        path: pathname,
        query: url.searchParams,
        headers: req.headers,
        rawBody,
        ip: (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress,
        baseUrl: baseUrl(req),
      });
      if (result) {
        res.writeHead(result.status, result.headers);
        return res.end(req.method === 'HEAD' ? undefined : result.body);
      }

      if (req.method === 'GET' || req.method === 'HEAD') {
        const page = PAGES.find(([re]) => re.test(pathname));
        if (page) return sendFile(res, path.join(PUBLIC_DIR, page[1]));
        const file = staticPath(PUBLIC_DIR, pathname);
        if (file && fs.existsSync(file) && fs.statSync(file).isFile()) return sendFile(res, file, 200, isProd ? 3600 : 0);
      }
      sendFile(res, path.join(PUBLIC_DIR, '404.html'), 404);
    } catch (err) {
      const status = err.status || 500;
      if (status >= 500) console.error(err);
      if (res.headersSent) return res.end();
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: status >= 500 ? 'Something went wrong. Please try again.' : err.message }));
    }
  });
}

if (require.main === module) {
  const port = process.env.PORT || 3000;
  const app = createApp();
  app.listen(port, () => {
    console.log(`Shop running at http://localhost:${port}`);
    if (!process.env.STRIPE_SECRET_KEY && process.env.NODE_ENV !== 'production') {
      console.log('Demo mode: no STRIPE_SECRET_KEY set, checkout will not take real payments.');
    }
  });
}

module.exports = { createApp };
