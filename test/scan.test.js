'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const D = require('../src/db');
const { createApp } = require('../src/server');

// Stand-in for Claude: returns what a photo of the sheet would give.
function fakeScanner(on = true) {
  return {
    enabled: () => on,
    calls: [],
    async readMilkSheet(args) {
      this.calls.push(args);
      return {
        date_written: '2026-10-01',
        shift_written: 'evening',
        rows: [
          { code: '07', name: '', milk_type: 'cow', qty: 10.5, fat: 4.1, snf: 8.4, amount: 0, unclear: false },
          { code: '', name: 'harjit kaur', milk_type: 'buffalo', qty: 6, fat: 6.8, snf: 0, amount: 0, unclear: false },
          { code: '99', name: 'Unknown Person', milk_type: 'unknown', qty: 3, fat: 0, snf: 0, amount: 0, unclear: true },
          { code: '', name: '', milk_type: 'cow', qty: 0, fat: 0, snf: 0, amount: 0, unclear: true },
        ],
      };
    },
  };
}

async function boot(scanner) {
  const server = http.createServer(createApp(D.open(':memory:'), { scanner }));
  await new Promise((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, path, body, token) => {
    const res = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, data: await res.json() };
  };
  const admin = (await call('POST', '/api/setup', { password: 'secret1' })).data.token;
  return { server, call, admin };
}

const IMG = Buffer.from('fake-jpeg-bytes').toString('base64');

test('photo lines are matched to farmers and saved together', async () => {
  const scanner = fakeScanner();
  const { server, call, admin } = await boot(scanner);
  try {
    assert.equal((await call('GET', '/api/status')).data.scan_enabled, true);
    const g = (await call('POST', '/api/parties', { name: 'Gurpreet Singh', code: '7', kind: 'farmer' }, admin)).data;
    const h = (await call('POST', '/api/parties', { name: 'Harjit Kaur', code: '2', kind: 'farmer' }, admin)).data;
    await call('POST', '/api/parties', { name: 'Verka', kind: 'company' }, admin);

    assert.equal((await call('POST', '/api/milk/scan', { image: IMG, media_type: 'image/jpeg' })).status, 401);
    assert.equal((await call('POST', '/api/milk/scan', { image: IMG, media_type: 'text/html' }, admin)).status, 400);

    const r = await call('POST', '/api/milk/scan', { image: IMG, media_type: 'image/jpeg' }, admin);
    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.equal(r.data.date, '2026-10-01');
    assert.equal(r.data.shift, 'evening');
    assert.equal(r.data.rows.length, 3); // zero-litre line dropped
    assert.deepEqual(r.data.rows.map((x) => [x.party_id, x.match]), [[g.id, 'code'], [h.id, 'name'], [null, null]]);
    // Only farmers are sent to the reader as the name list.
    assert.deepEqual(scanner.calls[0].farmers.map((f) => f.name).sort(), ['Gurpreet Singh', 'Harjit Kaur']);
    assert.equal(scanner.calls[0].imageBase64, IMG);

    // A bad line rejects the whole batch.
    const badBatch = await call('POST', '/api/milk/collections/bulk', {
      date: '2026-10-01', shift: 'evening',
      rows: [{ party_id: g.id, milk_type: 'cow', qty: 10.5, fat: 4.1, rate: 35 }, { party_id: null, milk_type: 'cow', qty: 3, rate: 35 }],
    }, admin);
    assert.equal(badBatch.status, 400);
    assert.match(badBatch.data.error, /^Line 2:/);
    assert.equal((await call('GET', '/api/milk/collections', null, admin)).data.length, 0);

    const saved = await call('POST', '/api/milk/collections/bulk', {
      date: '2026-10-01', shift: 'evening',
      rows: [
        { party_id: g.id, milk_type: 'cow', qty: 10.5, fat: 4.1, snf: 8.4, rate: 35 },
        { party_id: h.id, milk_type: 'buffalo', qty: 6, fat: 6.8, rate: 51 },
      ],
    }, admin);
    assert.equal(saved.status, 200, JSON.stringify(saved.data));
    assert.equal(saved.data.saved, 2);
    const list = (await call('GET', '/api/milk/collections?from=2026-10-01&to=2026-10-01', null, admin)).data;
    assert.equal(list.length, 2);
    assert.equal(list.find((x) => x.party_id === h.id).amount, 306);
    assert.equal(list.find((x) => x.party_id === g.id).snf, 8.4);
  } finally {
    server.close();
  }
});

test('photo reading reports when it is not set up', async () => {
  const { server, call, admin } = await boot(fakeScanner(false));
  try {
    assert.equal((await call('GET', '/api/status')).data.scan_enabled, false);
    const r = await call('POST', '/api/milk/scan', { image: IMG, media_type: 'image/jpeg' }, admin);
    assert.equal(r.status, 503);
    assert.match(r.data.error, /ANTHROPIC_API_KEY/);
  } finally {
    server.close();
  }
});
