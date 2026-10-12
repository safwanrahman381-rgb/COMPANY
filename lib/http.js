// Small router and static file server on top of node:http, so the shop has no npm dependencies.
const fs = require('fs');
const path = require('path');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
  '.woff2': 'font/woff2',
};

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function createRouter() {
  const routes = [];
  const add = (method) => (pattern, handler) => {
    const keys = [];
    const regex = new RegExp(
      '^' + pattern.replace(/\/:(\w+)/g, (_, k) => { keys.push(k); return '/([^/]+)'; }).replace(/\./g, '\\.') + '/?$'
    );
    routes.push({ method, regex, keys, handler });
  };

  function match(method, pathname) {
    for (const r of routes) {
      if (r.method !== method && !(r.method === 'GET' && method === 'HEAD')) continue;
      const m = pathname.match(r.regex);
      if (m) {
        const params = {};
        r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
        return { handler: r.handler, params };
      }
    }
    return null;
  }

  return { get: add('GET'), post: add('POST'), patch: add('PATCH'), match };
}

function readBody(req, limit = 100 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(new HttpError(413, 'Request too large'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}

function sendFile(res, file, status = 200, maxAge = 0) {
  fs.stat(file, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Not found');
    }
    res.writeHead(status, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': maxAge ? `public, max-age=${maxAge}` : 'no-cache',
    });
    if (res.req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
}

// Resolves a URL path to a file inside root, refusing anything that escapes it.
function staticPath(root, pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const file = path.normalize(path.join(root, decoded));
  if (file !== root && !file.startsWith(root + path.sep)) return null;
  if (path.basename(file).startsWith('.')) return null;
  return file;
}

module.exports = { createRouter, readBody, sendJson, sendFile, staticPath, HttpError };
