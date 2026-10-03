'use strict';
/*  Gavel FC server. No dependencies: run with `node server.js`.
    The server owns all auction state (budgets, bids, timers), so nobody can cheat from the browser.
    Browsers get live updates over Server-Sent Events and send actions with plain POST requests. */
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const PLAYERS = require('./public/players.js');

const PORT = +process.env.PORT || 3000;
const FAST = !!process.env.GAVEL_FAST; // test mode: tiny timers
const CFG = {
  budget: 100000,
  squad: 26,
  reserve: 100,       // every empty slot must stay fundable at the cheapest price
  step: 50,           // bids move in steps of 50
  max: 8,
  min: 2,
  lotMs: FAST ? 500 : 20000,
  resetMs: FAST ? 250 : 10000, // a new bid never leaves less than this on the clock
  soldMs: FAST ? 40 : 3800,
  passMs: FAST ? 40 : 2200
};
const COLORS = ['#ff6b4a', '#4ac9ff', '#ffd24a', '#7dff8a', '#c68bff', '#ff8bd0', '#58ffd9', '#ffa94a'];
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const rooms = new Map();

const fail = (msg, status = 400) => Object.assign(new Error(msg), { status });
const left = m => CFG.squad - m.roster.length;
const maxBid = m => m.budget - CFG.reserve * (left(m) - 1);

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function genCode() {
  for (;;) {
    let c = '';
    for (let i = 0; i < 6; i++) c += ALPHABET[crypto.randomInt(ALPHABET.length)];
    if (!rooms.has(c)) return c;
  }
}

function cleanName(raw) {
  const n = String(raw || '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 18);
  if (!n) throw fail('Enter a display name');
  return n;
}

function hashPw(pw, salt) {
  return crypto.scryptSync(String(pw), salt, 32);
}

function addMember(room, name) {
  if (room.members.some(m => m.name.toLowerCase() === name.toLowerCase())) throw fail('That name is already taken in this room');
  const used = new Set(room.members.map(m => m.color));
  const m = {
    id: crypto.randomBytes(6).toString('hex'),
    token: crypto.randomBytes(18).toString('hex'),
    name,
    color: COLORS.find(c => !used.has(c)) || COLORS[0],
    budget: CFG.budget,
    roster: [],
    conns: 0,
    dropTimer: null
  };
  room.members.push(m);
  return m;
}

/* ---------- views ---------- */
function view(room) {
  const L = room.lot;
  return {
    code: room.code,
    phase: room.phase,
    hostId: room.hostId,
    now: Date.now(),
    cfg: CFG,
    total: PLAYERS.length,
    members: room.members.map(m => ({
      id: m.id, name: m.name, color: m.color, budget: m.budget, connected: m.conns > 0, roster: m.roster
    })),
    lot: L && { n: L.n, pid: L.pid, base: L.base, bid: L.bid, bidderId: L.bidderId, endsAt: L.endsAt, span: L.span, status: L.status },
    poolLeft: room.queue.length,
    log: room.log.slice(-60)
  };
}

function send(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function broadcast(room) {
  room.touched = Date.now();
  const v = view(room);
  for (const res of room.clients.keys()) send(res, 'state', v);
}

/* ---------- auction flow ---------- */
function startAuction(room) {
  room.phase = 'auction';
  room.queue = shuffle(PLAYERS.map(p => p.id));
  room.base = {};
  room.unsold = {};
  room.lotN = 0;
  room.log.push({ k: 'start' });
  nextLot(room);
}

function nextLot(room) {
  clearTimeout(room.timer);
  const open = room.members.filter(m => left(m) > 0);
  if (!open.length || !room.queue.length) return finish(room);
  const pid = room.queue.shift();
  const base = room.base[pid] ?? PLAYERS[pid].base;
  room.lot = { n: ++room.lotN, pid, base, bid: 0, bidderId: null, endsAt: Date.now() + CFG.lotMs, span: CFG.lotMs, status: 'live' };
  if (open.length === 1) {
    // Only one team still needs players: it signs at the opening price (capped by its limit).
    return sell(room, open[0].id, Math.min(base, maxBid(open[0])), true);
  }
  if (!open.some(m => maxBid(m) >= base)) return passLot(room);
  room.timer = setTimeout(() => resolve(room), CFG.lotMs);
  broadcast(room);
}

function resolve(room) {
  const L = room.lot;
  if (!L || L.status !== 'live') return;
  if (L.bidderId) sell(room, L.bidderId, L.bid, false);
  else passLot(room);
}

function sell(room, memberId, price, auto) {
  const L = room.lot;
  const m = room.members.find(x => x.id === memberId);
  m.budget -= price;
  m.roster.push({ pid: L.pid, price });
  L.status = 'sold';
  L.bidderId = m.id;
  L.bid = price;
  L.endsAt = Date.now();
  room.log.push({ k: auto ? 'auto' : 'sold', who: m.id, pid: L.pid, amt: price });
  broadcast(room);
  clearTimeout(room.timer);
  room.timer = setTimeout(() => nextLot(room), CFG.soldMs);
}

function passLot(room) {
  const L = room.lot;
  const count = room.unsold[L.pid] = (room.unsold[L.pid] || 0) + 1;
  room.base[L.pid] = Math.max(100, Math.floor(L.base / 2 / CFG.step) * CFG.step);
  if (count >= 3) {
    // Nobody wants him after three rounds at falling prices: assign to the team with most empty slots.
    const open = room.members.filter(m => left(m) > 0).sort((a, b) => left(b) - left(a) || b.budget - a.budget);
    const m = open[0];
    return sell(room, m.id, Math.max(100, Math.min(L.base, maxBid(m))), true);
  }
  L.status = 'unsold';
  L.bidderId = null;
  L.bid = 0;
  room.queue.push(L.pid);
  room.log.push({ k: 'unsold', pid: L.pid });
  broadcast(room);
  clearTimeout(room.timer);
  room.timer = setTimeout(() => nextLot(room), CFG.passMs);
}

function finish(room) {
  clearTimeout(room.timer);
  room.phase = 'done';
  room.lot = null;
  room.log.push({ k: 'done' });
  broadcast(room);
}

function placeBid(room, m, amount) {
  const L = room.lot;
  if (room.phase !== 'auction' || !L || L.status !== 'live') throw fail('No lot is open for bids');
  if (Date.now() >= L.endsAt) throw fail('Too late, the hammer is down');
  if (left(m) <= 0) throw fail('Your squad is already complete');
  if (L.bidderId === m.id) throw fail('You already hold the highest bid');
  amount = Number(amount);
  if (!Number.isInteger(amount) || amount % CFG.step) throw fail(`Bids go up in steps of ${CFG.step}`);
  const min = L.bidderId ? L.bid + CFG.step : L.base;
  if (amount < min) throw fail(`The minimum bid is ${min.toLocaleString('en-US')}`);
  const cap = maxBid(m);
  if (amount > cap) throw fail(`Your limit is ${cap.toLocaleString('en-US')}. Each empty slot needs ${CFG.reserve} kept back.`);
  L.bid = amount;
  L.bidderId = m.id;
  if (L.endsAt - Date.now() < CFG.resetMs) {
    L.endsAt = Date.now() + CFG.resetMs;
    L.span = CFG.resetMs;
  }
  clearTimeout(room.timer);
  room.timer = setTimeout(() => resolve(room), L.endsAt - Date.now() + 30);
  room.log.push({ k: 'bid', who: m.id, pid: L.pid, amt: amount });
  broadcast(room);
}

/* ---------- membership ---------- */
function removeMember(room, m) {
  if (room.phase === 'auction') return;
  room.members = room.members.filter(x => x !== m);
  if (!room.members.length) { clearTimeout(room.timer); rooms.delete(room.code); return; }
  if (room.hostId === m.id) room.hostId = room.members[0].id;
  broadcast(room);
}

/* ---------- API ---------- */
const hits = new Map();
function limit(ip, key, max, windowMs) {
  const k = key + ip, now = Date.now();
  const h = hits.get(k);
  if (!h || now > h.reset) { hits.set(k, { n: 1, reset: now + windowMs }); return; }
  if (++h.n > max) throw fail('Too many attempts. Wait a minute and try again.', 429);
}

const actions = {
  create(b, ip) {
    limit(ip, 'create', 20, 60000);
    const name = cleanName(b.name);
    const pw = String(b.password || '');
    if (pw.length < 4) throw fail('Choose a password with at least 4 characters');
    const salt = crypto.randomBytes(16);
    const room = {
      code: genCode(), salt, hash: hashPw(pw, salt), phase: 'lobby', hostId: null, members: [], queue: [], lot: null,
      lotN: 0, log: [], clients: new Map(), timer: null, touched: Date.now(), base: {}, unsold: {}
    };
    rooms.set(room.code, room);
    const m = addMember(room, name);
    room.hostId = m.id;
    return { code: room.code, token: m.token, id: m.id };
  },
  join(b, ip) {
    limit(ip, 'join', 12, 60000);
    const room = rooms.get(String(b.code || '').trim().toUpperCase());
    const pw = String(b.password || '');
    const ok = room && crypto.timingSafeEqual(hashPw(pw, room.salt), room.hash);
    if (!ok) throw fail('Wrong room code or password');
    const name = cleanName(b.name);
    if (room.phase !== 'lobby') {
      // Lost your device mid-auction? Rejoin under your own name while nobody is connected as you.
      const m = room.members.find(x => x.name.toLowerCase() === name.toLowerCase() && x.conns === 0);
      if (!m) throw fail('This auction has already started');
      return { code: room.code, token: m.token, id: m.id };
    }
    if (room.members.length >= CFG.max) throw fail(`This room is full (${CFG.max} managers)`);
    const m = addMember(room, name);
    broadcast(room);
    return { code: room.code, token: m.token, id: m.id };
  },
  start(b, ip, { room, m }) {
    if (room.hostId !== m.id) throw fail('Only the host can start the auction', 403);
    if (room.phase !== 'lobby') throw fail('The auction has already started');
    if (room.members.length < CFG.min) throw fail('You need at least 2 managers to start');
    startAuction(room);
    return {};
  },
  bid(b, ip, { room, m }) {
    placeBid(room, m, b.amount);
    return {};
  },
  leave(b, ip, { room, m }) {
    if (room.phase === 'auction') throw fail('You cannot leave during the auction. Close the tab and rejoin later.');
    removeMember(room, m);
    return {};
  }
};

function auth(b) {
  const room = rooms.get(String(b.code || '').toUpperCase());
  const m = room && room.members.find(x => x.token === b.token);
  if (!m) throw fail('This room is no longer available', 404);
  return { room, m };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let s = '';
    req.on('data', d => { s += d; if (s.length > 4096) { reject(fail('Request too large', 413)); req.destroy(); } });
    req.on('end', () => { try { resolve(s ? JSON.parse(s) : {}); } catch { reject(fail('Bad request')); } });
    req.on('error', reject);
  });
}

const clientIp = req => (process.env.TRUST_PROXY && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket.remoteAddress || '?';

async function handleApi(req, res, name) {
  const json = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
  try {
    const fn = actions[name];
    if (!fn) throw fail('Not found', 404);
    const b = await readBody(req);
    const ctx = ['create', 'join'].includes(name) ? undefined : auth(b);
    json(200, fn(b, clientIp(req), ctx));
  } catch (e) {
    json(e.status || 500, { error: e.status ? e.message : 'Server error' });
    if (!e.status) console.error(e);
  }
}

function sse(req, res, url) {
  const room = rooms.get((url.searchParams.get('code') || '').toUpperCase());
  const m = room && room.members.find(x => x.token === url.searchParams.get('token'));
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  if (!m) { send(res, 'gone', { msg: 'That room is no longer available.' }); return res.end(); }
  room.clients.set(res, m.id);
  m.conns++;
  clearTimeout(m.dropTimer);
  res.write(': ok\n\n');
  broadcast(room);
  const hb = setInterval(() => res.write(': hb\n\n'), 20000);
  req.on('close', () => {
    clearInterval(hb);
    room.clients.delete(res);
    m.conns = Math.max(0, m.conns - 1);
    if (m.conns === 0 && room.phase === 'lobby') m.dropTimer = setTimeout(() => removeMember(room, m), 30000);
    if (rooms.has(room.code)) broadcast(room);
  });
}

/* ---------- static files ---------- */
const PUB = path.join(__dirname, 'public');
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };

function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === '/') rel = '/index.html';
  const file = path.normalize(path.join(PUB, rel));
  if (!file.startsWith(PUB + path.sep)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (req.method === 'GET' && url.pathname === '/api/events') return sse(req, res, url);
  if (req.method === 'POST' && url.pathname.startsWith('/api/')) return handleApi(req, res, url.pathname.slice(5));
  if (req.method === 'GET' || req.method === 'HEAD') return serveStatic(req, res, url.pathname);
  res.writeHead(405); res.end();
});

// Forget rooms that nobody has touched for 3 hours.
setInterval(() => {
  const now = Date.now();
  for (const [code, r] of rooms) if (!r.clients.size && now - r.touched > 3 * 3600e3) { clearTimeout(r.timer); rooms.delete(code); }
  for (const [k, h] of hits) if (now > h.reset) hits.delete(k);
}, 600e3).unref();

server.listen(PORT, () => {
  console.log(`\n  Gavel FC is running\n  This computer:  http://localhost:${PORT}`);
  for (const list of Object.values(os.networkInterfaces()))
    for (const i of list || []) if (i.family === 'IPv4' && !i.internal) console.log(`  Same Wi-Fi:     http://${i.address}:${PORT}`);
  console.log('');
});
