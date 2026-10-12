// Tiny JSON-file data store. Fine for a small shop; swap for a real database as you grow.
const fs = require('fs');
const path = require('path');

// Starting data ships in ./data. Set DATA_DIR to a persistent disk in production: anything
// missing there is read from ./data, and every write goes to DATA_DIR.
const SEED_DIR = path.join(__dirname, '..', 'data');
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : SEED_DIR;
fs.mkdirSync(DATA_DIR, { recursive: true });

function file(name) {
  return path.join(DATA_DIR, `${name}.json`);
}

function read(name, fallback = []) {
  for (const dir of DATA_DIR === SEED_DIR ? [DATA_DIR] : [DATA_DIR, SEED_DIR]) {
    try {
      return JSON.parse(fs.readFileSync(path.join(dir, `${name}.json`), 'utf8'));
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
  }
  return fallback;
}

function write(name, value) {
  const target = file(name);
  const tmp = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n');
  fs.renameSync(tmp, target);
}

// Writes are synchronous, so read-modify-write inside update() can't interleave.
function update(name, fallback, fn) {
  const value = read(name, fallback);
  const result = fn(value);
  write(name, value);
  return result;
}

module.exports = { read, write, update };
