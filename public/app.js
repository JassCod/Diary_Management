'use strict';
/* Milk Dairy – single page web app (owner panel + customer portal). */

// ================= helpers =================

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const app = $('#app');

const S = {
  token: lsGet('token'),
  role: lsGet('role'),
  status: null,
  settings: null,
  parties: [],
  items: [],
};

function lsGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function lsSet(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* ignore */ } }

function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
const nf = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });
const money = (n) => (Number(n) < 0 ? '−₹' : '₹') + nf.format(Math.abs(Number(n) || 0));
const qty = (n) => nf.format(Number(n) || 0);
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

function iso(d) {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
}
const today = () => iso(new Date());
function addDays(s, n) { const d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + n); return iso(d); }
function monthStart(s = today()) { return s.slice(0, 8) + '01'; }
function fmtDate(s, withYear = false) {
  if (!s) return '';
  const d = new Date(s + 'T00:00:00');
  return d.toLocaleDateString('en-IN', withYear ? { day: '2-digit', month: 'short', year: 'numeric' } : { day: '2-digit', month: 'short' });
}
function fmtDay(s) {
  const d = new Date(s + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}
const defaultShift = () => (new Date().getHours() < 14 ? 'morning' : 'evening');
const initials = (name) => String(name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

const KIND = {
  farmer: 'Farmer (sells milk)',
  buyer: 'Milk buyer',
  company: 'Milk company',
  feed: 'Feed customer',
  supplier: 'Feed supplier',
};
const KIND_SHORT = { farmer: 'Farmer', buyer: 'Buyer', company: 'Company', feed: 'Feed', supplier: 'Supplier' };
const MODE = { cash: 'Cash', online: 'Online', credit: 'Udhaar', account: 'Khata' };

function balanceText(b) {
  if (Math.abs(b) < 0.005) return { text: 'All settled', cls: '', short: 'Settled' };
  return b > 0
    ? { text: `Dairy has to pay ${money(b)}`, cls: 'good', short: `Pay ${money(b)}` }
    : { text: `Has to pay dairy ${money(-b)}`, cls: 'bad', short: `Due ${money(-b)}` };
}

async function api(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(S.token ? { Authorization: `Bearer ${S.token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* empty */ }
  if (res.status === 401 && S.token && !path.startsWith('/api/login')) {
    setAuth(null, null);
    toast('Please log in again', true);
    location.hash = '#/login';
    throw new Error('Please log in again');
  }
  if (!res.ok) throw new Error((data && data.error) || 'Something went wrong');
  return data;
}

let toastTimer;
function toast(msg, err = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'show' + (err ? ' err' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = ''; }, 2600);
}

function setAuth(token, role) {
  S.token = token; S.role = role;
  lsSet('token', token); lsSet('role', role);
}

function formData(form) {
  const o = {};
  for (const [k, v] of new FormData(form).entries()) o[k] = typeof v === 'string' ? v.trim() : v;
  return o;
}

// Wrap a form submit: disable button, show errors as toast.
function onSubmit(form, fn) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type=submit]');
    if (btn) btn.disabled = true;
    try { await fn(formData(form)); } catch (err) { toast(err.message, true); } finally { if (btn) btn.disabled = false; }
  });
}

function seg(name, options, value) {
  return `<div class="seg" role="radiogroup">${options.map(([v, label, cls]) => `
    <label><input type="radio" name="${name}" value="${esc(v)}" ${v === value ? 'checked' : ''}><span class="${cls || ''}">${label}</span></label>`).join('')}</div>`;
}
const field = (label, inner) => `<label class="f">${label}${inner}</label>`;

// ----- modal -----
const modal = $('#modal');
function openModal(title, html) {
  modal.innerHTML = `<div class="m-head"><h2>${esc(title)}</h2><button class="icon-btn" data-close aria-label="Close">✕</button></div><div class="m-body">${html}</div>`;
  modal.showModal();
  $('[data-close]', modal).onclick = () => modal.close();
  return modal;
}
modal.addEventListener('click', (e) => { if (e.target === modal) modal.close(); });

async function confirmBox(msg) {
  return new Promise((resolve) => {
    openModal('Please confirm', `<p>${esc(msg)}</p><div class="row-actions"><button class="btn danger" id="yes">Yes, delete</button><button class="btn plain" id="no">Cancel</button></div>`);
    $('#yes', modal).onclick = () => { modal.close(); resolve(true); };
    $('#no', modal).onclick = () => { modal.close(); resolve(false); };
    modal.addEventListener('close', () => resolve(false), { once: true });
  });
}

// ----- data caches -----
async function loadParties() { S.parties = await api('GET', '/api/parties'); return S.parties; }
async function loadItems() { S.items = await api('GET', '/api/feed/items'); return S.items; }
async function loadSettings() { S.settings = await api('GET', '/api/settings'); return S.settings; }
const partyById = (id) => S.parties.find((p) => p.id === Number(id));

// ----- person picker (search by name, code, village or phone) -----
function picker(name, { placeholder = 'Search name / code / village', kinds = [], value = null } = {}) {
  const p = value ? partyById(value) : null;
  return `<div class="picker" data-name="${name}" data-kinds="${kinds.join(',')}">
    <input type="text" class="picker-input" placeholder="${esc(placeholder)}" autocomplete="off" value="${p ? esc(pLabel(p)) : ''}">
    <input type="hidden" name="${name}" value="${p ? p.id : ''}">
    <div class="picker-list"></div>
    <div class="picked-info">${p ? pInfo(p) : ''}</div>
  </div>`;
}
const pLabel = (p) => `${p.code ? p.code + ' · ' : ''}${p.name}`;
const pInfo = (p) => {
  const b = balanceText(p.balance);
  return `${esc(KIND_SHORT[p.kind])}${p.village ? ' · ' + esc(p.village) : ''} · <span class="${b.cls}-t">${b.text}</span>`;
};

function initPickers(root) {
  for (const box of $$('.picker', root)) {
    const input = $('.picker-input', box);
    const hidden = $('input[type=hidden]', box);
    const list = $('.picker-list', box);
    const info = $('.picked-info', box);
    let hl = 0;
    let matches = [];

    const choose = (p) => {
      hidden.value = p ? p.id : '';
      input.value = p ? pLabel(p) : input.value;
      info.innerHTML = p ? pInfo(p) : '';
      list.classList.remove('open');
      box.dispatchEvent(new CustomEvent('picked', { detail: p, bubbles: true }));
    };
    const render = () => {
      const q = input.value.trim().toLowerCase();
      const kinds = box.dataset.kinds ? box.dataset.kinds.split(',') : [];
      matches = S.parties
        .filter((p) => p.active)
        .filter((p) => !q || [p.name, p.code, p.village, p.phone].some((x) => x && String(x).toLowerCase().includes(q)))
        .sort((a, b) => {
          const ka = kinds.includes(a.kind) ? 0 : 1;
          const kb = kinds.includes(b.kind) ? 0 : 1;
          if (ka !== kb) return ka - kb;
          if (q && String(a.code || '').toLowerCase() === q) return -1;
          if (q && String(b.code || '').toLowerCase() === q) return 1;
          return a.name.localeCompare(b.name);
        })
        .slice(0, 8);
      hl = 0;
      list.innerHTML = matches.length
        ? matches.map((p, i) => `<button type="button" data-i="${i}" class="${i === 0 ? 'hl' : ''}"><span>${esc(pLabel(p))}<br><small>${esc(p.village || '')} ${esc(p.phone || '')}</small></span><small>${esc(KIND_SHORT[p.kind])}</small></button>`).join('')
        : '<div class="empty">No match. Add the person in “People”.</div>';
      list.classList.add('open');
    };
    input.addEventListener('input', () => { hidden.value = ''; info.innerHTML = ''; render(); });
    input.addEventListener('focus', () => { input.select(); render(); });
    input.addEventListener('blur', () => setTimeout(() => list.classList.remove('open'), 180));
    input.addEventListener('keydown', (e) => {
      if (!list.classList.contains('open')) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        hl = Math.max(0, Math.min(matches.length - 1, hl + (e.key === 'ArrowDown' ? 1 : -1)));
        $$('button', list).forEach((b, i) => b.classList.toggle('hl', i === hl));
      } else if (e.key === 'Enter') {
        if (matches[hl]) { e.preventDefault(); choose(matches[hl]); }
      } else if (e.key === 'Escape') list.classList.remove('open');
    });
    list.addEventListener('mousedown', (e) => e.preventDefault());
    list.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-i]');
      if (b) choose(matches[Number(b.dataset.i)]);
    });
    box.clear = () => { hidden.value = ''; input.value = ''; info.innerHTML = ''; };
  }
}

// Wire a delete button list: data-del="endpoint/id"
function wireDeletes(root, after) {
  root.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-del]');
    if (!b) return;
    if (!(await confirmBox('Delete this entry? This cannot be undone.'))) return;
    try { await api('DELETE', b.dataset.del); toast('Deleted'); after(); } catch (err) { toast(err.message, true); }
  });
}

// Range chooser used by reports, ledgers and the customer portal.
function rangePresets() {
  const t = today();
  const d = new Date(t + 'T00:00:00');
  const lastMonthEnd = addDays(monthStart(t), -1);
  const day = d.getDate();
  // Common 10-day milk billing cycles: 1–10, 11–20, 21–end.
  const cycStart = day <= 10 ? 1 : day <= 20 ? 11 : 21;
  const cyc = t.slice(0, 8) + String(cycStart).padStart(2, '0');
  return [
    ['today', 'Today', t, t],
    ['cycle', 'This 10 days', cyc, t],
    ['month', 'This month', monthStart(t), t],
    ['lastmonth', 'Last month', monthStart(lastMonthEnd), lastMonthEnd],
    ['year', 'This year', t.slice(0, 4) + '-01-01', t],
  ];
}
function rangeBar(from, to) {
  const presets = rangePresets();
  const on = presets.findIndex(([, , f, tt]) => f === from && tt === to);
  return `<div class="chips no-print">${presets.map(([k, label, f, tt], i) =>
    `<button type="button" class="chip ${i === on ? 'on' : ''}" data-range="${f}|${tt}">${label}</button>`).join('')}</div>
    <form class="grid two no-print range-form" style="margin-bottom:16px">
      ${field('From', `<input type="date" name="from" value="${from}" required>`)}
      ${field('To', `<input type="date" name="to" value="${to}" required>`)}
    </form>`;
}
function wireRange(root, cb) {
  $$('[data-range]', root).forEach((b) => b.addEventListener('click', () => { const [f, t] = b.dataset.range.split('|'); cb(f, t); }));
  const form = $('.range-form', root);
  if (form) form.addEventListener('change', () => { const d = formData(form); if (d.from && d.to) cb(d.from, d.to); });
}

// ================= routing & layout =================

const NAV = [
  ['home', '🏠', 'Home'],
  ['milk', '🥛', 'Milk'],
  ['feed', '🌾', 'Feed'],
  ['people', '👥', 'People'],
  ['money', '💰', 'Payments'],
  ['expenses', '🧾', 'Expenses'],
  ['reports', '📊', 'Reports'],
  ['settings', '⚙️', 'Settings'],
];
const BOTTOM = ['home', 'milk', 'feed', 'people', 'more'];

function shell(active, title) {
  const name = esc(S.status?.dairy_name || 'Milk Dairy');
  const isMore = !BOTTOM.slice(0, 4).includes(active);
  app.innerHTML = `
  <div class="shell">
    <nav class="sidebar">
      <div class="brand"><img src="icon.svg" alt=""><span>${name}</span></div>
      ${NAV.map(([k, ico, label]) => `<a href="#/${k}" class="${k === active ? 'on' : ''}"><span class="nav-ico">${ico}</span>${label}</a>`).join('')}
      <div class="grow"></div>
      <a href="#/logout"><span class="nav-ico">🚪</span>Log out</a>
    </nav>
    <div>
      <header class="topbar"><img class="logo" src="icon.svg" alt=""><div class="title">${esc(title || S.status?.dairy_name || 'Milk Dairy')}</div></header>
      <main id="main"></main>
    </div>
    <nav class="bottomnav">
      ${NAV.slice(0, 4).map(([k, ico, label]) => `<a href="#/${k}" class="${k === active ? 'on' : ''}"><span class="nav-ico">${ico}</span>${label}</a>`).join('')}
      <a href="#/more" class="${isMore ? 'on' : ''}"><span class="nav-ico">☰</span>More</a>
    </nav>
  </div>`;
  return $('#main');
}

async function router() {
  const hash = location.hash.replace(/^#\/?/, '') || '';
  const [page, ...rest] = hash.split('/');
  modal.open && modal.close();

  if (!S.status) {
    try { S.status = await api('GET', '/api/status'); } catch (e) { app.innerHTML = `<div class="boot">Cannot reach the server. ${esc(e.message)}</div>`; return; }
  }
  document.title = S.status.dairy_name || 'Milk Dairy';

  if (S.status.setup_needed) return pageSetup();
  if (page === 'logout') {
    try { if (S.token) await api('POST', '/api/logout'); } catch { /* ignore */ }
    setAuth(null, null);
    location.hash = '#/login';
    return;
  }
  if (!S.token || page === 'login') {
    if (S.token && page === 'login') { location.hash = S.role === 'customer' ? '#/portal' : '#/home'; return; }
    return pageLogin();
  }
  if (S.role === 'customer') return pagePortal();

  const pages = {
    home: pageHome, milk: pageMilk, feed: pageFeed, people: pagePeople, money: pageMoney,
    expenses: pageExpenses, reports: pageReports, settings: pageSettings, more: pageMore,
  };
  const fn = pages[page] || pageHome;
  try {
    if (!S.settings) await loadSettings();
    await fn(...rest);
  } catch (e) {
    if (e.message !== 'Please log in again') toast(e.message, true);
  }
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', router);

// ================= login & setup =================

function pageSetup() {
  app.innerHTML = `
  <div class="login-wrap"><div class="login">
    <div class="hero"><img src="icon.svg" alt=""><h1>Welcome! Let’s set up your dairy</h1><p class="sub">This takes 10 seconds.</p></div>
    <form class="card" id="f">
      <div class="grid">
        ${field('Dairy name', '<input name="dairy_name" placeholder="e.g. Waheguru Milk Dairy" required>')}
        ${field('Owner password (keep it secret)', '<input name="password" type="password" minlength="4" required autocomplete="new-password">')}
        ${field('Type password again', '<input name="password2" type="password" minlength="4" required autocomplete="new-password">')}
      </div>
      <button class="btn block" type="submit">Start</button>
    </form>
  </div></div>`;
  onSubmit($('#f'), async (d) => {
    if (d.password !== d.password2) throw new Error('Both passwords are not the same');
    const r = await api('POST', '/api/setup', d);
    setAuth(r.token, r.role);
    S.status = null;
    location.hash = '#/settings';
    router();
  });
}

function pageLogin() {
  const tab = sessionStorage.getItem('loginTab') || 'customer';
  app.innerHTML = `
  <div class="login-wrap"><div class="login">
    <div class="hero"><img src="icon.svg" alt=""><h1>${esc(S.status.dairy_name)}</h1>
      ${S.status.dairy_phone ? `<p class="sub">📞 ${esc(S.status.dairy_phone)}</p>` : ''}</div>
    <div class="card">
      <div style="margin-bottom:14px">${seg('who', [['customer', '👨‍🌾 Customer'], ['admin', '🏪 Dairy owner']], tab)}</div>
      <form id="fc" ${tab !== 'customer' ? 'hidden' : ''}>
        <p class="sub" style="margin-top:0">See your milk, feed and payment record.</p>
        <div class="grid">
          ${field('Mobile number', '<input name="phone" type="tel" inputmode="numeric" required autocomplete="tel">')}
          ${field('PIN (ask the dairy)', '<input name="pin" type="password" inputmode="numeric" pattern="[0-9]{4,6}" required>')}
        </div><br>
        <button class="btn block" type="submit">See my account</button>
      </form>
      <form id="fa" ${tab !== 'admin' ? 'hidden' : ''}>
        <div class="grid">${field('Password', '<input name="password" type="password" required autocomplete="current-password">')}</div><br>
        <button class="btn block" type="submit">Log in</button>
      </form>
    </div>
  </div></div>`;
  $$('input[name=who]').forEach((r) => r.addEventListener('change', () => { sessionStorage.setItem('loginTab', r.value); pageLogin(); }));
  const done = (r) => { setAuth(r.token, r.role); location.hash = r.role === 'customer' ? '#/portal' : '#/home'; router(); };
  onSubmit($('#fc'), async (d) => done(await api('POST', '/api/login/customer', d)));
  onSubmit($('#fa'), async (d) => done(await api('POST', '/api/login/admin', d)));
}

// ================= home =================

async function pageHome() {
  const main = shell('home');
  main.innerHTML = '<div class="empty">Loading…</div>';
  const d = await api('GET', `/api/dashboard?today=${today()}`);
  const m = d.month;
  const tm = (type, shift) => d.today_milk.filter((x) => x.milk_type === type && (!shift || x.shift === shift)).reduce((s, x) => s + x.qty, 0);
  const todayAmt = d.today_milk.reduce((s, x) => s + x.amount, 0);

  // 7-day chart
  const days = Array.from({ length: 7 }, (_, i) => addDays(d.today, i - 6));
  const vals = days.map((day) => ({
    day,
    cow: d.week.filter((w) => w.date === day && w.milk_type === 'cow').reduce((s, w) => s + w.qty, 0),
    buf: d.week.filter((w) => w.date === day && w.milk_type === 'buffalo').reduce((s, w) => s + w.qty, 0),
  }));
  const max = Math.max(1, ...vals.map((v) => v.cow + v.buf));

  main.innerHTML = `
    <div class="page-head"><div><h1>Namaste 🙏</h1><div class="sub">${fmtDay(d.today)}</div></div></div>

    <div class="quick">
      <a href="#/milk/collect"><span>🥛</span>Milk entry</a>
      <a href="#/milk/out"><span>🚚</span>Milk out / Sale</a>
      <a href="#/feed/sell"><span>🌾</span>Sell feed</a>
      <a href="#/money"><span>💸</span>Pay / Receive</a>
      <a href="#/expenses"><span>🧾</span>Add expense</a>
    </div>

    ${d.low_feed.length ? `<div class="alert">⚠️ Feed stock low: ${d.low_feed.map((i) => `${esc(i.name)} (${qty(i.stock)} ${esc(i.unit)})`).join(', ')}</div>` : ''}

    <h2 style="margin-bottom:10px">❄️ Cold storage now</h2>
    <div class="grid two" style="margin-bottom:16px">
      <div class="stat cow"><div class="k">Cow milk</div><div class="v">${qty(d.stock.cow)} L</div></div>
      <div class="stat buf"><div class="k">Buffalo milk</div><div class="v">${qty(d.stock.buffalo)} L</div></div>
    </div>
    ${d.last_pickup ? `<p class="sub" style="margin:-8px 0 16px">Last company pickup: ${fmtDate(d.last_pickup.date)} · ${qty(d.last_pickup.qty)} L</p>` : ''}

    <h2 style="margin-bottom:10px">Today’s collection</h2>
    <div class="grid four" style="margin-bottom:16px">
      <div class="stat"><div class="k">🌅 Morning</div><div class="v">${qty(tm('cow', 'morning') + tm('buffalo', 'morning'))} L</div><div class="s">Cow ${qty(tm('cow', 'morning'))} · Buffalo ${qty(tm('buffalo', 'morning'))}</div></div>
      <div class="stat"><div class="k">🌇 Evening</div><div class="v">${qty(tm('cow', 'evening') + tm('buffalo', 'evening'))} L</div><div class="s">Cow ${qty(tm('cow', 'evening'))} · Buffalo ${qty(tm('buffalo', 'evening'))}</div></div>
      <div class="stat"><div class="k">Milk bought today</div><div class="v">${money(todayAmt)}</div></div>
      <div class="stat"><div class="k">Entries today</div><div class="v">${d.today_milk.reduce((s, x) => s + x.n, 0)}</div></div>
    </div>

    <h2 style="margin-bottom:10px">💰 Where is my money</h2>
    <div class="grid four" style="margin-bottom:16px">
      <div class="stat"><div class="k">💵 Cash in hand</div><div class="v">${money(d.money.cash)}</div></div>
      <div class="stat"><div class="k">📱 Online / Bank</div><div class="v">${money(d.money.online)}</div></div>
      <div class="stat good"><div class="k">To receive (from people)</div><div class="v">${money(d.to_receive)}</div></div>
      <div class="stat bad"><div class="k">To pay (to people)</div><div class="v">${money(d.to_pay)}</div></div>
    </div>

    <div class="cols">
      <div class="card">
        <div class="card-head"><h2>This month</h2><a href="#/reports" class="btn sm ghost">Full report</a></div>
        <div class="kv">
          <div>Milk sold</div><div>${money(m.milk_sold.amount)}</div>
          <div>Milk bought</div><div>− ${money(m.milk_bought.amount)}</div>
          <div>Feed profit</div><div>${money(m.feed_margin)}</div>
          <div>Business expenses</div><div>− ${money(m.business_expenses)}</div>
          <div class="total">Business profit</div><div class="total ${m.profit >= 0 ? 'good-t' : 'bad-t'}">${money(m.profit)}</div>
          <div>House expenses</div><div>− ${money(m.house_expenses)}</div>
          <div class="total">Saved</div><div class="total ${m.savings >= 0 ? 'good-t' : 'bad-t'}">${money(m.savings)}</div>
        </div>
      </div>
      <div class="card">
        <h2>Last 7 days milk collected</h2>
        <div class="bars">${vals.map((v) => `
          <div class="bar"><div class="val">${v.cow + v.buf ? qty(Math.round(v.cow + v.buf)) : ''}</div>
            <div class="stack" style="height:${((v.cow + v.buf) / max) * 100}%">
              <div class="seg-cow" style="flex:${v.cow}"></div><div class="seg-buf" style="flex:${v.buf}"></div>
            </div>
            <div class="lbl">${fmtDate(v.day).split(' ')[0]}</div></div>`).join('')}
        </div>
        <div class="legend"><span><i style="background:var(--cow)"></i>Cow</span><span><i style="background:var(--buf)"></i>Buffalo</span></div>
      </div>
    </div>`;
}

function pageMore() {
  const main = shell('more', 'More');
  main.innerHTML = `
    <div class="quick">
      ${NAV.slice(4).map(([k, ico, label]) => `<a href="#/${k}"><span>${ico}</span>${label}</a>`).join('')}
      <a href="#/logout"><span>🚪</span>Log out</a>
    </div>`;
}

// ================= milk =================

function rateFor(type, fat) {
  const s = S.settings;
  const mode = s[`${type}_rate_mode`];
  const base = Number(s[`${type}_rate`]) || 0;
  if (mode === 'fat') return fat ? r2(base * Number(fat)) : '';
  return base;
}

async function pageMilk(tab = 'collect') {
  const main = shell('milk', 'Milk');
  main.innerHTML = `<div class="tabs">
      <a href="#/milk/collect" class="${tab === 'collect' ? 'on' : ''}">🥛 Buy from farmers</a>
      <a href="#/milk/out" class="${tab === 'out' ? 'on' : ''}">🚚 Milk out / Sale</a>
    </div><div id="milkbody"></div>`;
  await loadParties();
  if (tab === 'out') return milkOut($('#milkbody'));
  return milkCollect($('#milkbody'));
}

function milkCollect(root) {
  const st = { date: sessionStorage.getItem('mc_date') || today(), shift: sessionStorage.getItem('mc_shift') || defaultShift() };
  const lastType = JSON.parse(lsGet('lastType') || '{}');
  const s = S.settings;
  const rateHint = (t) => (s[`${t}_rate_mode`] === 'fat' ? `₹${s[`${t}_rate`]} × fat` : `₹${s[`${t}_rate`]} / L`);

  root.innerHTML = `
  <div class="cols">
    <form class="card" id="f" autocomplete="off">
      <h2>New milk entry</h2>
      <div class="grid date-shift">
        ${field('Date', `<input type="date" name="date" value="${st.date}" required>`)}
        ${field('Time', seg('shift', [['morning', '🌅 Morning'], ['evening', '🌇 Evening']], st.shift))}
      </div>
      <div class="grid">${field('Farmer', picker('party_id', { kinds: ['farmer'] }))}</div>
      <div class="grid">${field('Milk type', seg('milk_type', [['cow', '🐄 Cow', 'cow'], ['buffalo', '🐃 Buffalo', 'buffalo']], 'cow'))}</div>
      <div class="grid three">
        ${field('Litres', '<input name="qty" class="big" type="number" step="0.01" min="0" inputmode="decimal" required>')}
        ${field('Fat %', '<input name="fat" type="number" step="0.1" min="0" inputmode="decimal">')}
        ${field(`Rate ₹/L <small id="rh"></small>`, '<input name="rate" type="number" step="0.01" min="0" inputmode="decimal" required>')}
      </div>
      <div class="amount-preview"><span>Amount</span><b id="amt">₹0</b></div>
      <button class="btn block" type="submit">✓ Save entry</button>
    </form>
    <div class="card">
      <div class="card-head"><h2 id="lh"></h2></div>
      <div class="grid two" id="tot" style="margin-bottom:12px"></div>
      <div id="list"></div>
    </div>
  </div>`;
  const f = $('#f', root);
  initPickers(root);
  const pick = $('.picker', f);
  let rateTouched = false;

  const type = () => f.milk_type.value;
  const updRate = () => {
    $('#rh', root).textContent = `(${rateHint(type())})`;
    if (!rateTouched) f.rate.value = rateFor(type(), f.fat.value);
    upd();
  };
  const upd = () => { $('#amt', root).textContent = money(r2((Number(f.qty.value) || 0) * (Number(f.rate.value) || 0))); };
  f.qty.addEventListener('input', upd);
  f.fat.addEventListener('input', updRate);
  f.rate.addEventListener('input', () => { rateTouched = true; upd(); });
  $$('input[name=milk_type]', f).forEach((r) => r.addEventListener('change', () => { rateTouched = false; updRate(); }));
  pick.addEventListener('picked', (e) => {
    const p = e.detail;
    if (p && lastType[p.id]) { f.milk_type.value = lastType[p.id]; rateTouched = false; updRate(); }
    f.qty.focus();
  });
  const relist = () => {
    st.date = f.date.value; st.shift = f.shift.value;
    sessionStorage.setItem('mc_date', st.date); sessionStorage.setItem('mc_shift', st.shift);
    list();
  };
  f.date.addEventListener('change', relist);
  $$('input[name=shift]', f).forEach((r) => r.addEventListener('change', relist));

  async function list() {
    const rows = (await api('GET', `/api/milk/collections?from=${st.date}&to=${st.date}`)).filter((r) => r.shift === st.shift);
    $('#lh', root).textContent = `${fmtDate(st.date)} · ${st.shift === 'morning' ? '🌅 Morning' : '🌇 Evening'} (${rows.length})`;
    const t = (ty) => rows.filter((r) => r.milk_type === ty);
    const sum = (a, k) => a.reduce((s, r) => s + r[k], 0);
    const fatAvg = (a) => { const w = a.filter((r) => r.fat); const q = sum(w, 'qty'); return q ? (w.reduce((s, r) => s + r.fat * r.qty, 0) / q).toFixed(1) : '–'; };
    $('#tot', root).innerHTML = `
      <div class="stat cow"><div class="k">Cow</div><div class="v">${qty(sum(t('cow'), 'qty'))} L</div><div class="s">${money(sum(t('cow'), 'amount'))} · avg fat ${fatAvg(t('cow'))}</div></div>
      <div class="stat buf"><div class="k">Buffalo</div><div class="v">${qty(sum(t('buffalo'), 'qty'))} L</div><div class="s">${money(sum(t('buffalo'), 'amount'))} · avg fat ${fatAvg(t('buffalo'))}</div></div>`;
    $('#list', root).innerHTML = rows.length ? `<div class="list">${rows.map((r) => `
      <div class="item">
        <div class="avatar">${esc(r.party_code || initials(r.party_name))}</div>
        <div class="main"><b>${esc(r.party_name)}</b><small><span class="badge ${r.milk_type}">${r.milk_type}</span> ${qty(r.qty)} L${r.fat ? ` · fat ${r.fat}` : ''} · ₹${r.rate}/L</small></div>
        <div class="end"><b>${money(r.amount)}</b></div>
        <button class="icon-btn" data-del="/api/milk/collections/${r.id}" aria-label="Delete">🗑</button>
      </div>`).join('')}</div>` : '<div class="empty">No entries yet for this time.</div>';
  }
  wireDeletes($('#list', root), list);

  onSubmit(f, async (d) => {
    await api('POST', '/api/milk/collections', d);
    lastType[d.party_id] = d.milk_type;
    lsSet('lastType', JSON.stringify(lastType));
    const p = partyById(d.party_id);
    toast(`Saved: ${p ? p.name : ''} ${d.qty} L`);
    f.qty.value = ''; f.fat.value = ''; rateTouched = false;
    pick.clear(); updRate();
    $('.picker-input', f).focus();
    list();
  });
  updRate();
  list();
}

function milkOut(root) {
  const last = JSON.parse(lsGet('lastOut') || '{}');
  root.innerHTML = `
  <div class="grid two" id="stock" style="margin-bottom:16px"></div>
  <div class="cols">
    <form class="card" id="f" autocomplete="off">
      <h2>Milk going out of cold storage</h2>
      <div class="grid">${field('Where did the milk go?', seg('buyer_type', [['company', '🚚 Company van'], ['local', '🏠 Local sale'], ['wastage', '🗑 Waste / home']], last.buyer_type || 'company'))}</div>
      <div class="grid two">
        ${field('Date', `<input type="date" name="date" value="${today()}" required>`)}
        ${field('Milk type', seg('milk_type', [['cow', '🐄 Cow', 'cow'], ['buffalo', '🐃 Buffalo', 'buffalo']], 'cow'))}
      </div>
      <div class="grid" data-show="company local">${field('<span id="plbl">Company</span>', picker('party_id', { kinds: ['company'] }))}</div>
      <div class="grid" data-show="local">${field('Or buyer name (walk-in)', '<input name="buyer_name" placeholder="Optional">')}</div>
      <div class="grid three">
        ${field('Litres', '<input name="qty" class="big" type="number" step="0.01" min="0" inputmode="decimal" required>')}
        ${field('Fat %', '<input name="fat" type="number" step="0.1" min="0" inputmode="decimal">')}
        <span data-show="company local">${field('Rate ₹/L', '<input name="rate" type="number" step="0.01" min="0" inputmode="decimal">')}</span>
      </div>
      <div data-show="company local">
        <div class="amount-preview"><span>Amount</span><b id="amt">₹0</b></div>
        <div class="grid">${field('Payment', seg('mode', [['credit', '📒 Udhaar / later'], ['cash', '💵 Cash'], ['online', '📱 Online']], 'credit'))}</div>
      </div>
      <div class="grid two">
        <span data-show="company">${field('Van / vehicle no.', `<input name="vehicle" value="${esc(last.vehicle || '')}">`)}</span>
        ${field('Note', '<input name="note" placeholder="Optional">')}
      </div>
      <button class="btn block" type="submit">✓ Save</button>
    </form>
    <div class="card"><h2>Recent (last 30 days)</h2><div id="list"></div></div>
  </div>`;
  const f = $('#f', root);
  initPickers(root);
  const pick = $('.picker', f);
  const upd = () => { $('#amt', root).textContent = money(r2((Number(f.qty.value) || 0) * (Number(f.rate.value) || 0))); };
  const defaultRate = () => {
    const bt = f.buyer_type.value; const t = f.milk_type.value;
    if (bt === 'local') f.rate.value = S.settings[`${t}_sale_rate`] || '';
    else if (bt === 'company') f.rate.value = last[`company_${t}`] || '';
    upd();
  };
  const sync = () => {
    const bt = f.buyer_type.value;
    $$('[data-show]', f).forEach((el) => { el.hidden = !el.dataset.show.split(' ').includes(bt); });
    $('#plbl', f).textContent = bt === 'company' ? 'Company' : 'Buyer (from people list – needed for udhaar)';
    pick.dataset.kinds = bt === 'company' ? 'company' : 'buyer';
    if (bt === 'local' && f.mode.value === 'credit' && !f.party_id.value) f.mode.value = 'cash';
    if (bt === 'company') { f.mode.value = 'credit'; const c = S.parties.find((p) => p.kind === 'company' && p.active); if (c && !f.party_id.value) { f.party_id.value = c.id; $('.picker-input', f).value = pLabel(c); } }
    defaultRate();
  };
  $$('input[name=buyer_type]', f).forEach((r) => r.addEventListener('change', () => { pick.clear(); sync(); }));
  $$('input[name=milk_type]', f).forEach((r) => r.addEventListener('change', defaultRate));
  f.qty.addEventListener('input', upd); f.rate.addEventListener('input', upd);

  async function refresh() {
    const [dash, rows] = await Promise.all([
      api('GET', `/api/dashboard?today=${today()}`),
      api('GET', `/api/milk/sales?from=${addDays(today(), -30)}`),
    ]);
    $('#stock', root).innerHTML = `
      <div class="stat cow"><div class="k">❄️ Cow milk in storage</div><div class="v">${qty(dash.stock.cow)} L</div></div>
      <div class="stat buf"><div class="k">❄️ Buffalo milk in storage</div><div class="v">${qty(dash.stock.buffalo)} L</div></div>`;
    const icon = { company: '🚚', local: '🏠', wastage: '🗑' };
    $('#list', root).innerHTML = rows.length ? `<div class="list">${rows.map((r) => `
      <div class="item">
        <div class="avatar">${icon[r.buyer_type]}</div>
        <div class="main"><b>${esc(r.party_name || r.buyer_name || (r.buyer_type === 'wastage' ? 'Waste / home use' : 'Local sale'))}</b>
          <small>${fmtDate(r.date)} · <span class="badge ${r.milk_type}">${r.milk_type}</span> ${qty(r.qty)} L${r.fat ? ` · fat ${r.fat}` : ''}${r.vehicle ? ` · ${esc(r.vehicle)}` : ''}</small></div>
        <div class="end"><b>${r.buyer_type === 'wastage' ? '–' : money(r.amount)}</b>${r.buyer_type !== 'wastage' ? `<small>${MODE[r.mode]}</small>` : ''}</div>
        <button class="icon-btn" data-del="/api/milk/sales/${r.id}" aria-label="Delete">🗑</button>
      </div>`).join('')}</div>` : '<div class="empty">Nothing yet.</div>';
  }
  wireDeletes($('#list', root), refresh);

  onSubmit(f, async (d) => {
    await api('POST', '/api/milk/sales', d);
    last.buyer_type = d.buyer_type;
    if (d.buyer_type === 'company') { last[`company_${d.milk_type}`] = d.rate; last.vehicle = d.vehicle; }
    lsSet('lastOut', JSON.stringify(last));
    toast(`Saved: ${d.qty} L ${d.milk_type}`);
    f.qty.value = ''; f.fat.value = ''; f.note.value = '';
    upd(); refresh();
  });
  sync();
  refresh();
}

// ================= feed =================

async function pageFeed(tab = 'sell') {
  const main = shell('feed', 'Feed');
  main.innerHTML = `<div class="tabs">
      <a href="#/feed/sell" class="${tab === 'sell' ? 'on' : ''}">🌾 Sell feed</a>
      <a href="#/feed/stock" class="${tab === 'stock' ? 'on' : ''}">📦 Stock & items</a>
      <a href="#/feed/buy" class="${tab === 'buy' ? 'on' : ''}">🚛 Buy stock</a>
    </div><div id="feedbody"></div>`;
  await Promise.all([loadParties(), loadItems()]);
  const body = $('#feedbody');
  if (!S.items.length && tab !== 'stock') {
    body.innerHTML = `<div class="card empty"><p>First add your feed items (like Khal, Choker, Feed bag, Mineral mixture).</p><a class="btn" href="#/feed/stock">+ Add feed items</a></div>`;
    return;
  }
  if (tab === 'stock') return feedStock(body);
  if (tab === 'buy') return feedBuy(body);
  return feedSell(body);
}

const itemOptions = (sel) => S.items.filter((i) => i.active).map((i) =>
  `<option value="${i.id}" ${Number(sel) === i.id ? 'selected' : ''}>${esc(i.name)} — stock ${qty(i.stock)} ${esc(i.unit)}</option>`).join('');

function feedSell(root) {
  root.innerHTML = `
  <div class="cols">
    <form class="card" id="f" autocomplete="off">
      <h2>Sell feed</h2>
      <div class="grid">${field('Customer', picker('party_id', { kinds: ['farmer', 'feed'], placeholder: 'Search customer (leave empty for walk-in)' }))}</div>
      <div class="grid" id="walkin">${field('Or walk-in buyer name', '<input name="buyer_name" placeholder="Optional">')}</div>
      <div class="grid">${field('Feed item', `<select name="item_id" required>${itemOptions()}</select>`)}</div>
      <div class="grid two">
        ${field('Quantity', '<input name="qty" class="big" type="number" step="0.01" min="0" inputmode="decimal" required>')}
        ${field('Rate ₹', '<input name="rate" type="number" step="0.01" min="0" inputmode="decimal" required>')}
      </div>
      <div class="amount-preview"><span>Amount</span><b id="amt">₹0</b></div>
      <div class="grid">${field('Payment', seg('mode', [['account', '📒 Cut from milk money'], ['cash', '💵 Cash'], ['online', '📱 Online']], 'cash'))}</div>
      <div class="grid two">
        ${field('Date', `<input type="date" name="date" value="${today()}" required>`)}
        ${field('Note', '<input name="note" placeholder="Optional">')}
      </div>
      <button class="btn block" type="submit">✓ Save sale</button>
    </form>
    <div class="card"><h2>Recent feed sales</h2><div id="list"></div></div>
  </div>`;
  const f = $('#f', root);
  initPickers(root);
  const upd = () => { $('#amt', root).textContent = money(r2((Number(f.qty.value) || 0) * (Number(f.rate.value) || 0))); };
  const setRate = () => { const i = S.items.find((x) => x.id === Number(f.item_id.value)); if (i) f.rate.value = i.sale_price || ''; upd(); };
  f.item_id.addEventListener('change', setRate);
  f.qty.addEventListener('input', upd); f.rate.addEventListener('input', upd);
  $('.picker', f).addEventListener('picked', (e) => {
    $('#walkin', root).hidden = !!e.detail;
    if (e.detail && ['farmer'].includes(e.detail.kind)) f.mode.value = 'account';
    f.qty.focus();
  });

  async function list() {
    const rows = await api('GET', `/api/feed/sales?from=${addDays(today(), -30)}`);
    $('#list', root).innerHTML = rows.length ? `<div class="list">${rows.map((r) => `
      <div class="item">
        <div class="avatar">🌾</div>
        <div class="main"><b>${esc(r.party_name || r.buyer_name || 'Walk-in')}</b><small>${fmtDate(r.date)} · ${esc(r.item)} · ${qty(r.qty)} ${esc(r.unit)} @ ₹${r.rate}</small></div>
        <div class="end"><b>${money(r.amount)}</b><small>${MODE[r.mode]}</small></div>
        <button class="icon-btn" data-del="/api/feed/sales/${r.id}" aria-label="Delete">🗑</button>
      </div>`).join('')}</div>` : '<div class="empty">No feed sold in last 30 days.</div>';
  }
  wireDeletes($('#list', root), async () => { await loadItems(); list(); });

  onSubmit(f, async (d) => {
    await api('POST', '/api/feed/sales', d);
    toast('Feed sale saved');
    await loadItems();
    const sel = f.item_id.value;
    f.item_id.innerHTML = itemOptions(sel);
    f.qty.value = ''; f.note.value = ''; f.buyer_name.value = '';
    $('.picker', f).clear(); $('#walkin', root).hidden = false; f.mode.value = 'cash';
    upd(); list();
  });
  setRate();
  list();
}

function feedStock(root) {
  root.innerHTML = `
  <div class="card">
    <div class="card-head"><h2>Feed items & stock</h2><button class="btn sm" id="add">+ Add item</button></div>
    ${S.items.length ? `<div class="table-wrap"><table>
      <thead><tr><th>Item</th><th class="n">Stock</th><th class="n">Buy ₹</th><th class="n">Sell ₹</th><th class="n">Stock value</th><th></th></tr></thead>
      <tbody>${S.items.map((i) => `<tr>
        <td><b>${esc(i.name)}</b> ${!i.active ? '<span class="badge">hidden</span>' : ''}<br><small class="sub">per ${esc(i.unit)}</small></td>
        <td class="n"><span class="badge ${i.stock <= i.low_stock ? 'warn' : 'good'}">${qty(i.stock)} ${esc(i.unit)}</span></td>
        <td class="n">${money(i.purchase_price)}</td><td class="n">${money(i.sale_price)}</td>
        <td class="n">${money(i.stock * i.purchase_price)}</td>
        <td class="n"><button class="btn sm plain" data-edit="${i.id}">Edit</button></td></tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="4">Total stock value</td><td class="n">${money(S.items.reduce((s, i) => s + Math.max(0, i.stock) * i.purchase_price, 0))}</td><td></td></tr></tfoot>
    </table></div>` : '<div class="empty">No feed items yet.</div>'}
  </div>`;
  $('#add', root).onclick = () => itemForm();
  $$('[data-edit]', root).forEach((b) => (b.onclick = () => itemForm(S.items.find((i) => i.id === Number(b.dataset.edit)))));

  function itemForm(it) {
    const i = it || { unit: 'bag', low_stock: 5, active: 1 };
    const m = openModal(it ? 'Edit feed item' : 'New feed item', `
      <form id="fi">
        <div class="grid">${field('Name', `<input name="name" value="${esc(i.name || '')}" placeholder="e.g. Cattle feed 50kg" required>`)}</div>
        <div class="grid two">
          ${field('Unit', `<select name="unit">${['bag', 'kg', 'quintal', 'packet', 'litre', 'piece'].map((u) => `<option ${u === i.unit ? 'selected' : ''}>${u}</option>`).join('')}</select>`)}
          ${field('Opening stock', `<input name="opening_stock" type="number" step="0.01" value="${i.opening_stock ?? 0}">`)}
          ${field('Purchase price ₹', `<input name="purchase_price" type="number" step="0.01" min="0" value="${i.purchase_price ?? ''}">`)}
          ${field('Sale price ₹', `<input name="sale_price" type="number" step="0.01" min="0" value="${i.sale_price ?? ''}">`)}
          ${field('Warn when stock below', `<input name="low_stock" type="number" step="0.01" min="0" value="${i.low_stock}">`)}
          ${field('Show in lists', `<select name="active"><option value="1">Yes</option><option value="0" ${!i.active ? 'selected' : ''}>No (hide)</option></select>`)}
        </div>
        <button class="btn block" type="submit">Save</button>
      </form>`);
    onSubmit($('#fi', m), async (d) => {
      d.active = d.active === '1';
      if (it) await api('PUT', `/api/feed/items/${it.id}`, d); else await api('POST', '/api/feed/items', d);
      m.close(); toast('Saved');
      await loadItems(); feedStock(root);
    });
  }
}

function feedBuy(root) {
  root.innerHTML = `
  <div class="cols">
    <form class="card" id="f" autocomplete="off">
      <h2>Buy feed stock (bulk)</h2>
      <div class="grid">${field('Feed item', `<select name="item_id" required>${itemOptions()}</select>`)}</div>
      <div class="grid two">
        ${field('Quantity', '<input name="qty" class="big" type="number" step="0.01" min="0" inputmode="decimal" required>')}
        ${field('Rate ₹ (per unit)', '<input name="rate" type="number" step="0.01" min="0" inputmode="decimal" required>')}
      </div>
      <div class="amount-preview"><span>Total</span><b id="amt">₹0</b></div>
      <div class="grid">${field('Supplier', picker('party_id', { kinds: ['supplier'], placeholder: 'Search supplier (optional)' }))}</div>
      <div class="grid">${field('Payment', seg('mode', [['cash', '💵 Cash'], ['online', '📱 Online'], ['account', '📒 Pay later']], 'cash'))}</div>
      <div class="grid two">
        ${field('Date', `<input type="date" name="date" value="${today()}" required>`)}
        ${field('Note / bill no.', '<input name="note" placeholder="Optional">')}
      </div>
      <button class="btn block" type="submit">✓ Add to stock</button>
    </form>
    <div class="card"><h2>Recent purchases</h2><div id="list"></div></div>
  </div>`;
  const f = $('#f', root);
  initPickers(root);
  const upd = () => { $('#amt', root).textContent = money(r2((Number(f.qty.value) || 0) * (Number(f.rate.value) || 0))); };
  const setRate = () => { const i = S.items.find((x) => x.id === Number(f.item_id.value)); if (i) f.rate.value = i.purchase_price || ''; upd(); };
  f.item_id.addEventListener('change', setRate);
  f.qty.addEventListener('input', upd); f.rate.addEventListener('input', upd);

  async function list() {
    const rows = await api('GET', `/api/feed/purchases?from=${addDays(today(), -90)}`);
    $('#list', root).innerHTML = rows.length ? `<div class="list">${rows.map((r) => `
      <div class="item">
        <div class="avatar">🚛</div>
        <div class="main"><b>${esc(r.item)}</b><small>${fmtDate(r.date)} · ${qty(r.qty)} ${esc(r.unit)} @ ₹${r.rate}${r.party_name ? ' · ' + esc(r.party_name) : ''}</small></div>
        <div class="end"><b>${money(r.amount)}</b><small>${r.mode === 'account' ? 'Pay later' : MODE[r.mode]}</small></div>
        <button class="icon-btn" data-del="/api/feed/purchases/${r.id}" aria-label="Delete">🗑</button>
      </div>`).join('')}</div>` : '<div class="empty">No purchases in last 90 days.</div>';
  }
  wireDeletes($('#list', root), async () => { await loadItems(); list(); });

  onSubmit(f, async (d) => {
    await api('POST', '/api/feed/purchases', d);
    toast('Stock added');
    await loadItems();
    f.item_id.innerHTML = itemOptions(d.item_id);
    f.qty.value = ''; f.note.value = '';
    upd(); list();
  });
  setRate();
  list();
}

// ================= people =================

async function pagePeople(id) {
  if (id) return pagePerson(Number(id));
  const main = shell('people', 'People');
  await loadParties();
  let filter = sessionStorage.getItem('pf') || 'all';
  let q = '';
  main.innerHTML = `
    <div class="page-head"><h1>People</h1><button class="btn" id="add">+ Add person</button></div>
    <div class="grid two" id="sum" style="margin-bottom:16px"></div>
    <input id="q" type="search" placeholder="🔍 Search name, code, village, phone" style="margin-bottom:12px">
    <div class="chips" id="chips"></div>
    <div class="card"><div class="list" id="list"></div></div>`;
  const toPay = S.parties.filter((p) => p.balance > 0).reduce((s, p) => s + p.balance, 0);
  const toGet = S.parties.filter((p) => p.balance < 0).reduce((s, p) => s - p.balance, 0);
  $('#sum').innerHTML = `
    <div class="stat bad"><div class="k">Dairy has to pay</div><div class="v">${money(toPay)}</div></div>
    <div class="stat good"><div class="k">Dairy will receive</div><div class="v">${money(toGet)}</div></div>`;
  const chips = [['all', 'All'], ['farmer', 'Farmers'], ['buyer', 'Buyers'], ['company', 'Company'], ['feed', 'Feed'], ['supplier', 'Suppliers'], ['pay', 'To pay'], ['due', 'To receive'], ['inactive', 'Hidden']];
  const render = () => {
    $('#chips').innerHTML = chips.map(([k, l]) => `<button class="chip ${k === filter ? 'on' : ''}" data-k="${k}">${l}</button>`).join('');
    const rows = S.parties.filter((p) => {
      if (filter === 'inactive') { if (p.active) return false; } else if (!p.active) return false;
      if (filter === 'pay' && !(p.balance > 0)) return false;
      if (filter === 'due' && !(p.balance < 0)) return false;
      if (KIND[filter] && p.kind !== filter) return false;
      return !q || [p.name, p.code, p.village, p.phone].some((x) => x && String(x).toLowerCase().includes(q));
    });
    $('#list').innerHTML = rows.length ? rows.map((p) => {
      const b = balanceText(p.balance);
      return `<a class="item" href="#/people/${p.id}">
        <div class="avatar">${esc(p.code || initials(p.name))}</div>
        <div class="main"><b>${esc(p.name)}</b><small>${esc(KIND_SHORT[p.kind])}${p.village ? ' · ' + esc(p.village) : ''}${p.phone ? ' · ' + esc(p.phone) : ''}</small></div>
        <div class="end"><span class="badge ${b.cls}">${b.short}</span></div></a>`;
    }).join('') : '<div class="empty">Nobody here yet. Tap “+ Add person”.</div>';
  };
  $('#chips').addEventListener('click', (e) => { const b = e.target.closest('[data-k]'); if (b) { filter = b.dataset.k; sessionStorage.setItem('pf', filter); render(); } });
  $('#q').addEventListener('input', (e) => { q = e.target.value.trim().toLowerCase(); render(); });
  $('#add').onclick = () => personForm(null, (p) => { location.hash = `#/people/${p.id}`; });
  render();
}

function personForm(p, done) {
  const x = p || { kind: 'farmer', active: 1, opening_balance: 0 };
  const m = openModal(p ? 'Edit person' : 'Add person', `
    <form id="fp" autocomplete="off">
      <div class="grid">${field('Type', `<select name="kind">${Object.entries(KIND).map(([k, l]) => `<option value="${k}" ${k === x.kind ? 'selected' : ''}>${l}</option>`).join('')}</select>`)}</div>
      <div class="grid two">
        ${field('Name', `<input name="name" value="${esc(x.name || '')}" required>`)}
        ${field('Code / number', `<input name="code" value="${esc(x.code || '')}" placeholder="e.g. 12">`)}
        ${field('Mobile', `<input name="phone" type="tel" inputmode="tel" value="${esc(x.phone || '')}">`)}
        ${field('Village', `<input name="village" value="${esc(x.village || '')}">`)}
      </div>
      <div class="grid">${field('Old balance (when starting the app)', seg('ob_dir', [['pay', 'Dairy has to pay'], ['get', 'They have to pay']], (x.opening_balance || 0) < 0 ? 'get' : 'pay'))}
        <input name="ob" type="number" step="0.01" min="0" inputmode="decimal" value="${Math.abs(x.opening_balance || 0) || ''}" placeholder="₹ 0">
      </div>
      <div class="grid two">
        ${field(`Customer login PIN ${p && p.has_pin ? '(already set – type to change)' : '(4–6 digits)'}`, '<input name="pin" inputmode="numeric" pattern="[0-9]{4,6}" placeholder="Optional">')}
        ${field('Status', `<select name="active"><option value="1">Active</option><option value="0" ${x.active ? '' : 'selected'}>Hidden</option></select>`)}
      </div>
      <div class="grid">${field('Note', `<input name="note" value="${esc(x.note || '')}">`)}</div>
      <p class="sub">With mobile + PIN the person can log in and see their own record.</p>
      <button class="btn block" type="submit">Save</button>
      ${p && p.has_pin ? '<br><br><button type="button" class="btn plain block" id="rmpin">Remove login PIN</button>' : ''}
    </form>`);
  const save = async (d, extra = {}) => {
    const ob = Number(d.ob) || 0;
    const body = { ...d, ...extra, opening_balance: d.ob_dir === 'get' ? -ob : ob, active: d.active === '1' };
    const r = p ? await api('PUT', `/api/parties/${p.id}`, body) : await api('POST', '/api/parties', body);
    m.close(); toast('Saved');
    await loadParties();
    done(r);
  };
  onSubmit($('#fp', m), (d) => save(d));
  const rm = $('#rmpin', m);
  if (rm) rm.onclick = () => save(formData($('#fp', m)), { remove_pin: true, pin: '' }).catch((e) => toast(e.message, true));
}

async function pagePerson(id, from, to) {
  const presets = rangePresets();
  from = from || sessionStorage.getItem('lf') || presets[2][2];
  to = to || sessionStorage.getItem('lt') || presets[2][3];
  const main = shell('people', 'Account');
  await loadParties();
  const l = await api('GET', `/api/parties/${id}/ledger?from=${from}&to=${to}`);
  const p = l.party;
  const b = balanceText(p.balance);
  const paidOut = l.entries.filter((e) => e.kind === 'pay_out').reduce((s, e) => s + e.debit, 0);
  const paidIn = l.entries.filter((e) => e.kind === 'pay_in').reduce((s, e) => s + e.credit, 0);

  main.innerHTML = `
    <div class="page-head no-print"><a href="#/people" class="btn sm plain">← People</a>
      <div class="row-actions">
        <button class="btn sm ghost" id="edit">✏️ Edit</button>
        <button class="btn sm ghost" id="print">🖨 Print</button>
        ${p.phone ? '<button class="btn sm ghost" id="wa">💬 WhatsApp</button>' : ''}
      </div></div>
    <div class="print-only"><h1>${esc(S.status.dairy_name)}</h1><p>Statement ${fmtDate(from, true)} – ${fmtDate(to, true)}</p></div>
    <div class="balance-card ${p.balance < 0 ? 'owe' : Math.abs(p.balance) < 0.005 ? 'zero' : ''}">
      <div class="lbl">${esc(p.code ? p.code + ' · ' : '')}${esc(p.name)} · ${esc(KIND_SHORT[p.kind])}</div>
      <div class="amt">${money(Math.abs(p.balance))}</div>
      <div class="lbl">${b.text}</div>
      <div class="meta">${p.village ? esc(p.village) + ' · ' : ''}${p.phone ? `<a href="tel:${esc(p.phone)}">📞 ${esc(p.phone)}</a>` : 'No mobile'} · ${p.has_pin ? '🔓 Can log in' : '🔒 No login PIN'}</div>
    </div>
    <div class="row-actions no-print" style="margin-bottom:16px">
      <button class="btn" id="pay">💸 Dairy pays ${p.balance > 0 ? money(p.balance) : ''}</button>
      <button class="btn ghost" id="recv">📥 Receive money</button>
    </div>
    ${rangeBar(from, to)}
    <div class="grid four" style="margin-bottom:16px">
      <div class="stat"><div class="k">Milk given</div><div class="v">${qty(l.milk_qty)} L</div><div class="s">${money(l.milk_amount)}</div></div>
      <div class="stat"><div class="k">Feed taken (khata)</div><div class="v">${money(l.feed_amount)}</div></div>
      <div class="stat"><div class="k">Paid by dairy</div><div class="v">${money(paidOut)}</div></div>
      <div class="stat"><div class="k">Received by dairy</div><div class="v">${money(paidIn)}</div></div>
    </div>
    <div class="card">
      <h2>Record ${fmtDate(from)} – ${fmtDate(to)}</h2>
      ${ledgerTable(l)}
    </div>`;
  wireRange(main, (f, t) => { sessionStorage.setItem('lf', f); sessionStorage.setItem('lt', t); pagePerson(id, f, t); });
  $('#edit').onclick = () => personForm(partyById(id), () => pagePerson(id, from, to));
  $('#print').onclick = () => window.print();
  $('#pay').onclick = () => paymentForm(p, 'out', () => pagePerson(id, from, to));
  $('#recv').onclick = () => paymentForm(p, 'in', () => pagePerson(id, from, to));
  const wa = $('#wa');
  if (wa) wa.onclick = () => {
    const lines = [
      `*${S.status.dairy_name}*`,
      `Statement for ${p.name} (${fmtDate(from)} – ${fmtDate(to)})`,
      `Milk: ${qty(l.milk_qty)} L = ${money(l.milk_amount)}`,
      `Feed: ${money(l.feed_amount)}`,
      `Paid by dairy: ${money(paidOut)}`,
      `Received: ${money(paidIn)}`,
      `*Balance: ${b.text}*`,
      p.has_pin ? `See full details: ${location.origin}/` : '',
    ].filter(Boolean);
    let phone = p.phone.replace(/\D/g, '');
    if (phone.length === 10) phone = '91' + phone;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(lines.join('\n'))}`, '_blank');
  };
}

function ledgerTable(l) {
  const rows = l.entries;
  return `<div class="list ledger-list">
    <div class="item"><div class="main"><b>Opening balance</b><small>${l.from ? fmtDate(l.from) : ''}</small></div><div class="end"><b>${money(l.opening)}</b></div></div>
    ${rows.map((r) => `<div class="item"><div class="main"><small>${fmtDate(r.date)}</small><div>${esc(r.desc)}</div></div>
      <div class="end">${r.credit ? `<b class="good-t">+${money(r.credit)}</b>` : ''}${r.debit ? `<b class="bad-t">−${money(r.debit)}</b>` : ''}<small>Bal ${money(r.balance)}</small></div></div>`).join('')}
    <div class="item"><div class="main"><b>Closing balance</b></div><div class="end"><b>${money(l.closing)}</b></div></div>
  </div>
  <div class="table-wrap ledger-table"><table>
    <thead><tr><th>Date</th><th>Details</th><th class="n">+ Credit</th><th class="n">− Debit</th><th class="n">Balance</th></tr></thead>
    <tbody>
      <tr class="opening"><td>${l.from ? fmtDate(l.from) : ''}</td><td>Opening balance</td><td></td><td></td><td class="n">${money(l.opening)}</td></tr>
      ${rows.map((r) => `<tr><td>${fmtDate(r.date)}</td><td>${esc(r.desc)}</td>
        <td class="n">${r.credit ? money(r.credit) : ''}</td><td class="n">${r.debit ? money(r.debit) : ''}</td>
        <td class="n ${r.balance < 0 ? 'bad-t' : ''}">${money(r.balance)}</td></tr>`).join('')}
    </tbody>
    <tfoot><tr><td></td><td>Total</td><td class="n">${money(l.total_credit)}</td><td class="n">${money(l.total_debit)}</td><td class="n">${money(l.closing)}</td></tr></tfoot>
  </table></div>
  <p class="sub">Balance in plus (+) = dairy has to pay. In minus (−) = person has to pay dairy.</p>`;
}

function paymentForm(p, direction, done) {
  const suggested = direction === 'out' ? Math.max(0, p.balance) : Math.max(0, -p.balance);
  const m = openModal(direction === 'out' ? `Pay ${p.name}` : `Receive from ${p.name}`, `
    <form id="fpay">
      <div class="grid">${field('Amount ₹', `<input name="amount" class="big" type="number" step="0.01" min="0" inputmode="decimal" value="${suggested ? r2(suggested) : ''}" required>`)}</div>
      <div class="grid">${field('Mode', seg('mode', [['cash', '💵 Cash'], ['online', '📱 Online / UPI']], 'cash'))}</div>
      <div class="grid two">
        ${field('Date', `<input type="date" name="date" value="${today()}" required>`)}
        ${field('Note', '<input name="note" placeholder="e.g. 1–10 Oct milk bill">')}
      </div>
      <button class="btn block" type="submit">✓ Save</button>
    </form>`);
  onSubmit($('#fpay', m), async (d) => {
    await api('POST', '/api/payments', { ...d, party_id: p.id, direction });
    m.close(); toast('Payment saved'); done();
  });
}

// ================= payments =================

async function pageMoney() {
  const main = shell('money', 'Payments');
  await loadParties();
  main.innerHTML = `
    <div class="page-head"><h1>Payments</h1></div>
    <div class="grid two" id="pos" style="margin-bottom:16px"></div>
    <div class="cols">
      <form class="card" id="f" autocomplete="off">
        <h2>Pay or receive money</h2>
        <div class="grid">${seg('direction', [['out', '💸 Dairy pays'], ['in', '📥 Dairy receives']], 'out')}</div>
        <div class="grid">${field('Person', picker('party_id', { kinds: ['farmer'] }))}</div>
        <div class="grid">${field('Amount ₹', '<input name="amount" class="big" type="number" step="0.01" min="0" inputmode="decimal" required>')}</div>
        <div class="grid">${field('Mode', seg('mode', [['cash', '💵 Cash'], ['online', '📱 Online / UPI']], 'cash'))}</div>
        <div class="grid two">
          ${field('Date', `<input type="date" name="date" value="${today()}" required>`)}
          ${field('Note', '<input name="note" placeholder="Optional">')}
        </div>
        <button class="btn block" type="submit">✓ Save payment</button>
      </form>
      <div>
        <div class="card"><h2>Pending: dairy has to pay</h2><div id="topay"></div></div>
        <div class="card"><h2>Pending: to receive</h2><div id="toget"></div></div>
      </div>
    </div>
    <div class="card"><h2>Recent payments</h2><div id="list"></div></div>`;
  const f = $('#f');
  initPickers(main);
  const pick = $('.picker', f);
  pick.addEventListener('picked', (e) => {
    const p = e.detail; if (!p) return;
    const want = f.direction.value === 'out' ? p.balance : -p.balance;
    if (want > 0) f.amount.value = r2(want);
    f.amount.focus();
  });
  $$('input[name=direction]', f).forEach((r) => r.addEventListener('change', () => {
    pick.dataset.kinds = r.value === 'out' ? 'farmer,supplier' : 'buyer,company,feed';
  }));

  const pendList = (rows, dir) => rows.length ? `<div class="list">${rows.slice(0, 8).map((p) => `
      <div class="item"><div class="avatar">${esc(p.code || initials(p.name))}</div>
        <div class="main"><b>${esc(p.name)}</b><small>${esc(KIND_SHORT[p.kind])}${p.village ? ' · ' + esc(p.village) : ''}</small></div>
        <div class="end"><b>${money(Math.abs(p.balance))}</b></div>
        <button class="btn sm ghost" data-quick="${p.id}" data-dir="${dir}">${dir === 'out' ? 'Pay' : 'Receive'}</button></div>`).join('')}</div>`
    : '<div class="empty">Nothing pending 🎉</div>';

  async function refresh() {
    await loadParties();
    const [dash, rows] = await Promise.all([api('GET', `/api/dashboard?today=${today()}`), api('GET', `/api/payments?from=${addDays(today(), -60)}`)]);
    $('#pos').innerHTML = `
      <div class="stat"><div class="k">💵 Cash in hand</div><div class="v">${money(dash.money.cash)}</div></div>
      <div class="stat"><div class="k">📱 Online / Bank</div><div class="v">${money(dash.money.online)}</div></div>`;
    $('#topay').innerHTML = pendList(S.parties.filter((p) => p.balance > 0.005).sort((a, b) => b.balance - a.balance), 'out');
    $('#toget').innerHTML = pendList(S.parties.filter((p) => p.balance < -0.005).sort((a, b) => a.balance - b.balance), 'in');
    $('#list').innerHTML = rows.length ? `<div class="list">${rows.map((r) => `
      <div class="item"><div class="avatar">${r.direction === 'out' ? '💸' : '📥'}</div>
        <div class="main"><b>${esc(r.party_name)}</b><small>${fmtDate(r.date)} · ${r.direction === 'out' ? 'Paid by dairy' : 'Received'} · ${MODE[r.mode]}${r.note ? ' · ' + esc(r.note) : ''}</small></div>
        <div class="end"><b class="${r.direction === 'out' ? 'bad-t' : 'good-t'}">${r.direction === 'out' ? '−' : '+'}${money(r.amount)}</b></div>
        <button class="icon-btn" data-del="/api/payments/${r.id}" aria-label="Delete">🗑</button></div>`).join('')}</div>`
      : '<div class="empty">No payments in last 60 days.</div>';
  }
  main.addEventListener('click', (e) => {
    const b = e.target.closest('[data-quick]');
    if (b) paymentForm(partyById(b.dataset.quick), b.dataset.dir, refresh);
  });
  wireDeletes($('#list'), refresh);
  onSubmit(f, async (d) => {
    await api('POST', '/api/payments', d);
    toast('Payment saved');
    f.amount.value = ''; f.note.value = ''; pick.clear();
    refresh();
  });
  refresh();
}

// ================= expenses =================

const EXP_CATS = {
  house: ['Ration / Grocery', 'Vegetables & Milk', 'Electricity', 'Gas', 'School / Fees', 'Medical', 'Clothes', 'Mobile / Internet', 'Travel / Petrol', 'Function / Gifts', 'Loan EMI', 'Other'],
  business: ['Electricity (dairy)', 'Diesel / Generator', 'Labour / Salary', 'Transport', 'Cans & Equipment', 'Repair', 'Rent', 'Testing / Chemicals', 'Other'],
};

async function pageExpenses() {
  const main = shell('expenses', 'Expenses');
  let kind = sessionStorage.getItem('ek') || 'house';
  const from = monthStart();
  const to = today();
  main.innerHTML = `
    <div class="page-head"><h1>Expenses</h1></div>
    <div class="cols">
      <form class="card" id="f" autocomplete="off">
        <h2>Add expense</h2>
        <div class="grid">${seg('kind', [['house', '🏠 House'], ['business', '🏪 Dairy business']], kind)}</div>
        <div class="grid"><div class="f"><span class="sub"><b>Spent on</b></span><div class="chips" id="cats" style="margin:4px 0 0"></div>
          <input name="category" id="cat" placeholder="Or type here" required></div></div>
        <div class="grid">${field('Amount ₹', '<input name="amount" class="big" type="number" step="0.01" min="0" inputmode="decimal" required>')}</div>
        <div class="grid">${field('Paid by', seg('mode', [['cash', '💵 Cash'], ['online', '📱 Online / UPI']], 'cash'))}</div>
        <div class="grid two">
          ${field('Date', `<input type="date" name="date" value="${today()}" required>`)}
          ${field('Note', '<input name="note" placeholder="Optional">')}
        </div>
        <button class="btn block" type="submit">✓ Save expense</button>
      </form>
      <div>
        <div class="grid two" id="sum" style="margin-bottom:16px"></div>
        <div class="card"><h2>This month</h2><div id="list"></div></div>
      </div>
    </div>`;
  const f = $('#f');
  const cats = () => {
    $('#cats').innerHTML = EXP_CATS[kind].map((c) => `<button type="button" class="chip ${f.category.value === c ? 'on' : ''}" data-c="${esc(c)}">${esc(c)}</button>`).join('');
  };
  $('#cats').addEventListener('click', (e) => { const b = e.target.closest('[data-c]'); if (b) { f.category.value = b.dataset.c; cats(); f.amount.focus(); } });
  f.category.addEventListener('input', cats);
  $$('input[name=kind]', f).forEach((r) => r.addEventListener('change', () => { kind = r.value; sessionStorage.setItem('ek', kind); f.category.value = ''; cats(); }));

  async function list() {
    const rows = await api('GET', `/api/expenses?from=${from}&to=${to}`);
    const tot = (k, m) => rows.filter((r) => r.kind === k && (!m || r.mode === m)).reduce((s, r) => s + r.amount, 0);
    $('#sum').innerHTML = `
      <div class="stat"><div class="k">🏠 House (this month)</div><div class="v">${money(tot('house'))}</div><div class="s">Cash ${money(tot('house', 'cash'))} · Online ${money(tot('house', 'online'))}</div></div>
      <div class="stat"><div class="k">🏪 Business (this month)</div><div class="v">${money(tot('business'))}</div><div class="s">Cash ${money(tot('business', 'cash'))} · Online ${money(tot('business', 'online'))}</div></div>`;
    $('#list').innerHTML = rows.length ? `<div class="list">${rows.map((r) => `
      <div class="item"><div class="avatar">${r.kind === 'house' ? '🏠' : '🏪'}</div>
        <div class="main"><b>${esc(r.category)}</b><small>${fmtDate(r.date)} · ${MODE[r.mode]}${r.note ? ' · ' + esc(r.note) : ''}</small></div>
        <div class="end"><b>${money(r.amount)}</b></div>
        <button class="icon-btn" data-del="/api/expenses/${r.id}" aria-label="Delete">🗑</button></div>`).join('')}</div>`
      : '<div class="empty">No expenses this month.</div>';
  }
  wireDeletes($('#list'), list);
  onSubmit(f, async (d) => {
    await api('POST', '/api/expenses', d);
    toast('Expense saved');
    f.amount.value = ''; f.note.value = ''; f.category.value = ''; cats();
    list();
  });
  cats();
  list();
}

// ================= reports =================

async function pageReports(from, to) {
  const main = shell('reports', 'Reports');
  from = from || sessionStorage.getItem('rf') || monthStart();
  to = to || sessionStorage.getItem('rt') || today();
  const r = await api('GET', `/api/reports?from=${from}&to=${to}`);
  const byT = (arr, t) => arr.find((x) => x.milk_type === t) || { qty: 0, amount: 0 };
  const maxCat = Math.max(1, ...r.expense_categories.map((c) => c.amount));
  const fl = r.flows;
  main.innerHTML = `
    <div class="page-head"><h1>Reports</h1><button class="btn sm ghost no-print" id="print">🖨 Print</button></div>
    <div class="print-only"><h2>${esc(S.status.dairy_name)} · ${fmtDate(from, true)} – ${fmtDate(to, true)}</h2></div>
    ${rangeBar(from, to)}
    <div class="grid four" style="margin-bottom:16px">
      <div class="stat ${r.profit >= 0 ? 'good' : 'bad'}"><div class="k">Business profit</div><div class="v">${money(r.profit)}</div></div>
      <div class="stat"><div class="k">House expenses</div><div class="v">${money(r.house_expenses)}</div></div>
      <div class="stat ${r.savings >= 0 ? 'good' : 'bad'}"><div class="k">Saved (profit − house)</div><div class="v">${money(r.savings)}</div></div>
      <div class="stat"><div class="k">Milk wasted / home</div><div class="v">${qty(r.milk_wastage)} L</div></div>
    </div>
    <div class="cols">
      <div class="card">
        <h2>Profit & loss</h2>
        <div class="kv">
          <div>Milk sold (${qty(r.milk_sold.qty)} L)</div><div>${money(r.milk_sold.amount)}</div>
          <div>Milk bought (${qty(r.milk_bought.qty)} L)</div><div>− ${money(r.milk_bought.amount)}</div>
          <div class="total">Milk profit</div><div class="total">${money(r.milk_margin)}</div>
          <div>Feed sold</div><div>${money(r.feed_sales)}</div>
          <div>Cost of that feed</div><div>− ${money(r.feed_cost)}</div>
          <div class="total">Feed profit</div><div class="total">${money(r.feed_margin)}</div>
          <div>Business expenses</div><div>− ${money(r.business_expenses)}</div>
          <div class="total">Business profit</div><div class="total ${r.profit >= 0 ? 'good-t' : 'bad-t'}">${money(r.profit)}</div>
          <div>House expenses</div><div>− ${money(r.house_expenses)}</div>
          <div class="total">Saved</div><div class="total ${r.savings >= 0 ? 'good-t' : 'bad-t'}">${money(r.savings)}</div>
        </div>
        <p class="sub">Feed bought for stock in this period: ${money(r.feed_bought)} (counted as profit only when sold).</p>
      </div>
      <div class="card">
        <h2>Milk by type</h2>
        <div class="table-wrap"><table>
          <thead><tr><th></th><th class="n">Bought L</th><th class="n">Bought ₹</th><th class="n">Sold L</th><th class="n">Sold ₹</th></tr></thead>
          <tbody>${['cow', 'buffalo'].map((t) => `<tr><td><span class="badge ${t}">${t}</span></td>
            <td class="n">${qty(byT(r.milk_bought_by_type, t).qty)}</td><td class="n">${money(byT(r.milk_bought_by_type, t).amount)}</td>
            <td class="n">${qty(byT(r.milk_sold_by_type, t).qty)}</td><td class="n">${money(byT(r.milk_sold_by_type, t).amount)}</td></tr>`).join('')}</tbody>
        </table></div>
        <p class="sub">Now in cold storage: cow ${qty(r.stock.cow)} L · buffalo ${qty(r.stock.buffalo)} L</p>
      </div>
    </div>
    <div class="cols">
      <div class="card">
        <h2>Cash vs Online in this period</h2>
        <div class="table-wrap"><table>
          <thead><tr><th></th><th class="n">💵 Cash</th><th class="n">📱 Online</th></tr></thead>
          <tbody>
            ${[['Milk sales', 'milk_sales'], ['Feed sales', 'feed_sales'], ['Received from people', 'received']].map(([l, k]) => `<tr><td>+ ${l}</td><td class="n">${money(fl.cash[k])}</td><td class="n">${money(fl.online[k])}</td></tr>`).join('')}
            ${[['Paid to people', 'paid'], ['Feed stock bought', 'feed_purchases'], ['Business expenses', 'business_exp'], ['House expenses', 'house_exp']].map(([l, k]) => `<tr><td>− ${l}</td><td class="n">${money(fl.cash[k])}</td><td class="n">${money(fl.online[k])}</td></tr>`).join('')}
          </tbody>
          <tfoot>
            <tr><td>Net change</td><td class="n">${money(fl.cash.total_in - fl.cash.total_out)}</td><td class="n">${money(fl.online.total_in - fl.online.total_out)}</td></tr>
            <tr><td>Balance today</td><td class="n">${money(r.money_now.cash)}</td><td class="n">${money(r.money_now.online)}</td></tr>
          </tfoot>
        </table></div>
      </div>
      <div class="card">
        <h2>Where the money went</h2>
        ${r.expense_categories.length ? r.expense_categories.map((c) => `
          <div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;font-size:.92rem"><span>${c.kind === 'house' ? '🏠' : '🏪'} ${esc(c.category)}</span><b>${money(c.amount)}</b></div>
          <div class="hbar ${c.kind}" style="width:${(c.amount / maxCat) * 100}%"></div></div>`).join('') : '<div class="empty">No expenses in this period.</div>'}
      </div>
    </div>
    <div class="card">
      <h2>Day by day milk</h2>
      ${r.daily.length ? `<div class="table-wrap"><table>
        <thead><tr><th>Date</th><th class="n">In (L)</th><th class="n">Out (L)</th><th class="n">Bought ₹</th><th class="n">Sold ₹</th></tr></thead>
        <tbody>${r.daily.map((d) => `<tr><td>${fmtDate(d.date)}</td><td class="n">${qty(d.qty_in)}</td><td class="n">${qty(d.qty_out)}</td><td class="n">${money(d.bought)}</td><td class="n">${money(d.sold)}</td></tr>`).join('')}</tbody>
      </table></div>` : '<div class="empty">No milk entries in this period.</div>'}
    </div>`;
  wireRange(main, (f, t) => { sessionStorage.setItem('rf', f); sessionStorage.setItem('rt', t); pageReports(f, t); });
  $('#print').onclick = () => window.print();
}

// ================= settings =================

async function pageSettings() {
  const main = shell('settings', 'Settings');
  const s = await loadSettings();
  main.innerHTML = `
    <div class="page-head"><h1>Settings</h1></div>
    <div class="cols">
      <form class="card" id="fs">
        <h2>Dairy details</h2>
        <div class="grid">
          ${field('Dairy name', `<input name="dairy_name" value="${esc(s.dairy_name)}" required>`)}
          ${field('Phone (shown to customers)', `<input name="dairy_phone" value="${esc(s.dairy_phone)}">`)}
          ${field('Address', `<input name="dairy_address" value="${esc(s.dairy_address)}">`)}
        </div>
        <h2 style="margin:16px 0 12px">Milk buying rates</h2>
        ${['cow', 'buffalo'].map((t) => `
          <div class="grid two">
            ${field(`${t === 'cow' ? '🐄 Cow' : '🐃 Buffalo'} rate type`, `<select name="${t}_rate_mode"><option value="liter">Fixed ₹ per litre</option><option value="fat" ${s[`${t}_rate_mode`] === 'fat' ? 'selected' : ''}>₹ per fat point (rate × fat)</option></select>`)}
            ${field('Rate ₹', `<input name="${t}_rate" type="number" step="0.01" min="0" value="${esc(s[`${t}_rate`])}">`)}
          </div>`).join('')}
        <p class="sub">Example: fat type with ₹7.50 and fat 6.5 → ₹48.75 per litre.</p>
        <h2 style="margin:16px 0 12px">Local selling rates (₹ per litre)</h2>
        <div class="grid two">
          ${field('🐄 Cow', `<input name="cow_sale_rate" type="number" step="0.01" min="0" value="${esc(s.cow_sale_rate)}">`)}
          ${field('🐃 Buffalo', `<input name="buffalo_sale_rate" type="number" step="0.01" min="0" value="${esc(s.buffalo_sale_rate)}">`)}
        </div>
        <h2 style="margin:16px 0 12px">Starting balances (when you began using the app)</h2>
        <div class="grid two">
          ${field('💵 Cash in hand', `<input name="opening_cash" type="number" step="0.01" value="${esc(s.opening_cash)}">`)}
          ${field('📱 Bank / online', `<input name="opening_bank" type="number" step="0.01" value="${esc(s.opening_bank)}">`)}
          ${field('🐄 Cow milk in storage (L)', `<input name="opening_stock_cow" type="number" step="0.01" value="${esc(s.opening_stock_cow)}">`)}
          ${field('🐃 Buffalo milk in storage (L)', `<input name="opening_stock_buffalo" type="number" step="0.01" value="${esc(s.opening_stock_buffalo)}">`)}
        </div>
        <button class="btn block" type="submit">Save settings</button>
      </form>
      <div>
        <div class="card">
          <h2>Customer login</h2>
          <p>Customers open <b>${esc(location.origin)}</b> on their phone and log in with their <b>mobile number + PIN</b>. Set the PIN in People → person → Edit.</p>
          <button class="btn ghost" id="copy">📋 Copy link</button>
        </div>
        <form class="card" id="fpw">
          <h2>Change owner password</h2>
          <div class="grid">
            ${field('Current password', '<input name="old_password" type="password" required autocomplete="current-password">')}
            ${field('New password', '<input name="new_password" type="password" minlength="4" required autocomplete="new-password">')}
          </div>
          <button class="btn" type="submit">Change password</button>
        </form>
        <div class="card">
          <h2>Backup</h2>
          <p class="sub">Download all your records as a file. Keep it safe (e.g. on Google Drive) every week.</p>
          <button class="btn ghost" id="backup">⬇️ Download backup</button>
        </div>
      </div>
    </div>`;
  onSubmit($('#fs'), async (d) => {
    await api('PUT', '/api/settings', d);
    S.status = null; await loadSettings();
    toast('Settings saved');
    router();
  });
  onSubmit($('#fpw'), async (d) => { await api('PUT', '/api/settings/password', d); toast('Password changed'); $('#fpw').reset(); });
  $('#copy').onclick = async () => { try { await navigator.clipboard.writeText(location.origin); toast('Link copied'); } catch { toast(location.origin); } };
  $('#backup').onclick = async () => {
    try {
      const data = await api('GET', '/api/backup');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }));
      a.download = `dairy-backup-${today()}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } catch (e) { toast(e.message, true); }
  };
}

// ================= customer portal =================

async function pagePortal(from, to) {
  const presets = rangePresets();
  from = from || presets[2][2];
  to = to || presets[2][3];
  app.innerHTML = `<header class="topbar"><img class="logo" src="icon.svg" alt=""><div class="title">${esc(S.status.dairy_name)}</div><button id="out">Log out</button></header><main id="main"><div class="empty">Loading…</div></main>`;
  $('#out').onclick = () => { location.hash = '#/logout'; };
  let d;
  try { d = await api('GET', `/api/portal?from=${from}&to=${to}`); } catch (e) { toast(e.message, true); return; }
  const p = d.party;
  const bal = p.balance;
  const msg = Math.abs(bal) < 0.005 ? 'All settled 👍' : bal > 0 ? 'Dairy will pay you' : 'You have to pay the dairy';
  const milk = d.entries.filter((e) => e.kind === 'milk_in');
  const fatW = milk.filter((e) => e.fat);
  const avgFat = fatW.length ? (fatW.reduce((s, e) => s + e.fat * e.qty, 0) / fatW.reduce((s, e) => s + e.qty, 0)).toFixed(1) : null;
  const paid = d.entries.filter((e) => e.kind === 'pay_out').reduce((s, e) => s + e.debit, 0);
  const main = $('#main');
  main.style.paddingBottom = '32px';
  main.innerHTML = `
    <div class="page-head"><div><h1>Hello, ${esc(p.name)} 🙏</h1><div class="sub">${[p.code ? 'Code ' + esc(p.code) : '', esc(p.village || '')].filter(Boolean).join(' · ')}</div></div></div>
    <div class="balance-card ${bal < 0 ? 'owe' : Math.abs(bal) < 0.005 ? 'zero' : ''}">
      <div class="lbl">${msg}</div>
      <div class="amt">${money(Math.abs(bal))}</div>
      ${d.dairy.phone ? `<div class="meta"><a href="tel:${esc(d.dairy.phone)}">📞 Call dairy: ${esc(d.dairy.phone)}</a></div>` : ''}
    </div>
    ${rangeBar(from, to)}
    <div class="grid four" style="margin-bottom:16px">
      <div class="stat"><div class="k">🥛 Milk given</div><div class="v">${qty(d.milk_qty)} L</div><div class="s">${avgFat ? 'Avg fat ' + avgFat : '&nbsp;'}</div></div>
      <div class="stat"><div class="k">Milk amount</div><div class="v">${money(d.milk_amount)}</div></div>
      <div class="stat"><div class="k">🌾 Feed (cut)</div><div class="v">${money(d.feed_amount)}</div></div>
      <div class="stat"><div class="k">💸 Paid to you</div><div class="v">${money(paid)}</div></div>
    </div>
    ${milk.length ? `<div class="card"><h2>🥛 Daily milk</h2><div class="table-wrap"><table>
      <thead><tr><th>Date</th><th class="n">Litres</th><th class="n">Fat</th><th class="n">Amount</th></tr></thead>
      <tbody>${milk.slice().reverse().map((e) => `<tr><td style="white-space:nowrap">${fmtDate(e.date)} ${e.shift === 'morning' ? '🌅' : '🌇'}<br><span class="badge ${e.milk_type}">${e.milk_type}</span></td>
        <td class="n">${qty(e.qty)}</td><td class="n">${e.fat ?? '–'}</td><td class="n">${money(e.credit)}<br><small class="sub">@ ₹${e.rate}</small></td></tr>`).join('')}</tbody>
      <tfoot><tr><td>Total</td><td class="n">${qty(d.milk_qty)}</td><td></td><td class="n">${money(d.milk_amount)}</td></tr></tfoot>
    </table></div></div>` : ''}
    <div class="card"><h2>📒 Full account</h2>${ledgerTable(d)}</div>`;
  wireRange(main, (f, t) => pagePortal(f, t));
}

router();
