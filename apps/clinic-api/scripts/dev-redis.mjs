#!/usr/bin/env node
/**
 * A Redis stand-in for local development. NOT for any deployment.
 *
 *   node scripts/dev-redis.mjs [port]
 *
 * ── Why this exists ─────────────────────────────────────────────────
 *
 * Sessions live in Redis and reads fail closed, which is correct: serving
 * patient data to a token whose revocation status is unknown is the hole
 * that design exists to close. The consequence is that without Redis you
 * cannot sign in at all, so you cannot open a single screen of the portal
 * — and on a machine with no Docker there was no way to get one.
 *
 * That made the portal unrunnable locally, which is how UI faults reach a
 * real clinic: nobody can look at the screens.
 *
 * ── What it is ──────────────────────────────────────────────────────
 *
 * The RESP2 subset `lib/sessions.ts` actually uses, in memory, single
 * process, no persistence, no auth. Restarting it signs everyone out,
 * which for local work is a feature.
 *
 * It is deliberately NOT a Redis: no clustering, no pub/sub, no eviction,
 * no durability. If a session bug reproduces here and not in production, or
 * the reverse, suspect this file first.
 */

import { createServer } from 'node:net';

const PORT = Number(process.argv[2] ?? 6379);

/** key -> { value } for strings, { set: Set } for sets. */
const store = new Map();
/** key -> epoch ms. Expiry is applied lazily, on read. */
const expiries = new Map();

const alive = (key) => {
  const at = expiries.get(key);
  if (at !== undefined && at <= Date.now()) {
    store.delete(key);
    expiries.delete(key);
    return false;
  }
  return store.has(key);
};

// ── RESP encoding ─────────────────────────────────────────────────────
const ok = () => '+OK\r\n';
const simple = (s) => `+${s}\r\n`;
const int = (n) => `:${n}\r\n`;
const nil = () => '$-1\r\n';
const bulk = (s) => (s === null || s === undefined ? nil() : `$${Buffer.byteLength(s)}\r\n${s}\r\n`);
const array = (items) => `*${items.length}\r\n${items.join('')}\r\n`.replace(/\r\n$/, '');
const err = (m) => `-ERR ${m}\r\n`;

// ── Commands ──────────────────────────────────────────────────────────
const run = (argv) => {
  const cmd = String(argv[0] ?? '').toUpperCase();
  const a = argv.slice(1);

  switch (cmd) {
    case 'PING':
      return a.length ? bulk(a[0]) : simple('PONG');
    case 'QUIT':
      return ok();
    // ioredis probes these on connect. Answering plausibly is enough.
    case 'INFO':
      return bulk('# Server\r\nredis_version:7.0.0-dev-stub\r\nrole:master\r\n');
    case 'CLIENT':
    case 'SELECT':
    case 'READONLY':
      return ok();
    case 'COMMAND':
      return '*0\r\n';

    case 'SET': {
      const [key, value, ...rest] = a;
      store.set(key, { value: String(value) });
      expiries.delete(key);
      for (let i = 0; i < rest.length; i += 1) {
        const opt = String(rest[i]).toUpperCase();
        if (opt === 'EX') expiries.set(key, Date.now() + Number(rest[i + 1]) * 1000);
        if (opt === 'PX') expiries.set(key, Date.now() + Number(rest[i + 1]));
      }
      return ok();
    }
    case 'GET': {
      const key = a[0];
      if (!alive(key)) return nil();
      const entry = store.get(key);
      return entry && 'value' in entry ? bulk(entry.value) : nil();
    }
    case 'MGET':
      return array(a.map((key) => {
        if (!alive(key)) return nil();
        const entry = store.get(key);
        return entry && 'value' in entry ? bulk(entry.value) : nil();
      }));
    case 'DEL': {
      let n = 0;
      for (const key of a) {
        if (alive(key)) n += 1;
        store.delete(key);
        expiries.delete(key);
      }
      return int(n);
    }
    case 'EXISTS':
      return int(a.filter(alive).length);

    case 'SADD': {
      const [key, ...members] = a;
      if (!alive(key) || !store.get(key)?.set) store.set(key, { set: new Set() });
      const set = store.get(key).set;
      let added = 0;
      for (const m of members) {
        if (!set.has(String(m))) { set.add(String(m)); added += 1; }
      }
      return int(added);
    }
    case 'SREM': {
      const [key, ...members] = a;
      if (!alive(key)) return int(0);
      const set = store.get(key)?.set;
      if (!set) return int(0);
      let removed = 0;
      for (const m of members) if (set.delete(String(m))) removed += 1;
      return int(removed);
    }
    case 'SMEMBERS': {
      const key = a[0];
      if (!alive(key)) return '*0\r\n';
      const set = store.get(key)?.set;
      if (!set || set.size === 0) return '*0\r\n';
      return array([...set].map(bulk));
    }
    case 'SCARD': {
      const key = a[0];
      return int(alive(key) ? (store.get(key)?.set?.size ?? 0) : 0);
    }

    case 'EXPIRE': {
      const [key, seconds] = a;
      if (!alive(key)) return int(0);
      expiries.set(key, Date.now() + Number(seconds) * 1000);
      return int(1);
    }
    case 'TTL': {
      const key = a[0];
      if (!alive(key)) return int(-2);
      const at = expiries.get(key);
      return int(at === undefined ? -1 : Math.ceil((at - Date.now()) / 1000));
    }
    case 'FLUSHALL':
    case 'FLUSHDB':
      store.clear();
      expiries.clear();
      return ok();

    default:
      // Loud rather than silent: a command this does not implement is a
      // reason the API is misbehaving, and guessing +OK would hide it.
      process.stderr.write(`[dev-redis] unimplemented: ${cmd}\n`);
      return err(`unknown command '${cmd}' (dev-redis implements only what sessions.ts uses)`);
  }
};

// ── Connection handling ───────────────────────────────────────────────
createServer((socket) => {
  let buf = Buffer.alloc(0);
  /** Non-null while inside MULTI: commands queue instead of running. */
  let queued = null;

  socket.on('data', (chunk) => {
    buf = Buffer.concat([buf, chunk]);

    // Parse as many complete RESP arrays as the buffer holds. A partial
    // command is left for the next chunk rather than guessed at.
    for (;;) {
      const parsed = parseOne(buf);
      if (!parsed) break;
      buf = parsed.rest;
      const argv = parsed.argv;
      if (argv.length === 0) continue;

      const cmd = String(argv[0]).toUpperCase();
      if (cmd === 'MULTI') { queued = []; socket.write(ok()); continue; }
      if (cmd === 'DISCARD') { queued = null; socket.write(ok()); continue; }
      if (cmd === 'EXEC') {
        const batch = queued ?? [];
        queued = null;
        socket.write(`*${batch.length}\r\n`);
        for (const q of batch) socket.write(run(q));
        continue;
      }
      if (queued) { queued.push(argv); socket.write(simple('QUEUED')); continue; }
      socket.write(run(argv));
    }
  });

  socket.on('error', () => { /* a client that hung up is not an event */ });
}).listen(PORT, '127.0.0.1', () => {
  process.stdout.write(`[dev-redis] listening on 127.0.0.1:${PORT} — in-memory, development only\n`);
});

/**
 * One RESP array off the front of the buffer, or null if it is incomplete.
 * Returns the remainder so the caller can keep going.
 */
function parseOne(buf) {
  if (buf.length === 0 || buf[0] !== 0x2a /* * */) {
    // Inline command ("PING\r\n"), which redis-cli and some health checks
    // send. Supported so a stray probe does not wedge the parser.
    const end = buf.indexOf('\r\n');
    if (end === -1) return null;
    const line = buf.subarray(0, end).toString('utf8').trim();
    return { argv: line ? line.split(/\s+/) : [], rest: buf.subarray(end + 2) };
  }

  let i = buf.indexOf('\r\n');
  if (i === -1) return null;
  const count = Number(buf.subarray(1, i).toString('utf8'));
  let pos = i + 2;
  const argv = [];

  for (let n = 0; n < count; n += 1) {
    if (buf[pos] !== 0x24 /* $ */) return null;
    const lenEnd = buf.indexOf('\r\n', pos);
    if (lenEnd === -1) return null;
    const len = Number(buf.subarray(pos + 1, lenEnd).toString('utf8'));
    const start = lenEnd + 2;
    if (buf.length < start + len + 2) return null;
    argv.push(buf.subarray(start, start + len).toString('utf8'));
    pos = start + len + 2;
  }
  return { argv, rest: buf.subarray(pos) };
}
