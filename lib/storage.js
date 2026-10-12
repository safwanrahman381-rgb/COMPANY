// Key-value storage for orders, messages and inventory. Every backend has the same async API:
//   get(key, fallback)  set(key, value)  list(prefix) -> keys
// Keys look like "inventory", "orders/<id>", "messages/<id>". Records are stored one per key so
// two customers checking out at once never overwrite each other's order.
const fs = require('fs');
const path = require('path');

const SAFE_KEY = /^[A-Za-z0-9_\-/]+$/;

function checkKey(key) {
  if (!SAFE_KEY.test(key) || key.includes('..')) throw new Error(`Invalid storage key: ${key}`);
}

// One JSON file per key under `dir`. Used when running with `node server.js`.
function fileStorage(dir) {
  const root = path.resolve(dir);
  const file = (key) => path.join(root, `${key}.json`);
  return {
    async get(key, fallback = null) {
      checkKey(key);
      try {
        return JSON.parse(fs.readFileSync(file(key), 'utf8'));
      } catch (err) {
        if (err.code === 'ENOENT') return fallback;
        throw err;
      }
    },
    async set(key, value) {
      checkKey(key);
      const target = file(key);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n');
      fs.renameSync(tmp, target);
    },
    async list(prefix) {
      checkKey(prefix.replace(/\/$/, ''));
      const folder = path.join(root, prefix);
      try {
        return fs
          .readdirSync(folder)
          .filter((f) => f.endsWith('.json'))
          .map((f) => `${prefix}${f.slice(0, -5)}`);
      } catch (err) {
        if (err.code === 'ENOENT') return [];
        throw err;
      }
    },
  };
}

// Netlify Blobs store (from @netlify/blobs getStore). Used by the Netlify function.
function blobStorage(store) {
  return {
    async get(key, fallback = null) {
      checkKey(key);
      const value = await store.get(key, { type: 'json' });
      return value == null ? fallback : value;
    },
    async set(key, value) {
      checkKey(key);
      await store.setJSON(key, value);
    },
    async list(prefix) {
      const { blobs } = await store.list({ prefix });
      return blobs.map((b) => b.key);
    },
  };
}

// In-memory storage for tests.
function memoryStorage() {
  const data = new Map();
  return {
    data,
    async get(key, fallback = null) {
      return data.has(key) ? structuredClone(data.get(key)) : fallback;
    },
    async set(key, value) {
      data.set(key, structuredClone(value));
    },
    async list(prefix) {
      return [...data.keys()].filter((k) => k.startsWith(prefix));
    },
  };
}

module.exports = { fileStorage, blobStorage, memoryStorage };
