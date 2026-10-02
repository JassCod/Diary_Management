'use strict';
// HTTP server: JSON API for the dairy owner, a read-only portal for
// customers, and the static web app in /public. No external packages.

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const D = require('./db');
const defaultScanner = require('./scan');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const SESSION_DAYS = 60;

// ---------- small helpers ----------

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const bad = (msg) => new HttpError(400, msg);

// Turn a failure from the photo reader into a message the owner can act on.
function scanError(e) {
  let Anthropic = null;
  try { Anthropic = require('@anthropic-ai/sdk'); } catch { /* not installed */ }
  if (Anthropic && e instanceof Anthropic.AuthenticationError) return new HttpError(502, 'The photo reading key (ANTHROPIC_API_KEY) is wrong.');
  if (Anthropic && e instanceof Anthropic.RateLimitError) return new HttpError(503, 'Photo reading is busy. Please try again in a minute.');
  if (Anthropic && e instanceof Anthropic.APIError) {
    console.error('Photo reading failed:', e.status, e.message);
    return new HttpError(502, 'Photo reading failed. Please try again.');
  }
  if (e instanceof HttpError) return e;
  return new HttpError(422, e.message || 'The photo could not be read. Please try another photo.');
}

function hashSecret(secret) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(secret), salt, 32).toString('hex');
  return `${salt}:${hash}`;
}
function checkSecret(secret, stored) {
  if (!stored) return false;
  const [salt, hash] = stored.split(':');
  const test = crypto.scryptSync(String(secret), salt, 32);
  const want = Buffer.from(hash, 'hex');
  return want.length === test.length && crypto.timingSafeEqual(test, want);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function date(v, name = 'date') {
  if (!DATE_RE.test(String(v || ''))) throw bad(`Please choose a valid ${name}`);
  return v;
}
function num(v, name, { min = 0, allowZero = false, optional = false } = {}) {
  if (optional && (v === '' || v == null)) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || (!allowZero && n === 0)) throw bad(`Please enter a valid ${name}`);
  return D.round2(n);
}
function oneOf(v, list, name) {
  if (!list.includes(v)) throw bad(`Please choose ${name}`);
  return v;
}
function text(v, max = 200) {
  const s = (v == null ? '' : String(v)).trim();
  return s ? s.slice(0, max) : null;
}
function rangeOf(q) {
  const from = q.get('from');
  const to = q.get('to');
  return {
    from: from && DATE_RE.test(from) ? from : null,
    to: to && DATE_RE.test(to) ? to : null,
  };
}

// Throttle repeated wrong logins (per key) to stop PIN guessing.
const failures = new Map();
function guardLogin(key) {
  const f = failures.get(key);
  if (f && f.count >= 5 && Date.now() - f.at < 15 * 60 * 1000) {
    throw new HttpError(429, 'Too many wrong attempts. Please try again after 15 minutes.');
  }
}
function loginFailed(key) {
  const f = failures.get(key) || { count: 0, at: 0 };
  if (Date.now() - f.at > 15 * 60 * 1000) f.count = 0;
  f.count += 1;
  f.at = Date.now();
  failures.set(key, f);
}

// ---------- app ----------

function createApp(db, { scanner = defaultScanner } = {}) {
  const routes = [];
  const route = (method, pattern, role, handler) => {
    const keys = [];
    const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '(\\d+)'; }) + '$');
    routes.push({ method, re, keys, role, handler });
  };

  const newSession = (role, partyId = null) => {
    const token = crypto.randomBytes(24).toString('hex');
    db.prepare('INSERT INTO sessions (token, role, party_id) VALUES (?, ?, ?)').run(token, role, partyId);
    return token;
  };
  const partyExists = (id) => {
    if (id == null) return null;
    const p = db.prepare('SELECT id FROM parties WHERE id = ?').get(Number(id));
    if (!p) throw bad('Customer not found');
    return p.id;
  };
  const requireParty = (id) => {
    if (!id) throw bad('Please choose the person');
    return partyExists(id);
  };
  const del = (table) => ({ params }) => {
    const r = db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(params.id);
    if (!r.changes) throw new HttpError(404, 'Entry not found');
    return { ok: true };
  };
  const listRange = (sql, order) => ({ query }) => {
    const { from, to } = rangeOf(query);
    const where = [];
    const args = [];
    if (from) { where.push('x.date >= ?'); args.push(from); }
    if (to) { where.push('x.date <= ?'); args.push(to); }
    const pid = query.get('party_id');
    if (pid) { where.push('x.party_id = ?'); args.push(Number(pid)); }
    return db.prepare(`${sql} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY ${order} LIMIT 2000`).all(...args);
  };

  // ----- setup & login -----

  route('GET', '/api/status', null, () => {
    const s = D.getSettings(db);
    return { setup_needed: !s.admin_pass_hash, dairy_name: s.dairy_name, dairy_phone: s.dairy_phone, scan_enabled: scanner.enabled() };
  });

  route('POST', '/api/setup', null, ({ body }) => {
    const s = D.getSettings(db);
    if (s.admin_pass_hash) throw new HttpError(403, 'Already set up');
    const pw = String(body.password || '');
    if (pw.length < 4) throw bad('Password must be at least 4 characters');
    D.setSetting(db, 'admin_pass_hash', hashSecret(pw));
    if (text(body.dairy_name)) D.setSetting(db, 'dairy_name', text(body.dairy_name));
    return { token: newSession('admin'), role: 'admin' };
  });

  route('POST', '/api/login/admin', null, ({ body }) => {
    guardLogin('admin');
    const s = D.getSettings(db);
    if (!checkSecret(String(body.password || ''), s.admin_pass_hash)) {
      loginFailed('admin');
      throw new HttpError(401, 'Wrong password');
    }
    failures.delete('admin');
    return { token: newSession('admin'), role: 'admin' };
  });

  route('POST', '/api/login/customer', null, ({ body }) => {
    const phone = String(body.phone || '').replace(/\D/g, '');
    if (!phone) throw bad('Please enter your mobile number');
    const key = `c:${phone}`;
    guardLogin(key);
    // Match on the last 10 digits so "+91 98xxx" and "98xxx" both work.
    const p = db.prepare("SELECT id, pin_hash FROM parties WHERE pin_hash IS NOT NULL AND active = 1 AND substr(REPLACE(phone,'+',''), -10) = substr(?, -10)").get(phone);
    if (!p || !checkSecret(String(body.pin || ''), p.pin_hash)) {
      loginFailed(key);
      throw new HttpError(401, 'Mobile number or PIN is wrong. Ask the dairy to set your PIN.');
    }
    failures.delete(key);
    return { token: newSession('customer', p.id), role: 'customer' };
  });

  route('POST', '/api/logout', 'any', ({ session }) => {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(session.token);
    return { ok: true };
  });

  // ----- customer portal (read only, own data) -----

  route('GET', '/api/portal', 'customer', ({ session, query }) => {
    const { from, to } = rangeOf(query);
    const l = D.ledger(db, session.party_id, from, to);
    if (!l) throw new HttpError(404, 'Account not found');
    const s = D.getSettings(db);
    const { pin_hash, note, ...party } = l.party;
    return { ...l, party, dairy: { name: s.dairy_name, phone: s.dairy_phone, address: s.dairy_address } };
  });

  // ----- dashboard & reports -----

  route('GET', '/api/dashboard', 'admin', ({ query }) => {
    const today = DATE_RE.test(query.get('today') || '') ? query.get('today') : new Date().toISOString().slice(0, 10);
    const monthStart = today.slice(0, 8) + '01';
    const todayMilk = db.prepare(`SELECT milk_type, shift, ROUND(SUM(qty),2) qty, ROUND(SUM(amount),2) amount, COUNT(*) n
      FROM milk_collections WHERE date = ? GROUP BY milk_type, shift`).all(today);
    const balances = D.partyBalances(db);
    const week = db.prepare(`SELECT date, milk_type, ROUND(SUM(qty),2) qty FROM milk_collections
      WHERE date > date(?, '-7 days') AND date <= ? GROUP BY date, milk_type ORDER BY date`).all(today, today);
    const lastPickup = db.prepare("SELECT date, ROUND(SUM(qty),2) qty FROM milk_sales WHERE buyer_type = 'company' GROUP BY date ORDER BY date DESC LIMIT 1").get() || null;
    return {
      today,
      today_milk: todayMilk,
      stock: D.milkStock(db),
      money: D.moneyPosition(db),
      to_receive: D.round2(balances.filter((b) => b.balance < 0).reduce((s, b) => s - b.balance, 0)),
      to_pay: D.round2(balances.filter((b) => b.balance > 0).reduce((s, b) => s + b.balance, 0)),
      month: D.report(db, monthStart, today),
      week,
      last_pickup: lastPickup,
      low_feed: D.feedStock(db).filter((i) => i.active && i.stock <= i.low_stock),
    };
  });

  route('GET', '/api/reports', 'admin', ({ query }) => {
    const { from, to } = rangeOf(query);
    if (!from || !to) throw bad('Please choose both dates');
    return { ...D.report(db, from, to), money_now: D.moneyPosition(db), stock: D.milkStock(db) };
  });

  // ----- parties (customers / farmers / company / suppliers) -----

  route('GET', '/api/parties', 'admin', () => D.partyBalances(db));

  const partyFields = (body) => {
    const name = text(body.name, 80);
    if (!name) throw bad('Please enter the name');
    const phone = text(body.phone, 20);
    return {
      code: text(body.code, 20),
      name,
      phone: phone ? phone.replace(/[^\d+]/g, '') : null,
      village: text(body.village, 80),
      kind: oneOf(body.kind || 'farmer', ['farmer', 'buyer', 'company', 'feed', 'supplier'], 'a type'),
      opening_balance: num(body.opening_balance || 0, 'opening balance', { min: -1e12, allowZero: true }),
      note: text(body.note, 300),
      active: body.active === false || body.active === 0 ? 0 : 1,
    };
  };
  const pinOf = (body) => {
    if (body.pin == null || body.pin === '') return undefined;
    if (!/^\d{4,6}$/.test(String(body.pin))) throw bad('PIN must be 4 to 6 digits');
    return hashSecret(body.pin);
  };
  const uniquePhone = (fn) => {
    try { return fn(); } catch (e) {
      if (String(e.message).includes('UNIQUE')) throw bad('This mobile number is already used by another person');
      throw e;
    }
  };

  route('POST', '/api/parties', 'admin', ({ body }) => {
    const f = partyFields(body);
    const pin = pinOf(body);
    return uniquePhone(() => {
      const r = db.prepare(`INSERT INTO parties (code, name, phone, village, kind, opening_balance, note, active, pin_hash)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(f.code, f.name, f.phone, f.village, f.kind, f.opening_balance, f.note, f.active, pin || null);
      return D.partyBalance(db, Number(r.lastInsertRowid));
    });
  });

  route('PUT', '/api/parties/:id', 'admin', ({ params, body }) => {
    partyExists(params.id);
    const f = partyFields(body);
    const pin = pinOf(body);
    return uniquePhone(() => {
      db.prepare(`UPDATE parties SET code=?, name=?, phone=?, village=?, kind=?, opening_balance=?, note=?, active=? WHERE id=?`)
        .run(f.code, f.name, f.phone, f.village, f.kind, f.opening_balance, f.note, f.active, params.id);
      if (pin) db.prepare('UPDATE parties SET pin_hash = ? WHERE id = ?').run(pin, params.id);
      if (body.remove_pin) {
        db.prepare('UPDATE parties SET pin_hash = NULL WHERE id = ?').run(params.id);
        db.prepare("DELETE FROM sessions WHERE role = 'customer' AND party_id = ?").run(params.id);
      }
      return D.partyBalance(db, params.id);
    });
  });

  route('GET', '/api/parties/:id/ledger', 'admin', ({ params, query }) => {
    const { from, to } = rangeOf(query);
    const l = D.ledger(db, params.id, from, to);
    if (!l) throw new HttpError(404, 'Customer not found');
    return l;
  });

  // ----- milk collection (buying from farmers) -----

  route('GET', '/api/milk/collections', 'admin', listRange(
    `SELECT x.*, p.name AS party_name, p.code AS party_code FROM milk_collections x JOIN parties p ON p.id = x.party_id`,
    "x.date DESC, x.shift DESC, x.id DESC"));

  route('POST', '/api/milk/collections', 'admin', ({ body }) => {
    const qty = num(body.qty, 'quantity (litres)');
    const rate = num(body.rate, 'rate');
    const v = [
      date(body.date), oneOf(body.shift, ['morning', 'evening'], 'morning or evening'),
      requireParty(body.party_id), oneOf(body.milk_type, ['cow', 'buffalo'], 'cow or buffalo'),
      qty, num(body.fat, 'fat', { optional: true }), num(body.snf, 'SNF', { optional: true }), rate, D.round2(qty * rate),
    ];
    const r = db.prepare(`INSERT INTO milk_collections (date, shift, party_id, milk_type, qty, fat, snf, rate, amount)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(...v);
    return db.prepare('SELECT * FROM milk_collections WHERE id = ?').get(r.lastInsertRowid);
  });
  route('DELETE', '/api/milk/collections/:id', 'admin', del('milk_collections'));

  // Save many entries at once (used after reading a photo). All or nothing.
  route('POST', '/api/milk/collections/bulk', 'admin', ({ body }) => {
    const d = date(body.date);
    const shift = oneOf(body.shift, ['morning', 'evening'], 'morning or evening');
    if (!Array.isArray(body.rows) || !body.rows.length) throw bad('Nothing to save');
    if (body.rows.length > 500) throw bad('Too many lines at once');
    const rows = body.rows.map((r, i) => {
      try {
        const q = num(r.qty, 'quantity (litres)');
        const rate = num(r.rate, 'rate');
        return [d, shift, requireParty(r.party_id), oneOf(r.milk_type, ['cow', 'buffalo'], 'cow or buffalo'),
          q, num(r.fat, 'fat', { optional: true }) || null, num(r.snf, 'SNF', { optional: true }) || null, rate, D.round2(q * rate)];
      } catch (e) {
        throw bad(`Line ${i + 1}: ${e.message}`);
      }
    });
    const ins = db.prepare(`INSERT INTO milk_collections (date, shift, party_id, milk_type, qty, fat, snf, rate, amount)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    db.exec('BEGIN');
    try {
      for (const v of rows) ins.run(...v);
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
    return { saved: rows.length };
  });

  // Read a photo of a milk sheet / receipt and match each line to a farmer.
  route('POST', '/api/milk/scan', 'admin', async ({ body }) => {
    if (!scanner.enabled()) throw new HttpError(503, 'Photo reading is not set up. Add ANTHROPIC_API_KEY to the server settings.');
    const mediaType = oneOf(body.media_type, ['image/jpeg', 'image/png', 'image/webp', 'image/gif'], 'a photo');
    const image = String(body.image || '');
    if (!image || !/^[A-Za-z0-9+/=]+$/.test(image)) throw bad('Please choose a photo');
    const parties = db.prepare("SELECT id, code, name, village, kind FROM parties WHERE active = 1").all();
    let result;
    try {
      result = await scanner.readMilkSheet({ imageBase64: image, mediaType, farmers: parties.filter((p) => p.kind === 'farmer') });
    } catch (e) {
      throw scanError(e);
    }
    const norm = (x) => String(x || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const normCode = (x) => norm(x).replace(/^0+(?=\d)/, '');
    const match = (row) => {
      const code = normCode(row.code);
      if (code) {
        const byCode = parties.filter((p) => normCode(p.code) === code);
        if (byCode.length === 1) return { party_id: byCode[0].id, match: 'code' };
      }
      const name = norm(row.name);
      if (name) {
        const exact = parties.filter((p) => norm(p.name) === name);
        if (exact.length === 1) return { party_id: exact[0].id, match: 'name' };
        const part = parties.filter((p) => norm(p.name).includes(name) || name.includes(norm(p.name)));
        if (part.length === 1) return { party_id: part[0].id, match: 'name' };
      }
      return { party_id: null, match: null };
    };
    return {
      date: DATE_RE.test(result.date_written || '') ? result.date_written : null,
      shift: ['morning', 'evening'].includes(result.shift_written) ? result.shift_written : null,
      rows: (result.rows || []).filter((r) => Number(r.qty) > 0).map((r) => ({ ...r, ...match(r) })),
    };
  });

  // ----- milk going out (company pickup, local sale, wastage) -----

  route('GET', '/api/milk/sales', 'admin', listRange(
    `SELECT x.*, p.name AS party_name FROM milk_sales x LEFT JOIN parties p ON p.id = x.party_id`,
    'x.date DESC, x.id DESC'));

  route('POST', '/api/milk/sales', 'admin', ({ body }) => {
    const buyerType = oneOf(body.buyer_type, ['company', 'local', 'wastage'], 'who the milk went to');
    const qty = num(body.qty, 'quantity (litres)');
    const isWaste = buyerType === 'wastage';
    const rate = isWaste ? 0 : num(body.rate, 'rate');
    const mode = isWaste ? 'cash' : oneOf(body.mode, ['cash', 'online', 'credit'], 'payment mode');
    const partyId = isWaste ? null : partyExists(body.party_id || null);
    if (mode === 'credit' && !partyId) throw bad('For credit (udhaar), please choose the buyer from the list');
    const r = db.prepare(`INSERT INTO milk_sales (date, buyer_type, party_id, buyer_name, milk_type, qty, fat, rate, amount, mode, vehicle, note)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      date(body.date), buyerType, partyId, text(body.buyer_name, 80),
      oneOf(body.milk_type, ['cow', 'buffalo'], 'cow or buffalo'), qty,
      num(body.fat, 'fat', { optional: true }), rate, D.round2(qty * rate), mode, text(body.vehicle, 40), text(body.note, 300));
    return db.prepare('SELECT * FROM milk_sales WHERE id = ?').get(r.lastInsertRowid);
  });
  route('DELETE', '/api/milk/sales/:id', 'admin', del('milk_sales'));

  // ----- feed -----

  route('GET', '/api/feed/items', 'admin', () => D.feedStock(db));

  const itemFields = (body) => {
    const name = text(body.name, 80);
    if (!name) throw bad('Please enter the feed name');
    return [
      name, text(body.unit, 20) || 'bag',
      num(body.purchase_price || 0, 'purchase price', { allowZero: true }),
      num(body.sale_price || 0, 'sale price', { allowZero: true }),
      num(body.opening_stock || 0, 'opening stock', { allowZero: true, min: -1e9 }),
      num(body.low_stock ?? 5, 'low stock alert', { allowZero: true }),
      body.active === false || body.active === 0 ? 0 : 1,
    ];
  };
  route('POST', '/api/feed/items', 'admin', ({ body }) => {
    const r = db.prepare(`INSERT INTO feed_items (name, unit, purchase_price, sale_price, opening_stock, low_stock, active)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).run(...itemFields(body));
    return { id: Number(r.lastInsertRowid) };
  });
  route('PUT', '/api/feed/items/:id', 'admin', ({ params, body }) => {
    const r = db.prepare(`UPDATE feed_items SET name=?, unit=?, purchase_price=?, sale_price=?, opening_stock=?, low_stock=?, active=? WHERE id=?`)
      .run(...itemFields(body), params.id);
    if (!r.changes) throw new HttpError(404, 'Feed item not found');
    return { ok: true };
  });

  const feedItem = (id) => {
    const i = db.prepare('SELECT * FROM feed_items WHERE id = ?').get(Number(id));
    if (!i) throw bad('Please choose the feed item');
    return i;
  };

  route('GET', '/api/feed/purchases', 'admin', listRange(
    `SELECT x.*, i.name AS item, i.unit, p.name AS party_name FROM feed_purchases x
     JOIN feed_items i ON i.id = x.item_id LEFT JOIN parties p ON p.id = x.party_id`, 'x.date DESC, x.id DESC'));

  route('POST', '/api/feed/purchases', 'admin', ({ body }) => {
    const item = feedItem(body.item_id);
    const qty = num(body.qty, 'quantity');
    const rate = num(body.rate, 'rate');
    const mode = oneOf(body.mode, ['cash', 'online', 'account'], 'payment mode');
    const partyId = partyExists(body.party_id || null);
    if (mode === 'account' && !partyId) throw bad('To buy on account, please choose the supplier');
    const r = db.prepare(`INSERT INTO feed_purchases (date, item_id, party_id, supplier, qty, rate, amount, mode, note)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(date(body.date), item.id, partyId, text(body.supplier, 80),
      qty, rate, D.round2(qty * rate), mode, text(body.note, 300));
    // Latest bulk price becomes the cost used for feed profit.
    db.prepare('UPDATE feed_items SET purchase_price = ? WHERE id = ?').run(rate, item.id);
    return { id: Number(r.lastInsertRowid) };
  });
  route('DELETE', '/api/feed/purchases/:id', 'admin', del('feed_purchases'));

  route('GET', '/api/feed/sales', 'admin', listRange(
    `SELECT x.*, i.name AS item, i.unit, p.name AS party_name FROM feed_sales x
     JOIN feed_items i ON i.id = x.item_id LEFT JOIN parties p ON p.id = x.party_id`, 'x.date DESC, x.id DESC'));

  route('POST', '/api/feed/sales', 'admin', ({ body }) => {
    const item = feedItem(body.item_id);
    const qty = num(body.qty, 'quantity');
    const rate = num(body.rate, 'rate');
    const mode = oneOf(body.mode, ['cash', 'online', 'account'], 'payment mode');
    const partyId = partyExists(body.party_id || null);
    if (mode === 'account' && !partyId) throw bad('To add to account (cut from milk money), please choose the customer');
    const r = db.prepare(`INSERT INTO feed_sales (date, item_id, party_id, buyer_name, qty, rate, amount, cost_rate, mode, note)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(date(body.date), item.id, partyId, text(body.buyer_name, 80),
      qty, rate, D.round2(qty * rate), item.purchase_price, mode, text(body.note, 300));
    return { id: Number(r.lastInsertRowid) };
  });
  route('DELETE', '/api/feed/sales/:id', 'admin', del('feed_sales'));

  // ----- payments -----

  route('GET', '/api/payments', 'admin', listRange(
    `SELECT x.*, p.name AS party_name, p.kind AS party_kind FROM payments x JOIN parties p ON p.id = x.party_id`,
    'x.date DESC, x.id DESC'));

  route('POST', '/api/payments', 'admin', ({ body }) => {
    const r = db.prepare(`INSERT INTO payments (date, party_id, direction, amount, mode, note) VALUES (?, ?, ?, ?, ?, ?)`).run(
      date(body.date), requireParty(body.party_id), oneOf(body.direction, ['in', 'out'], 'paid or received'),
      num(body.amount, 'amount'), oneOf(body.mode, ['cash', 'online'], 'cash or online'), text(body.note, 300));
    return { id: Number(r.lastInsertRowid) };
  });
  route('DELETE', '/api/payments/:id', 'admin', del('payments'));

  // ----- expenses -----

  route('GET', '/api/expenses', 'admin', ({ query }) => {
    const { from, to } = rangeOf(query);
    const kind = query.get('kind');
    const where = [];
    const args = [];
    if (from) { where.push('date >= ?'); args.push(from); }
    if (to) { where.push('date <= ?'); args.push(to); }
    if (kind === 'house' || kind === 'business') { where.push('kind = ?'); args.push(kind); }
    return db.prepare(`SELECT * FROM expenses ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY date DESC, id DESC LIMIT 2000`).all(...args);
  });

  route('POST', '/api/expenses', 'admin', ({ body }) => {
    const category = text(body.category, 60);
    if (!category) throw bad('Please choose what the money was spent on');
    const r = db.prepare('INSERT INTO expenses (date, kind, category, amount, mode, note) VALUES (?, ?, ?, ?, ?, ?)').run(
      date(body.date), oneOf(body.kind, ['house', 'business'], 'house or business'), category,
      num(body.amount, 'amount'), oneOf(body.mode, ['cash', 'online'], 'cash or online'), text(body.note, 300));
    return { id: Number(r.lastInsertRowid) };
  });
  route('DELETE', '/api/expenses/:id', 'admin', del('expenses'));

  // ----- settings & backup -----

  const PUBLIC_SETTINGS = ['dairy_name', 'dairy_phone', 'dairy_address', 'cow_rate_mode', 'cow_rate',
    'buffalo_rate_mode', 'buffalo_rate', 'cow_sale_rate', 'buffalo_sale_rate', 'opening_cash', 'opening_bank',
    'opening_stock_cow', 'opening_stock_buffalo'];

  route('GET', '/api/settings', 'admin', () => {
    const s = D.getSettings(db);
    return Object.fromEntries(PUBLIC_SETTINGS.map((k) => [k, s[k]]));
  });

  route('PUT', '/api/settings', 'admin', ({ body }) => {
    for (const k of PUBLIC_SETTINGS) {
      if (!(k in body)) continue;
      let v = body[k];
      if (k.endsWith('_mode')) v = oneOf(v, ['liter', 'fat'], 'rate type');
      else if (/rate|opening/.test(k)) v = String(num(v || 0, k.replace(/_/g, ' '), { allowZero: true, min: -1e12 }));
      else v = text(v, 200) || '';
      if (k === 'dairy_name' && !v) throw bad('Please enter the dairy name');
      D.setSetting(db, k, v);
    }
    return { ok: true };
  });

  route('PUT', '/api/settings/password', 'admin', ({ body, session }) => {
    const s = D.getSettings(db);
    if (!checkSecret(String(body.old_password || ''), s.admin_pass_hash)) throw bad('Current password is wrong');
    if (String(body.new_password || '').length < 4) throw bad('New password must be at least 4 characters');
    D.setSetting(db, 'admin_pass_hash', hashSecret(body.new_password));
    db.prepare("DELETE FROM sessions WHERE role = 'admin' AND token <> ?").run(session.token);
    return { ok: true };
  });

  route('GET', '/api/backup', 'admin', () => {
    const tables = ['settings', 'parties', 'milk_collections', 'milk_sales', 'feed_items', 'feed_purchases', 'feed_sales', 'payments', 'expenses'];
    const out = { exported_at: new Date().toISOString() };
    for (const t of tables) out[t] = db.prepare(`SELECT * FROM ${t}`).all();
    out.settings = out.settings.filter((r) => r.key !== 'admin_pass_hash');
    out.parties = out.parties.map(({ pin_hash, ...p }) => p);
    return out;
  });

  // ---------- request handling ----------

  const getSession = (req) => {
    const m = /^Bearer\s+(\w+)$/.exec(req.headers.authorization || '');
    if (!m) return null;
    const s = db.prepare(`SELECT * FROM sessions WHERE token = ? AND created_at > datetime('now', ?)`).get(m[1], `-${SESSION_DAYS} days`);
    return s || null;
  };

  const readBody = (req, limit) => new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new HttpError(413, 'Request too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')) || {}); } catch { reject(bad('Invalid JSON')); }
    });
    req.on('error', reject);
  });

  const send = (res, status, data) => {
    const body = JSON.stringify(data);
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(body);
  };

  async function handleApi(req, res, url) {
    const r = routes.find((x) => x.method === req.method && x.re.test(url.pathname));
    if (!r) {
      const exists = routes.some((x) => x.re.test(url.pathname));
      throw new HttpError(exists ? 405 : 404, 'Not found');
    }
    const m = r.re.exec(url.pathname);
    const params = Object.fromEntries(r.keys.map((k, i) => [k, Number(m[i + 1])]));
    let session = null;
    if (r.role) {
      session = getSession(req);
      if (!session) throw new HttpError(401, 'Please log in again');
      if (r.role !== 'any' && session.role !== r.role) throw new HttpError(403, 'Not allowed');
    }
    const limit = url.pathname === '/api/milk/scan' ? 15e6 : 1e6;
    const body = ['POST', 'PUT'].includes(req.method) ? await readBody(req, limit) : {};
    if (typeof body !== 'object' || Array.isArray(body)) throw bad('Invalid request');
    const result = await r.handler({ params, query: url.searchParams, body, session, req });
    send(res, 200, result);
  }

  const TYPES = {
    '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
    '.ico': 'image/x-icon',
  };

  function serveStatic(req, res, url) {
    let rel = decodeURIComponent(url.pathname);
    if (rel === '/' || !path.extname(rel)) rel = '/index.html';
    const file = path.normalize(path.join(PUBLIC_DIR, rel));
    if (!file.startsWith(PUBLIC_DIR + path.sep)) { res.writeHead(403); return res.end(); }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
      res.writeHead(200, {
        'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff',
      });
      res.end(data);
    });
  }

  return async function handler(req, res) {
    const url = new URL(req.url, 'http://localhost');
    try {
      if (url.pathname.startsWith('/api/')) await handleApi(req, res, url);
      else if (req.method === 'GET' || req.method === 'HEAD') serveStatic(req, res, url);
      else throw new HttpError(405, 'Method not allowed');
    } catch (e) {
      const status = e.status || 500;
      if (status === 500) console.error(e);
      if (!res.headersSent) send(res, status, { error: status === 500 ? 'Something went wrong. Please try again.' : e.message });
    }
  };
}

function start() {
  const dbFile = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'dairy.db');
  const db = D.open(dbFile);
  // On a public server, set ADMIN_PASSWORD so nobody else can claim the
  // first-time setup page before the owner does.
  const initial = process.env.ADMIN_PASSWORD;
  if (initial && !D.getSettings(db).admin_pass_hash) {
    D.setSetting(db, 'admin_pass_hash', hashSecret(initial));
    if (process.env.DAIRY_NAME) D.setSetting(db, 'dairy_name', process.env.DAIRY_NAME);
    console.log('Owner password set from ADMIN_PASSWORD.');
  }
  const port = Number(process.env.PORT) || 3000;
  http.createServer(createApp(db)).listen(port, () => {
    console.log(`Milk dairy app running on http://localhost:${port}  (data: ${dbFile})`);
  });
}

if (require.main === module) start();

module.exports = { createApp };
