'use strict';
// Database layer: schema, settings, balances, ledgers and reports.
// Uses Node's built-in SQLite (Node 22.13+), so no packages need installing.

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  role       TEXT NOT NULL CHECK (role IN ('admin','customer')),
  party_id   INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Everyone the dairy deals with: farmers who sell milk, local milk buyers,
-- the milk company, feed-only customers and feed suppliers.
CREATE TABLE IF NOT EXISTS parties (
  id              INTEGER PRIMARY KEY,
  code            TEXT,
  name            TEXT NOT NULL,
  phone           TEXT,
  village         TEXT,
  kind            TEXT NOT NULL DEFAULT 'farmer'
                  CHECK (kind IN ('farmer','buyer','company','feed','supplier')),
  pin_hash        TEXT,
  opening_balance REAL NOT NULL DEFAULT 0, -- + dairy owes them, - they owe dairy
  note            TEXT,
  active          INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS parties_phone ON parties(phone) WHERE phone IS NOT NULL AND phone <> '';

-- Milk bought from farmers.
CREATE TABLE IF NOT EXISTS milk_collections (
  id         INTEGER PRIMARY KEY,
  date       TEXT NOT NULL,
  shift      TEXT NOT NULL CHECK (shift IN ('morning','evening')),
  party_id   INTEGER NOT NULL REFERENCES parties(id),
  milk_type  TEXT NOT NULL CHECK (milk_type IN ('cow','buffalo')),
  qty        REAL NOT NULL,
  fat        REAL,
  snf        REAL,
  rate       REAL NOT NULL,
  amount     REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS mc_date ON milk_collections(date);
CREATE INDEX IF NOT EXISTS mc_party ON milk_collections(party_id);

-- Milk going out of cold storage: company van pickups, local sales,
-- and wastage / home use (rate 0) to keep the stock figure honest.
CREATE TABLE IF NOT EXISTS milk_sales (
  id         INTEGER PRIMARY KEY,
  date       TEXT NOT NULL,
  buyer_type TEXT NOT NULL CHECK (buyer_type IN ('company','local','wastage')),
  party_id   INTEGER REFERENCES parties(id),
  buyer_name TEXT,
  milk_type  TEXT NOT NULL CHECK (milk_type IN ('cow','buffalo')),
  qty        REAL NOT NULL,
  fat        REAL,
  rate       REAL NOT NULL DEFAULT 0,
  amount     REAL NOT NULL DEFAULT 0,
  mode       TEXT NOT NULL CHECK (mode IN ('cash','online','credit')),
  vehicle    TEXT,
  note       TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS ms_date ON milk_sales(date);

CREATE TABLE IF NOT EXISTS feed_items (
  id             INTEGER PRIMARY KEY,
  name           TEXT NOT NULL,
  unit           TEXT NOT NULL DEFAULT 'bag',
  purchase_price REAL NOT NULL DEFAULT 0,
  sale_price     REAL NOT NULL DEFAULT 0,
  opening_stock  REAL NOT NULL DEFAULT 0,
  low_stock      REAL NOT NULL DEFAULT 5,
  active         INTEGER NOT NULL DEFAULT 1
);

-- Bulk feed stock coming in.
CREATE TABLE IF NOT EXISTS feed_purchases (
  id         INTEGER PRIMARY KEY,
  date       TEXT NOT NULL,
  item_id    INTEGER NOT NULL REFERENCES feed_items(id),
  party_id   INTEGER REFERENCES parties(id), -- supplier (needed for 'account')
  supplier   TEXT,
  qty        REAL NOT NULL,
  rate       REAL NOT NULL,
  amount     REAL NOT NULL,
  mode       TEXT NOT NULL CHECK (mode IN ('cash','online','account')),
  note       TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Feed sold. 'account' = added to the customer's khata and cut from milk money.
CREATE TABLE IF NOT EXISTS feed_sales (
  id         INTEGER PRIMARY KEY,
  date       TEXT NOT NULL,
  item_id    INTEGER NOT NULL REFERENCES feed_items(id),
  party_id   INTEGER REFERENCES parties(id),
  buyer_name TEXT,
  qty        REAL NOT NULL,
  rate       REAL NOT NULL,
  amount     REAL NOT NULL,
  cost_rate  REAL NOT NULL DEFAULT 0,
  mode       TEXT NOT NULL CHECK (mode IN ('cash','online','account')),
  note       TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS fs_party ON feed_sales(party_id);

-- Money moving between the dairy and a party.
-- out = dairy paid them (e.g. milk bill), in = they paid the dairy.
CREATE TABLE IF NOT EXISTS payments (
  id         INTEGER PRIMARY KEY,
  date       TEXT NOT NULL,
  party_id   INTEGER NOT NULL REFERENCES parties(id),
  direction  TEXT NOT NULL CHECK (direction IN ('in','out')),
  amount     REAL NOT NULL,
  mode       TEXT NOT NULL CHECK (mode IN ('cash','online')),
  note       TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS pay_party ON payments(party_id);

CREATE TABLE IF NOT EXISTS expenses (
  id         INTEGER PRIMARY KEY,
  date       TEXT NOT NULL,
  kind       TEXT NOT NULL CHECK (kind IN ('house','business')),
  category   TEXT NOT NULL,
  amount     REAL NOT NULL,
  mode       TEXT NOT NULL CHECK (mode IN ('cash','online')),
  note       TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS exp_date ON expenses(date);
`;

const DEFAULT_SETTINGS = {
  dairy_name: 'My Milk Dairy',
  dairy_phone: '',
  dairy_address: '',
  // Purchase rate: 'liter' = fixed ₹ per litre, 'fat' = ₹ per fat point x fat.
  cow_rate_mode: 'liter',
  cow_rate: '35',
  buffalo_rate_mode: 'fat',
  buffalo_rate: '7.5',
  cow_sale_rate: '45',
  buffalo_sale_rate: '60',
  opening_cash: '0',
  opening_bank: '0',
  opening_stock_cow: '0',
  opening_stock_buffalo: '0',
};

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function open(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);
  const ins = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) ins.run(k, v);
  return db;
}

function getSettings(db) {
  const out = {};
  for (const r of db.prepare('SELECT key, value FROM settings').all()) out[r.key] = r.value;
  return out;
}

function setSetting(db, key, value) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, value == null ? null : String(value));
}

// Per-party running totals. credit = in the party's favour (dairy owes more),
// debit = against the party. balance > 0: dairy must pay; < 0: party must pay.
const BALANCE_SQL = `
SELECT p.id, p.code, p.name, p.phone, p.village, p.kind, p.active, p.note,
       p.opening_balance,
       (p.pin_hash IS NOT NULL) AS has_pin,
       ROUND(p.opening_balance
         + COALESCE((SELECT SUM(amount) FROM milk_collections WHERE party_id = p.id), 0)
         + COALESCE((SELECT SUM(amount) FROM payments WHERE party_id = p.id AND direction = 'in'), 0)
         + COALESCE((SELECT SUM(amount) FROM feed_purchases WHERE party_id = p.id AND mode = 'account'), 0)
         - COALESCE((SELECT SUM(amount) FROM milk_sales WHERE party_id = p.id AND mode = 'credit'), 0)
         - COALESCE((SELECT SUM(amount) FROM feed_sales WHERE party_id = p.id AND mode = 'account'), 0)
         - COALESCE((SELECT SUM(amount) FROM payments WHERE party_id = p.id AND direction = 'out'), 0)
       , 2) AS balance
FROM parties p`;

function partyBalances(db) {
  return db.prepare(`${BALANCE_SQL} ORDER BY p.active DESC, p.name COLLATE NOCASE`).all();
}

function partyBalance(db, id) {
  return db.prepare(`${BALANCE_SQL} WHERE p.id = ?`).get(id);
}

const MODE_LABEL = { cash: 'Cash', online: 'Online', credit: 'On credit', account: 'In account' };

// Every money event for one party, oldest first, with a running balance.
function ledger(db, partyId, from, to) {
  const party = partyBalance(db, partyId);
  if (!party) return null;
  const rows = [];
  const push = (date, kind, desc, credit, debit, sort, extra = {}) =>
    rows.push({ date, kind, desc, credit: round2(credit), debit: round2(debit), sort, ...extra });

  for (const r of db.prepare('SELECT * FROM milk_collections WHERE party_id = ?').all(partyId)) {
    const fat = r.fat ? `, fat ${r.fat}` : '';
    push(r.date, 'milk_in', `Milk given – ${r.milk_type}, ${r.shift} (${r.qty} L${fat} @ ₹${r.rate})`,
      r.amount, 0, r.shift === 'morning' ? 1 : 2,
      { qty: r.qty, fat: r.fat, rate: r.rate, milk_type: r.milk_type, shift: r.shift, mode: null });
  }
  for (const r of db.prepare('SELECT * FROM milk_sales WHERE party_id = ?').all(partyId)) {
    const paid = r.mode === 'credit' ? 0 : r.amount;
    push(r.date, 'milk_out', `Milk taken – ${r.milk_type} (${r.qty} L @ ₹${r.rate}) · ${MODE_LABEL[r.mode]}`,
      paid, r.amount, 3, { qty: r.qty, rate: r.rate, milk_type: r.milk_type, mode: r.mode });
  }
  for (const r of db.prepare('SELECT s.*, i.name AS item, i.unit FROM feed_sales s JOIN feed_items i ON i.id = s.item_id WHERE s.party_id = ?').all(partyId)) {
    const paid = r.mode === 'account' ? 0 : r.amount;
    push(r.date, 'feed', `Feed – ${r.item} (${r.qty} ${r.unit} @ ₹${r.rate}) · ${MODE_LABEL[r.mode]}`,
      paid, r.amount, 4, { qty: r.qty, rate: r.rate, item: r.item, unit: r.unit, mode: r.mode });
  }
  for (const r of db.prepare('SELECT p.*, i.name AS item, i.unit FROM feed_purchases p JOIN feed_items i ON i.id = p.item_id WHERE p.party_id = ?').all(partyId)) {
    const paid = r.mode === 'account' ? 0 : r.amount;
    push(r.date, 'feed_supply', `Feed supplied – ${r.item} (${r.qty} ${r.unit} @ ₹${r.rate}) · ${MODE_LABEL[r.mode]}`,
      r.amount, paid, 4, { qty: r.qty, rate: r.rate, item: r.item, unit: r.unit, mode: r.mode });
  }
  for (const r of db.prepare('SELECT * FROM payments WHERE party_id = ?').all(partyId)) {
    const note = r.note ? ` – ${r.note}` : '';
    if (r.direction === 'out') push(r.date, 'pay_out', `Paid by dairy (${MODE_LABEL[r.mode]})${note}`, 0, r.amount, 5, { mode: r.mode, note: r.note });
    else push(r.date, 'pay_in', `Received by dairy (${MODE_LABEL[r.mode]})${note}`, r.amount, 0, 5, { mode: r.mode, note: r.note });
  }
  rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.sort - b.sort));

  let bal = party.opening_balance;
  let opening = bal;
  const out = [];
  for (const r of rows) {
    bal = round2(bal + r.credit - r.debit);
    r.balance = bal;
    if (from && r.date < from) { opening = bal; continue; }
    if (to && r.date > to) continue;
    out.push(r);
  }
  const sum = (k) => round2(out.reduce((s, r) => s + r[k], 0));
  const milk = out.filter((r) => r.kind === 'milk_in');
  return {
    party,
    from: from || null,
    to: to || null,
    opening: round2(opening),
    closing: out.length ? out[out.length - 1].balance : round2(opening),
    total_credit: sum('credit'),
    total_debit: sum('debit'),
    milk_qty: round2(milk.reduce((s, r) => s + r.qty, 0)),
    milk_amount: round2(milk.reduce((s, r) => s + r.credit, 0)),
    feed_amount: round2(out.filter((r) => r.kind === 'feed').reduce((s, r) => s + r.debit, 0)),
    entries: out,
  };
}

function milkStock(db) {
  const s = getSettings(db);
  const res = {};
  for (const t of ['cow', 'buffalo']) {
    const inQ = db.prepare('SELECT COALESCE(SUM(qty),0) q FROM milk_collections WHERE milk_type = ?').get(t).q;
    const outQ = db.prepare('SELECT COALESCE(SUM(qty),0) q FROM milk_sales WHERE milk_type = ?').get(t).q;
    res[t] = round2(Number(s[`opening_stock_${t}`] || 0) + inQ - outQ);
  }
  return res;
}

function feedStock(db) {
  return db.prepare(`
    SELECT i.*,
      ROUND(i.opening_stock
        + COALESCE((SELECT SUM(qty) FROM feed_purchases WHERE item_id = i.id), 0)
        - COALESCE((SELECT SUM(qty) FROM feed_sales WHERE item_id = i.id), 0), 2) AS stock
    FROM feed_items i ORDER BY i.active DESC, i.name COLLATE NOCASE`).all();
}

// Where the money is: cash in hand vs bank/UPI, up to and including `upto`.
function moneyPosition(db, upto) {
  const s = getSettings(db);
  const cond = upto ? 'AND date <= ?' : '';
  const args = upto ? [upto] : [];
  const sum = (sql, ...a) => db.prepare(sql).get(...a, ...args).v || 0;
  const res = {};
  for (const mode of ['cash', 'online']) {
    const inflow =
      sum(`SELECT SUM(amount) v FROM milk_sales WHERE mode = ? ${cond}`, mode) +
      sum(`SELECT SUM(amount) v FROM feed_sales WHERE mode = ? ${cond}`, mode) +
      sum(`SELECT SUM(amount) v FROM payments WHERE direction = 'in' AND mode = ? ${cond}`, mode);
    const outflow =
      sum(`SELECT SUM(amount) v FROM feed_purchases WHERE mode = ? ${cond}`, mode) +
      sum(`SELECT SUM(amount) v FROM payments WHERE direction = 'out' AND mode = ? ${cond}`, mode) +
      sum(`SELECT SUM(amount) v FROM expenses WHERE mode = ? ${cond}`, mode);
    const opening = Number(mode === 'cash' ? s.opening_cash : s.opening_bank) || 0;
    res[mode] = round2(opening + inflow - outflow);
  }
  return res;
}

function report(db, from, to) {
  const one = (sql) => db.prepare(sql).get(from, to);
  const range = 'date BETWEEN ? AND ?';

  const milkBought = one(`SELECT COALESCE(SUM(qty),0) qty, COALESCE(SUM(amount),0) amount FROM milk_collections WHERE ${range}`);
  const milkSold = one(`SELECT COALESCE(SUM(qty),0) qty, COALESCE(SUM(amount),0) amount FROM milk_sales WHERE buyer_type <> 'wastage' AND ${range}`);
  const wastage = one(`SELECT COALESCE(SUM(qty),0) qty FROM milk_sales WHERE buyer_type = 'wastage' AND ${range}`);
  const feedSales = one(`SELECT COALESCE(SUM(amount),0) amount, COALESCE(SUM(qty*cost_rate),0) cost FROM feed_sales WHERE ${range}`);
  const feedBought = one(`SELECT COALESCE(SUM(amount),0) amount FROM feed_purchases WHERE ${range}`);
  const exp = db.prepare(`SELECT kind, category, mode, SUM(amount) amount FROM expenses WHERE ${range} GROUP BY kind, category, mode`).all(from, to);

  const byType = (table, extra = '') => db.prepare(
    `SELECT milk_type, COALESCE(SUM(qty),0) qty, COALESCE(SUM(amount),0) amount FROM ${table} WHERE ${range} ${extra} GROUP BY milk_type`).all(from, to);

  const businessExp = exp.filter((e) => e.kind === 'business').reduce((s, e) => s + e.amount, 0);
  const houseExp = exp.filter((e) => e.kind === 'house').reduce((s, e) => s + e.amount, 0);
  const milkMargin = milkSold.amount - milkBought.amount;
  const feedMargin = feedSales.amount - feedSales.cost;
  const profit = milkMargin + feedMargin - businessExp;

  const cats = {};
  for (const e of exp) {
    const key = `${e.kind}|${e.category}`;
    cats[key] = cats[key] || { kind: e.kind, category: e.category, amount: 0 };
    cats[key].amount += e.amount;
  }

  // Money in and out by mode for the period.
  const flows = {};
  for (const mode of ['cash', 'online']) {
    const v = (sql) => db.prepare(sql).get(mode, from, to).v || 0;
    flows[mode] = {
      milk_sales: round2(v(`SELECT SUM(amount) v FROM milk_sales WHERE mode = ? AND ${range}`)),
      feed_sales: round2(v(`SELECT SUM(amount) v FROM feed_sales WHERE mode = ? AND ${range}`)),
      received: round2(v(`SELECT SUM(amount) v FROM payments WHERE direction = 'in' AND mode = ? AND ${range}`)),
      paid: round2(v(`SELECT SUM(amount) v FROM payments WHERE direction = 'out' AND mode = ? AND ${range}`)),
      feed_purchases: round2(v(`SELECT SUM(amount) v FROM feed_purchases WHERE mode = ? AND ${range}`)),
      business_exp: round2(v(`SELECT SUM(amount) v FROM expenses WHERE kind = 'business' AND mode = ? AND ${range}`)),
      house_exp: round2(v(`SELECT SUM(amount) v FROM expenses WHERE kind = 'house' AND mode = ? AND ${range}`)),
    };
    const f = flows[mode];
    f.total_in = round2(f.milk_sales + f.feed_sales + f.received);
    f.total_out = round2(f.paid + f.feed_purchases + f.business_exp + f.house_exp);
  }

  const daily = db.prepare(`
    WITH d AS (
      SELECT date, amount AS bought, 0 AS sold, qty AS qty_in, 0 AS qty_out FROM milk_collections WHERE ${range}
      UNION ALL SELECT date, 0, amount, 0, qty FROM milk_sales WHERE ${range}
    )
    SELECT date, ROUND(SUM(qty_in),2) qty_in, ROUND(SUM(qty_out),2) qty_out,
           ROUND(SUM(bought),2) bought, ROUND(SUM(sold),2) sold
    FROM d GROUP BY date ORDER BY date`).all(from, to, from, to);

  const r = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, round2(v)]));
  return {
    from, to,
    milk_bought: r(milkBought),
    milk_sold: r(milkSold),
    milk_wastage: round2(wastage.qty),
    milk_bought_by_type: byType('milk_collections').map(r0),
    milk_sold_by_type: byType('milk_sales', "AND buyer_type <> 'wastage'").map(r0),
    milk_margin: round2(milkMargin),
    feed_sales: round2(feedSales.amount),
    feed_cost: round2(feedSales.cost),
    feed_margin: round2(feedMargin),
    feed_bought: round2(feedBought.amount),
    business_expenses: round2(businessExp),
    house_expenses: round2(houseExp),
    profit: round2(profit),
    savings: round2(profit - houseExp),
    expense_categories: Object.values(cats).map((c) => ({ ...c, amount: round2(c.amount) })).sort((a, b) => b.amount - a.amount),
    flows,
    daily,
  };
  function r0(x) { return { milk_type: x.milk_type, qty: round2(x.qty), amount: round2(x.amount) }; }
}

module.exports = {
  open, getSettings, setSetting, partyBalances, partyBalance, ledger,
  milkStock, feedStock, moneyPosition, report, round2,
};
