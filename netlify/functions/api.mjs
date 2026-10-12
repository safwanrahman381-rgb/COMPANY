// Netlify Function: runs the shop's API and stores orders, messages and stock in Netlify Blobs.
// The pages themselves are plain files in /public, served by Netlify directly (see netlify.toml).
import { getStore } from '@netlify/blobs';
import shopModule from '../../lib/shop.js';
import storageModule from '../../lib/storage.js';

const { createShop } = shopModule;
const { blobStorage } = storageModule;

let shop;

export default async (req, context) => {
  if (!shop) {
    shop = createShop({ storage: blobStorage(getStore({ name: 'shop', consistency: 'strong' })) });
  }
  const url = new URL(req.url);
  const rawBody = req.method === 'POST' || req.method === 'PATCH' ? Buffer.from(await req.arrayBuffer()) : null;
  const result = await shop.handle({
    method: req.method === 'HEAD' ? 'GET' : req.method,
    path: url.pathname,
    query: url.searchParams,
    headers: Object.fromEntries(req.headers),
    rawBody,
    ip: context.ip,
    baseUrl: url.origin,
  });
  if (!result) return new Response('Not found', { status: 404 });
  return new Response(result.body, { status: result.status, headers: result.headers });
};

// Product photos in /public win over the function; only missing ones fall through to the
// generated placeholder image.
export const config = {
  path: ['/api/*', '/images/products/*'],
  preferStatic: true,
};
