'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const D = require('../src/db');
const { createApp } = require('../src/server');

let server;
let base;
let admin;

async function call(method, path, body, token) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json() };
}
const ok = async (...a) => {
  const r = await call(...a);
  assert.equal(r.status, 200, JSON.stringify(r.data));
  return r.data;
};
const as = (m, p, b) => ok(m, p, b, admin);

test.before(async () => {
  server = http.createServer(createApp(D.open(':memory:')));
  await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => server.close());

test('setup, login and protection', async () => {
  assert.equal((await ok('GET', '/api/status')).setup_needed, true);
  assert.equal((await call('GET', '/api/parties')).status, 401);
  admin = (await ok('POST', '/api/setup', { password: 'secret1', dairy_name: 'Test Dairy' })).token;
  assert.equal((await call('POST', '/api/setup', { password: 'again' })).status, 403);
  assert.equal((await call('POST', '/api/login/admin', { password: 'nope' })).status, 401);
  assert.ok((await ok('POST', '/api/login/admin', { password: 'secret1' })).token);
  const st = await ok('GET', '/api/status');
  assert.equal(st.setup_needed, false);
  assert.equal(st.dairy_name, 'Test Dairy');
});

test('full day of dairy work adds up', async () => {
  await as('PUT', '/api/settings', { opening_cash: 1000, opening_bank: 500 });
  const farmer = await as('POST', '/api/parties', { name: 'Gurpreet', code: '7', phone: '98765 43210', kind: 'farmer', pin: '1234' });
  const company = await as('POST', '/api/parties', { name: 'Milkfed', kind: 'company' });
  const supplier = await as('POST', '/api/parties', { name: 'Feed Agency', kind: 'supplier' });
  assert.equal(farmer.has_pin, 1);

  // Milk bought: 10 L cow @35 + 5 L buffalo fat-based (fat 6 x 7.5 = 45)
  await as('POST', '/api/milk/collections', { date: '2026-10-01', shift: 'morning', party_id: farmer.id, milk_type: 'cow', qty: 10, rate: 35 });
  await as('POST', '/api/milk/collections', { date: '2026-10-01', shift: 'evening', party_id: farmer.id, milk_type: 'buffalo', qty: 5, fat: 6, rate: 45 });

  // Company van takes 8 L cow on credit, local cash sale 1 L cow, 0.5 L buffalo wasted
  await as('POST', '/api/milk/sales', { date: '2026-10-02', buyer_type: 'company', party_id: company.id, milk_type: 'cow', qty: 8, rate: 40, mode: 'credit' });
  await as('POST', '/api/milk/sales', { date: '2026-10-02', buyer_type: 'local', buyer_name: 'Neighbour', milk_type: 'cow', qty: 1, rate: 50, mode: 'cash' });
  await as('POST', '/api/milk/sales', { date: '2026-10-02', buyer_type: 'wastage', milk_type: 'buffalo', qty: 0.5 });
  const credNoParty = await call('POST', '/api/milk/sales', { date: '2026-10-02', buyer_type: 'local', milk_type: 'cow', qty: 1, rate: 50, mode: 'credit' }, admin);
  assert.equal(credNoParty.status, 400);

  // Feed: buy 10 bags on account from supplier @800, sell 2 to farmer on khata @900, 1 cash @900
  const item = await as('POST', '/api/feed/items', { name: 'Feed 50kg', unit: 'bag', sale_price: 900 });
  await as('POST', '/api/feed/purchases', { date: '2026-10-01', item_id: item.id, party_id: supplier.id, qty: 10, rate: 800, mode: 'account' });
  await as('POST', '/api/feed/sales', { date: '2026-10-02', item_id: item.id, party_id: farmer.id, qty: 2, rate: 900, mode: 'account' });
  await as('POST', '/api/feed/sales', { date: '2026-10-02', item_id: item.id, buyer_name: 'Walk-in', qty: 1, rate: 900, mode: 'cash' });

  // Payments: dairy pays farmer 200 online; company pays 100 online
  await as('POST', '/api/payments', { date: '2026-10-02', party_id: farmer.id, direction: 'out', amount: 200, mode: 'online' });
  await as('POST', '/api/payments', { date: '2026-10-02', party_id: company.id, direction: 'in', amount: 100, mode: 'online' });

  // Expenses
  await as('POST', '/api/expenses', { date: '2026-10-02', kind: 'house', category: 'Ration', amount: 300, mode: 'cash' });
  await as('POST', '/api/expenses', { date: '2026-10-02', kind: 'business', category: 'Diesel', amount: 50, mode: 'cash' });

  // Farmer: milk 350 + 225 = 575, feed -1800, paid -200 => -1425 (owes dairy)
  const l = await as('GET', `/api/parties/${farmer.id}/ledger`);
  assert.equal(l.milk_qty, 15);
  assert.equal(l.milk_amount, 575);
  assert.equal(l.feed_amount, 1800);
  assert.equal(l.closing, -1425);
  assert.equal(l.party.balance, -1425);

  const parties = await as('GET', '/api/parties');
  const bal = Object.fromEntries(parties.map((p) => [p.name, p.balance]));
  assert.equal(bal.Milkfed, -220); // 320 credit sale - 100 received
  assert.equal(bal['Feed Agency'], 8000); // dairy owes supplier

  const items = await as('GET', '/api/feed/items');
  assert.equal(items[0].stock, 7);
  assert.equal(items[0].purchase_price, 800);

  // Stock: cow 10-8-1 = 1, buffalo 5-0.5 = 4.5
  const dash = await as('GET', '/api/dashboard?today=2026-10-02');
  assert.deepEqual(dash.stock, { cow: 1, buffalo: 4.5 });
  // Cash: 1000 + 50 local milk + 900 feed - 300 - 50 = 1600 ; Online: 500 - 200 + 100 = 400
  assert.deepEqual(dash.money, { cash: 1600, online: 400 });
  assert.equal(dash.to_receive, 1645);
  assert.equal(dash.to_pay, 8000);

  const r = await as('GET', '/api/reports?from=2026-10-01&to=2026-10-31');
  assert.equal(r.milk_sold.amount, 370);
  assert.equal(r.milk_bought.amount, 575);
  assert.equal(r.milk_wastage, 0.5);
  assert.equal(r.feed_margin, 300); // 3 bags x (900-800)
  assert.equal(r.profit, 370 - 575 + 300 - 50);
  assert.equal(r.savings, r.profit - 300);

  // Ledger with date range carries opening balance
  const l2 = await as('GET', `/api/parties/${farmer.id}/ledger?from=2026-10-02&to=2026-10-02`);
  assert.equal(l2.opening, 575);
  assert.equal(l2.closing, -1425);
});

test('customer portal only shows own data', async () => {
  assert.equal((await call('POST', '/api/login/customer', { phone: '9876543210', pin: '0000' })).status, 401);
  const c = await ok('POST', '/api/login/customer', { phone: '+91 98765-43210', pin: '1234' });
  const p = await ok('GET', '/api/portal', null, c.token);
  assert.equal(p.party.name, 'Gurpreet');
  assert.equal(p.party.balance, -1425);
  assert.equal(p.party.pin_hash, undefined);
  assert.equal((await call('GET', '/api/parties', null, c.token)).status, 403);
  assert.equal((await call('GET', '/api/parties/1/ledger', null, c.token)).status, 403);
  await ok('POST', '/api/logout', null, c.token);
  assert.equal((await call('GET', '/api/portal', null, c.token)).status, 401);
});

test('validation and delete', async () => {
  const bad = await call('POST', '/api/milk/collections', { date: '2026-10-02', shift: 'morning', party_id: 1, milk_type: 'cow', qty: -1, rate: 35 }, admin);
  assert.equal(bad.status, 400);
  const noParty = await call('POST', '/api/payments', { date: '2026-10-02', direction: 'out', amount: 5, mode: 'cash' }, admin);
  assert.equal(noParty.status, 400);
  assert.match(noParty.data.error, /choose the person/);
  const e = await as('POST', '/api/expenses', { date: '2026-10-03', kind: 'house', category: 'X', amount: 1, mode: 'cash' });
  await as('DELETE', `/api/expenses/${e.id}`);
  assert.equal((await call('DELETE', `/api/expenses/${e.id}`, null, admin)).status, 404);
  const dup = await call('POST', '/api/parties', { name: 'Other', phone: '9876543210' }, admin);
  assert.equal(dup.status, 400);
});

test('static files and path traversal', async () => {
  const res = await fetch(base + '/');
  assert.equal(res.status, 200);
  assert.match(await res.text(), /<div id="app">/);
  const t = await fetch(base + '/..%2fsrc%2fserver.js');
  assert.notEqual(t.status, 200);
});

test('owner can edit entries and balances follow', async () => {
  const f = await as('POST', '/api/parties', { name: 'Edit Farmer', kind: 'farmer' });
  const other = await as('POST', '/api/parties', { name: 'Other Farmer', kind: 'farmer' });

  // Milk entry: fix litres and move it to the right farmer.
  const m = await as('POST', '/api/milk/collections', { date: '2026-10-05', shift: 'morning', party_id: f.id, milk_type: 'cow', qty: 10, rate: 35 });
  const m2 = await as('PUT', `/api/milk/collections/${m.id}`, { date: '2026-10-05', shift: 'evening', party_id: other.id, milk_type: 'buffalo', qty: 8, fat: 6.5, rate: 48.75 });
  assert.equal(m2.id, m.id);
  assert.equal(m2.amount, 390);
  assert.equal(m2.shift, 'evening');
  assert.equal((await as('GET', `/api/parties/${f.id}/ledger`)).party.balance, 0);
  assert.equal((await as('GET', `/api/parties/${other.id}/ledger`)).party.balance, 390);

  // Edits are validated like new entries; unknown ids are 404.
  const bad = await call('PUT', `/api/milk/collections/${m.id}`, { date: '2026-10-05', shift: 'evening', party_id: other.id, milk_type: 'cow', qty: 0, rate: 35 }, admin);
  assert.equal(bad.status, 400);
  assert.equal((await call('PUT', '/api/milk/collections/999999', { date: '2026-10-05', shift: 'evening', party_id: other.id, milk_type: 'cow', qty: 1, rate: 35 }, admin)).status, 404);

  // Feed sale keeps the cost it was sold at when only the quantity changes.
  const item = await as('POST', '/api/feed/items', { name: 'Khal', unit: 'bag', purchase_price: 500, sale_price: 600 });
  const s = await as('POST', '/api/feed/sales', { date: '2026-10-05', item_id: item.id, party_id: other.id, qty: 1, rate: 600, mode: 'account' });
  await as('PUT', `/api/feed/items/${item.id}`, { name: 'Khal', unit: 'bag', purchase_price: 550, sale_price: 600 });
  const s2 = await as('PUT', `/api/feed/sales/${s.id}`, { date: '2026-10-05', item_id: item.id, party_id: other.id, qty: 2, rate: 600, mode: 'account' });
  assert.equal(s2.cost_rate, 500);
  assert.equal(s2.amount, 1200);
  assert.equal((await as('GET', `/api/parties/${other.id}/ledger`)).party.balance, 390 - 1200);

  // Editing a purchase's rate updates the item's cost price.
  const pu = await as('POST', '/api/feed/purchases', { date: '2026-10-05', item_id: item.id, qty: 10, rate: 520, mode: 'cash' });
  await as('PUT', `/api/feed/purchases/${pu.id}`, { date: '2026-10-05', item_id: item.id, qty: 10, rate: 510, mode: 'cash' });
  assert.equal((await as('GET', '/api/feed/items')).find((i) => i.id === item.id).purchase_price, 510);

  // Payment and expense edits.
  const p = await as('POST', '/api/payments', { date: '2026-10-05', party_id: other.id, direction: 'in', amount: 100, mode: 'cash' });
  const p2 = await as('PUT', `/api/payments/${p.id}`, { date: '2026-10-05', party_id: other.id, direction: 'in', amount: 810, mode: 'online', note: 'fixed' });
  assert.equal(p2.mode, 'online');
  assert.equal((await as('GET', `/api/parties/${other.id}/ledger`)).party.balance, 0);
  const e = await as('POST', '/api/expenses', { date: '2026-10-05', kind: 'house', category: 'Gas', amount: 900, mode: 'cash' });
  const e2 = await as('PUT', `/api/expenses/${e.id}`, { date: '2026-10-05', kind: 'business', category: 'Repair', amount: 950, mode: 'cash' });
  assert.deepEqual([e2.kind, e2.category, e2.amount], ['business', 'Repair', 950]);

  // Milk-out entry edit: wastage clears money fields.
  const o = await as('POST', '/api/milk/sales', { date: '2026-10-05', buyer_type: 'local', buyer_name: 'X', milk_type: 'cow', qty: 2, rate: 50, mode: 'cash' });
  const o2 = await as('PUT', `/api/milk/sales/${o.id}`, { date: '2026-10-05', buyer_type: 'wastage', milk_type: 'cow', qty: 2 });
  assert.deepEqual([o2.amount, o2.buyer_name], [0, null]);

  // Customers cannot edit.
  const c = await ok('POST', '/api/login/customer', { phone: '9876543210', pin: '1234' });
  assert.equal((await call('PUT', `/api/expenses/${e.id}`, { date: '2026-10-05', kind: 'house', category: 'X', amount: 1, mode: 'cash' }, c.token)).status, 403);
});

test('owner can delete test data', async () => {
  assert.equal((await call('POST', '/api/reset', { scope: 'entries', password: 'wrong' }, admin)).status, 400);
  const before = (await as('GET', '/api/parties')).length;
  await as('POST', '/api/reset', { scope: 'entries', password: 'secret1' });
  assert.equal((await as('GET', '/api/milk/collections')).length, 0);
  assert.equal((await as('GET', '/api/payments')).length, 0);
  assert.equal((await as('GET', '/api/expenses')).length, 0);
  assert.equal((await as('GET', '/api/parties')).length, before);
  assert.ok((await as('GET', '/api/parties')).every((p) => p.balance === p.opening_balance));
  await as('POST', '/api/reset', { scope: 'all', password: 'secret1' });
  assert.equal((await as('GET', '/api/parties')).length, 0);
  assert.equal((await as('GET', '/api/feed/items')).length, 0);
  assert.equal((await as('GET', '/api/status')).dairy_name ?? 'x', 'Test Dairy');
});
