'use strict';
/* Milk Dairy – single page web app (owner panel + customer portal).
   Every visible string goes through t() from i18n.js (English / ਪੰਜਾਬੀ). */

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
// Punjabi month/day names are built in: not every phone browser ships them.
const PA_MONTHS = ['ਜਨਵਰੀ', 'ਫ਼ਰਵਰੀ', 'ਮਾਰਚ', 'ਅਪ੍ਰੈਲ', 'ਮਈ', 'ਜੂਨ', 'ਜੁਲਾਈ', 'ਅਗਸਤ', 'ਸਤੰਬਰ', 'ਅਕਤੂਬਰ', 'ਨਵੰਬਰ', 'ਦਸੰਬਰ'];
const PA_DAYS = ['ਐਤਵਾਰ', 'ਸੋਮਵਾਰ', 'ਮੰਗਲਵਾਰ', 'ਬੁੱਧਵਾਰ', 'ਵੀਰਵਾਰ', 'ਸ਼ੁੱਕਰਵਾਰ', 'ਸ਼ਨਿੱਚਰਵਾਰ'];
function fmtDate(s, withYear = false) {
  if (!s) return '';
  const d = new Date(s + 'T00:00:00');
  if (getLang() === 'pa') return `${String(d.getDate()).padStart(2, '0')} ${PA_MONTHS[d.getMonth()]}${withYear ? ' ' + d.getFullYear() : ''}`;
  return d.toLocaleDateString('en-IN', withYear ? { day: '2-digit', month: 'short', year: 'numeric' } : { day: '2-digit', month: 'short' });
}
function fmtDay(s) {
  const d = new Date(s + 'T00:00:00');
  if (getLang() === 'pa') return `${PA_DAYS[d.getDay()]}, ${d.getDate()} ${PA_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}
const defaultShift = () => (new Date().getHours() < 14 ? 'morning' : 'evening');
const initials = (name) => String(name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

const KIND = () => ({
  farmer: t('Farmer (sells milk)'),
  buyer: t('Milk buyer'),
  company: t('Milk company'),
  feed: t('Feed customer'),
  supplier: t('Feed supplier'),
});
const KIND_SHORT = (k) => t({ farmer: 'Farmer', buyer: 'Buyer', company: 'Company', feed: 'Feed', supplier: 'Supplier' }[k] || k);
const MODE = (m) => t({ cash: 'Cash', online: 'Online', credit: 'Udhaar', account: 'Khata' }[m] || m);
const TYPE = (m) => t(m === 'cow' ? 'Cow' : 'Buffalo');
const typeBadge = (m) => `<span class="badge ${m}">${TYPE(m)}</span>`;
const SHIFT = (s) => (s === 'morning' ? '🌅 ' + t('Morning') : '🌇 ' + t('Evening'));

function balanceText(b) {
  if (Math.abs(b) < 0.005) return { text: t('All settled'), cls: '', short: t('Settled') };
  return b > 0
    ? { text: t('Dairy has to pay {amt}', { amt: money(b) }), cls: 'good', short: t('Pay {amt}', { amt: money(b) }) }
    : { text: t('Has to pay dairy {amt}', { amt: money(-b) }), cls: 'bad', short: t('Due {amt}', { amt: money(-b) }) };
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
  const box = $('#toast');
  box.textContent = err ? tError(msg) : t(msg);
  box.className = 'show' + (err ? ' err' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { box.className = ''; }, 2600);
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
const milkTypeSeg = (value = 'cow') => seg('milk_type', [['cow', '🐄 ' + t('Cow'), 'cow'], ['buffalo', '🐃 ' + t('Buffalo'), 'buffalo']], value);
const cashOnlineSeg = (value = 'cash') => seg('mode', [['cash', '💵 ' + t('Cash'), ''], ['online', '📱 ' + t('Online / UPI')]], value);

// Language switch button (used in the top bar, login and portal).
const langBtn = () => `<button type="button" class="lang-btn" data-lang="${getLang() === 'pa' ? 'en' : 'pa'}">${getLang() === 'pa' ? 'English' : 'ਪੰਜਾਬੀ'}</button>`;
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-lang]');
  if (!b) return;
  setLang(b.dataset.lang);
  router();
});

// ----- modal -----
const modal = $('#modal');
function openModal(title, html) {
  modal.innerHTML = `<div class="m-head"><h2>${esc(title)}</h2><button class="icon-btn" data-close aria-label="${t('Close')}">✕</button></div><div class="m-body">${html}</div>`;
  modal.showModal();
  $('[data-close]', modal).onclick = () => modal.close();
  return modal;
}
modal.addEventListener('click', (e) => { if (e.target === modal) modal.close(); });

async function confirmBox(msg) {
  return new Promise((resolve) => {
    openModal(t('Please confirm'), `<p>${esc(msg)}</p><div class="row-actions"><button class="btn danger" id="yes">${t('Yes, delete')}</button><button class="btn plain" id="no">${t('Cancel')}</button></div>`);
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
function picker(name, { placeholder = t('Search name / code / village'), kinds = [], value = null } = {}) {
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
  return `${esc(KIND_SHORT(p.kind))}${p.village ? ' · ' + esc(p.village) : ''} · <span class="${b.cls}-t">${b.text}</span>`;
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
        ? matches.map((p, i) => `<button type="button" data-i="${i}" class="${i === 0 ? 'hl' : ''}"><span>${esc(pLabel(p))}<br><small>${esc(p.village || '')} ${esc(p.phone || '')}</small></span><small>${esc(KIND_SHORT(p.kind))}</small></button>`).join('')
        : `<div class="empty">${t('No match. Add the person in “People”.')}</div>`;
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
    if (!(await confirmBox(t('Delete this entry? This cannot be undone.')))) return;
    try { await api('DELETE', b.dataset.del); toast('Deleted'); after(); } catch (err) { toast(err.message, true); }
  });
}
const delBtn = (path) => `<button class="icon-btn" data-del="${path}" aria-label="${t('Delete')}">🗑</button>`;

// ----- edit any entry -----
const ENTRY_PATH = {
  collection: '/api/milk/collections', sale: '/api/milk/sales', feedsale: '/api/feed/sales',
  purchase: '/api/feed/purchases', payment: '/api/payments', expense: '/api/expenses',
};
const editBtn = (kind, id) => `<button class="icon-btn edit" data-edit-entry="${kind}:${id}" aria-label="${t('Edit')}">✏️</button>`;
// ✏️ + 🗑 shown at the end of every entry line.
const rowActions = (kind, id) => `<div class="row-btns">${editBtn(kind, id)}${delBtn(`${ENTRY_PATH[kind]}/${id}`)}</div>`;

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-edit-entry]');
  if (!b) return;
  const [kind, id] = b.dataset.editEntry.split(':');
  editEntry(kind, Number(id)).catch((err) => toast(err.message, true));
});

const numField = (label, name, value, cls = '') =>
  field(label, `<input name="${name}" class="${cls}" type="number" step="0.01" min="0" inputmode="decimal" value="${value ?? ''}">`);
const dateField = (value) => field(t('Date'), `<input type="date" name="date" value="${esc(value)}" required>`);
const noteField = (value) => field(t('Note'), `<input name="note" value="${esc(value || '')}" placeholder="${t('Optional')}">`);
const allItemOptions = (sel) => S.items.map((i) =>
  `<option value="${i.id}" ${Number(sel) === i.id ? 'selected' : ''}>${esc(i.name)}</option>`).join('');

async function editEntry(kind, id) {
  const path = ENTRY_PATH[kind];
  if (!path) return;
  const [r] = await Promise.all([
    api('GET', `${path}/${id}`),
    S.parties.length ? null : loadParties(),
    ['feedsale', 'purchase'].includes(kind) && !S.items.length ? loadItems() : null,
  ]);
  const amountBox = `<div class="amount-preview"><span>${t('Amount')}</span><b id="eamt"></b></div>`;
  let html = '';
  if (kind === 'collection') {
    html = `
      <div class="grid">${dateField(r.date)}</div>
      <div class="grid">${field(t('Time'), seg('shift', [['morning', SHIFT('morning')], ['evening', SHIFT('evening')]], r.shift))}</div>
      <div class="grid">${field(t('Farmer'), picker('party_id', { kinds: ['farmer'], value: r.party_id }))}</div>
      <div class="grid">${field(t('Milk type'), milkTypeSeg(r.milk_type))}</div>
      <div class="grid three">${numField(t('Litres'), 'qty', r.qty, 'big')}${numField(t('Fat %'), 'fat', r.fat)}${numField(t('Rate ₹/L'), 'rate', r.rate)}</div>
      ${amountBox}`;
  } else if (kind === 'sale') {
    html = `
      <div class="grid">${field(t('Where did the milk go?'), seg('buyer_type', [['company', '🚚 ' + t('Company van')], ['local', '🏠 ' + t('Local sale')], ['wastage', '🗑 ' + t('Waste / home')]], r.buyer_type))}</div>
      <div class="grid">${dateField(r.date)}</div>
      <div class="grid">${field(t('Milk type'), milkTypeSeg(r.milk_type))}</div>
      <div class="grid" data-show="company local">${field(t('Buyer'), picker('party_id', { kinds: ['company', 'buyer'], value: r.party_id }))}</div>
      <div class="grid" data-show="local">${field(t('Or buyer name (walk-in)'), `<input name="buyer_name" value="${esc(r.buyer_name || '')}">`)}</div>
      <div class="grid three">${numField(t('Litres'), 'qty', r.qty, 'big')}${numField(t('Fat %'), 'fat', r.fat)}<span data-show="company local">${numField(t('Rate ₹/L'), 'rate', r.rate || '')}</span></div>
      <div data-show="company local">${amountBox}
        <div class="grid">${field(t('Payment'), seg('mode', [['credit', '📒 ' + t('Udhaar / later')], ['cash', '💵 ' + t('Cash')], ['online', '📱 ' + t('Online')]], r.mode))}</div></div>
      <div class="grid two"><span data-show="company">${field(t('Van / vehicle no.'), `<input name="vehicle" value="${esc(r.vehicle || '')}">`)}</span>${noteField(r.note)}</div>`;
  } else if (kind === 'feedsale') {
    html = `
      <div class="grid">${dateField(r.date)}</div>
      <div class="grid">${field(t('Customer'), picker('party_id', { kinds: ['farmer', 'feed'], value: r.party_id, placeholder: t('Search customer (leave empty for walk-in)') }))}</div>
      <div class="grid">${field(t('Or walk-in buyer name'), `<input name="buyer_name" value="${esc(r.buyer_name || '')}">`)}</div>
      <div class="grid">${field(t('Feed item'), `<select name="item_id" required>${allItemOptions(r.item_id)}</select>`)}</div>
      <div class="grid two">${numField(t('Quantity'), 'qty', r.qty, 'big')}${numField(t('Rate ₹'), 'rate', r.rate)}</div>
      ${amountBox}
      <div class="grid">${field(t('Payment'), seg('mode', [['account', '📒 ' + t('Cut from milk money')], ['cash', '💵 ' + t('Cash')], ['online', '📱 ' + t('Online')]], r.mode))}</div>
      <div class="grid">${noteField(r.note)}</div>`;
  } else if (kind === 'purchase') {
    html = `
      <div class="grid">${dateField(r.date)}</div>
      <div class="grid">${field(t('Feed item'), `<select name="item_id" required>${allItemOptions(r.item_id)}</select>`)}</div>
      <div class="grid two">${numField(t('Quantity'), 'qty', r.qty, 'big')}${numField(t('Rate ₹ (per unit)'), 'rate', r.rate)}</div>
      ${amountBox}
      <div class="grid">${field(t('Supplier'), picker('party_id', { kinds: ['supplier'], value: r.party_id, placeholder: t('Search supplier (optional)') }))}</div>
      <div class="grid">${field(t('Payment'), seg('mode', [['cash', '💵 ' + t('Cash')], ['online', '📱 ' + t('Online')], ['account', '📒 ' + t('Pay later')]], r.mode))}</div>
      <div class="grid">${noteField(r.note)}</div>`;
  } else if (kind === 'payment') {
    html = `
      <div class="grid">${seg('direction', [['out', '💸 ' + t('Dairy pays')], ['in', '📥 ' + t('Dairy receives')]], r.direction)}</div>
      <div class="grid">${field(t('Person'), picker('party_id', { value: r.party_id }))}</div>
      <div class="grid">${numField(t('Amount ₹'), 'amount', r.amount, 'big')}</div>
      <div class="grid">${field(t('Mode'), cashOnlineSeg(r.mode))}</div>
      <div class="grid two">${dateField(r.date)}${noteField(r.note)}</div>`;
  } else if (kind === 'expense') {
    html = `
      <div class="grid">${seg('kind', [['house', '🏠 ' + t('House')], ['business', '🏪 ' + t('Dairy business')]], r.kind)}</div>
      <div class="grid">${field(t('Spent on'), `<input name="category" list="ecats" value="${esc(t(r.category))}" required>
        <datalist id="ecats">${Object.values(EXP_CATS).flat().map((c) => `<option value="${esc(t(c))}">`).join('')}</datalist>`)}</div>
      <div class="grid">${numField(t('Amount ₹'), 'amount', r.amount, 'big')}</div>
      <div class="grid">${field(t('Paid by'), cashOnlineSeg(r.mode))}</div>
      <div class="grid two">${dateField(r.date)}${noteField(r.note)}</div>`;
  }
  const m = openModal(t('Edit entry'), `<form id="fedit" autocomplete="off">${html}
    <div class="row-actions" style="margin-top:12px"><button class="btn" type="submit">✓ ${t('Save changes')}</button>
    <button class="btn plain" type="button" data-close>${t('Cancel')}</button></div></form>`);
  $$('[data-close]', m).forEach((b) => { b.onclick = () => m.close(); });
  const f = $('#fedit', m);
  initPickers(m);

  const amt = $('#eamt', m);
  const upd = () => { if (amt) amt.textContent = money(r2((Number(f.qty?.value) || 0) * (Number(f.rate?.value) || 0))); };
  f.addEventListener('input', upd);
  upd();
  if (kind === 'sale') {
    const sync = () => {
      const bt = f.buyer_type.value;
      $$('[data-show]', f).forEach((el) => { el.hidden = !el.dataset.show.split(' ').includes(bt); });
    };
    $$('input[name=buyer_type]', f).forEach((x) => x.addEventListener('change', sync));
    sync();
  }

  onSubmit(f, async (d) => {
    if (kind === 'expense') {
      const match = Object.values(EXP_CATS).flat().find((c) => t(c) === d.category);
      if (match) d.category = match;
    }
    await api('PUT', `${path}/${id}`, d);
    m.close();
    toast('Saved');
    if (S.parties.length) await loadParties();
    router();
  });
}
const empty = (msg) => `<div class="empty">${t(msg)}</div>`;

// Range chooser used by reports, ledgers and the customer portal.
function rangePresets() {
  const now = today();
  const day = new Date(now + 'T00:00:00').getDate();
  const lastMonthEnd = addDays(monthStart(now), -1);
  // Common 10-day milk billing cycles: 1–10, 11–20, 21–end.
  const cycStart = day <= 10 ? 1 : day <= 20 ? 11 : 21;
  const cyc = now.slice(0, 8) + String(cycStart).padStart(2, '0');
  return [
    ['today', 'Today', now, now],
    ['cycle', 'This 10 days', cyc, now],
    ['month', 'This month', monthStart(now), now],
    ['lastmonth', 'Last month', monthStart(lastMonthEnd), lastMonthEnd],
    ['year', 'This year', now.slice(0, 4) + '-01-01', now],
  ];
}
function rangeBar(from, to) {
  const presets = rangePresets();
  const on = presets.findIndex(([, , f, tt]) => f === from && tt === to);
  return `<div class="chips no-print">${presets.map(([, label, f, tt], i) =>
    `<button type="button" class="chip ${i === on ? 'on' : ''}" data-range="${f}|${tt}">${t(label)}</button>`).join('')}</div>
    <form class="grid two no-print range-form" style="margin-bottom:16px">
      ${field(t('From'), `<input type="date" name="from" value="${from}" required>`)}
      ${field(t('To'), `<input type="date" name="to" value="${to}" required>`)}
    </form>`;
}
function wireRange(root, cb) {
  $$('[data-range]', root).forEach((b) => b.addEventListener('click', () => { const [f, tt] = b.dataset.range.split('|'); cb(f, tt); }));
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
      ${NAV.map(([k, ico, label]) => `<a href="#/${k}" class="${k === active ? 'on' : ''}"><span class="nav-ico">${ico}</span>${t(label)}</a>`).join('')}
      <div class="grow"></div>
      <a href="#/logout"><span class="nav-ico">🚪</span>${t('Log out')}</a>
    </nav>
    <div>
      <header class="topbar"><img class="logo" src="icon.svg" alt=""><div class="title">${esc(title ? t(title) : S.status?.dairy_name || 'Milk Dairy')}</div>${langBtn()}</header>
      <main id="main"></main>
    </div>
    <nav class="bottomnav">
      ${NAV.slice(0, 4).map(([k, ico, label]) => `<a href="#/${k}" class="${k === active ? 'on' : ''}"><span class="nav-ico">${ico}</span>${t(label)}</a>`).join('')}
      <a href="#/more" class="${isMore ? 'on' : ''}"><span class="nav-ico">☰</span>${t('More')}</a>
    </nav>
  </div>`;
  return $('#main');
}

async function router() {
  const hash = location.hash.replace(/^#\/?/, '') || '';
  const [page, ...rest] = hash.split('/');
  if (modal.open) modal.close();
  document.documentElement.lang = getLang();

  if (!S.status) {
    try { S.status = await api('GET', '/api/status'); } catch (e) { app.innerHTML = `<div class="boot">${t('Cannot reach the server.')} ${esc(e.message)}</div>`; return; }
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
    <div class="lang-row">${langBtn()}</div>
    <div class="hero"><img src="icon.svg" alt=""><h1>${t('Welcome! Let’s set up your dairy')}</h1><p class="sub">${t('This takes 10 seconds.')}</p></div>
    <form class="card" id="f">
      <div class="grid">
        ${field(t('Dairy name'), `<input name="dairy_name" placeholder="${t('e.g. Waheguru Milk Dairy')}" required>`)}
        ${field(t('Owner password (keep it secret)'), '<input name="password" type="password" minlength="4" required autocomplete="new-password">')}
        ${field(t('Type password again'), '<input name="password2" type="password" minlength="4" required autocomplete="new-password">')}
      </div>
      <button class="btn block" type="submit">${t('Start')}</button>
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
    <div class="lang-row">${langBtn()}</div>
    <div class="hero"><img src="icon.svg" alt=""><h1>${esc(S.status.dairy_name)}</h1>
      ${S.status.dairy_phone ? `<p class="sub">📞 ${esc(S.status.dairy_phone)}</p>` : ''}</div>
    <div class="card">
      <div style="margin-bottom:14px">${seg('who', [['customer', '👨‍🌾 ' + t('Customer')], ['admin', '🏪 ' + t('Dairy owner')]], tab)}</div>
      <form id="fc" ${tab !== 'customer' ? 'hidden' : ''}>
        <p class="sub" style="margin-top:0">${t('See your milk, feed and payment record.')}</p>
        <div class="grid">
          ${field(t('Mobile number'), '<input name="phone" type="tel" inputmode="numeric" required autocomplete="tel">')}
          ${field(t('PIN (ask the dairy)'), '<input name="pin" type="password" inputmode="numeric" pattern="[0-9]{4,6}" required>')}
        </div><br>
        <button class="btn block" type="submit">${t('See my account')}</button>
      </form>
      <form id="fa" ${tab !== 'admin' ? 'hidden' : ''}>
        <div class="grid">${field(t('Password'), '<input name="password" type="password" required autocomplete="current-password">')}</div><br>
        <button class="btn block" type="submit">${t('Log in')}</button>
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
  main.innerHTML = empty('Loading…');
  const d = await api('GET', `/api/dashboard?today=${today()}`);
  const m = d.month;
  const tm = (type, shift) => d.today_milk.filter((x) => x.milk_type === type && (!shift || x.shift === shift)).reduce((s, x) => s + x.qty, 0);
  const todayAmt = d.today_milk.reduce((s, x) => s + x.amount, 0);
  const split = (shift) => `${t('Cow')} ${qty(tm('cow', shift))} · ${t('Buffalo')} ${qty(tm('buffalo', shift))}`;

  // 7-day chart
  const days = Array.from({ length: 7 }, (_, i) => addDays(d.today, i - 6));
  const vals = days.map((day) => ({
    day,
    cow: d.week.filter((w) => w.date === day && w.milk_type === 'cow').reduce((s, w) => s + w.qty, 0),
    buf: d.week.filter((w) => w.date === day && w.milk_type === 'buffalo').reduce((s, w) => s + w.qty, 0),
  }));
  const max = Math.max(1, ...vals.map((v) => v.cow + v.buf));

  main.innerHTML = `
    <div class="page-head"><div><h1>${t('Namaste')} 🙏</h1><div class="sub">${fmtDay(d.today)}</div></div></div>

    <div class="quick">
      <a href="#/milk/collect"><span>🥛</span>${t('Milk entry')}</a>
      <a href="#/milk/out"><span>🚚</span>${t('Milk out / Sale')}</a>
      <a href="#/feed/sell"><span>🌾</span>${t('Sell feed')}</a>
      <a href="#/money"><span>💸</span>${t('Pay / Receive')}</a>
      <a href="#/expenses"><span>🧾</span>${t('Add expense')}</a>
    </div>

    ${d.low_feed.length ? `<div class="alert">⚠️ ${t('Feed stock low:')} ${d.low_feed.map((i) => `${esc(i.name)} (${qty(i.stock)} ${esc(t(i.unit))})`).join(', ')}</div>` : ''}

    <h2 style="margin-bottom:10px">❄️ ${t('Cold storage now')}</h2>
    <div class="grid two" style="margin-bottom:16px">
      <div class="stat cow"><div class="k">${t('Cow milk')}</div><div class="v">${qty(d.stock.cow)} ${t('L')}</div></div>
      <div class="stat buf"><div class="k">${t('Buffalo milk')}</div><div class="v">${qty(d.stock.buffalo)} ${t('L')}</div></div>
    </div>
    ${d.last_pickup ? `<p class="sub" style="margin:-8px 0 16px">${t('Last company pickup:')} ${fmtDate(d.last_pickup.date)} · ${qty(d.last_pickup.qty)} ${t('L')}</p>` : ''}

    <h2 style="margin-bottom:10px">${t('Today’s collection')}</h2>
    <div class="grid four" style="margin-bottom:16px">
      <div class="stat"><div class="k">${SHIFT('morning')}</div><div class="v">${qty(tm('cow', 'morning') + tm('buffalo', 'morning'))} ${t('L')}</div><div class="s">${split('morning')}</div></div>
      <div class="stat"><div class="k">${SHIFT('evening')}</div><div class="v">${qty(tm('cow', 'evening') + tm('buffalo', 'evening'))} ${t('L')}</div><div class="s">${split('evening')}</div></div>
      <div class="stat"><div class="k">${t('Milk bought today')}</div><div class="v">${money(todayAmt)}</div></div>
      <div class="stat"><div class="k">${t('Entries today')}</div><div class="v">${d.today_milk.reduce((s, x) => s + x.n, 0)}</div></div>
    </div>

    <h2 style="margin-bottom:10px">💰 ${t('Where is my money')}</h2>
    <div class="grid four" style="margin-bottom:16px">
      <div class="stat"><div class="k">💵 ${t('Cash in hand')}</div><div class="v">${money(d.money.cash)}</div></div>
      <div class="stat"><div class="k">📱 ${t('Online / Bank')}</div><div class="v">${money(d.money.online)}</div></div>
      <div class="stat good"><div class="k">${t('To receive (from people)')}</div><div class="v">${money(d.to_receive)}</div></div>
      <div class="stat bad"><div class="k">${t('To pay (to people)')}</div><div class="v">${money(d.to_pay)}</div></div>
    </div>

    <div class="cols">
      <div class="card">
        <div class="card-head"><h2>${t('This month')}</h2><a href="#/reports" class="btn sm ghost">${t('Full report')}</a></div>
        <div class="kv">
          <div>${t('Milk sold')}</div><div>${money(m.milk_sold.amount)}</div>
          <div>${t('Milk bought')}</div><div>− ${money(m.milk_bought.amount)}</div>
          <div>${t('Feed profit')}</div><div>${money(m.feed_margin)}</div>
          <div>${t('Business expenses')}</div><div>− ${money(m.business_expenses)}</div>
          <div class="total">${t('Business profit')}</div><div class="total ${m.profit >= 0 ? 'good-t' : 'bad-t'}">${money(m.profit)}</div>
          <div>${t('House expenses')}</div><div>− ${money(m.house_expenses)}</div>
          <div class="total">${t('Saved')}</div><div class="total ${m.savings >= 0 ? 'good-t' : 'bad-t'}">${money(m.savings)}</div>
        </div>
      </div>
      <div class="card">
        <h2>${t('Last 7 days milk collected')}</h2>
        <div class="bars">${vals.map((v) => `
          <div class="bar"><div class="val">${v.cow + v.buf ? qty(Math.round(v.cow + v.buf)) : ''}</div>
            <div class="stack" style="height:${((v.cow + v.buf) / max) * 100}%">
              <div class="seg-cow" style="flex:${v.cow}"></div><div class="seg-buf" style="flex:${v.buf}"></div>
            </div>
            <div class="lbl">${v.day.slice(8)}</div></div>`).join('')}
        </div>
        <div class="legend"><span><i style="background:var(--cow)"></i>${t('Cow')}</span><span><i style="background:var(--buf)"></i>${t('Buffalo')}</span></div>
      </div>
    </div>`;
}

function pageMore() {
  const main = shell('more', 'More');
  main.innerHTML = `
    <div class="quick">
      ${NAV.slice(4).map(([k, ico, label]) => `<a href="#/${k}"><span>${ico}</span>${t(label)}</a>`).join('')}
      <a href="#/logout"><span>🚪</span>${t('Log out')}</a>
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
      <a href="#/milk/collect" class="${tab === 'collect' ? 'on' : ''}">🥛 ${t('Buy from farmers')}</a>
      <a href="#/milk/scan" class="${tab === 'scan' ? 'on' : ''}">📷 ${t('From photo')}</a>
      <a href="#/milk/out" class="${tab === 'out' ? 'on' : ''}">🚚 ${t('Milk out / Sale')}</a>
    </div><div id="milkbody"></div>`;
  await loadParties();
  if (tab === 'out') return milkOut($('#milkbody'));
  if (tab === 'scan') return milkScan($('#milkbody'));
  return milkCollect($('#milkbody'));
}

function milkCollect(root) {
  const st = { date: sessionStorage.getItem('mc_date') || today(), shift: sessionStorage.getItem('mc_shift') || defaultShift() };
  const lastType = JSON.parse(lsGet('lastType') || '{}');
  const s = S.settings;
  const rateHint = (ty) => (s[`${ty}_rate_mode`] === 'fat' ? t('₹{r} × fat', { r: s[`${ty}_rate`] }) : t('₹{r} / L', { r: s[`${ty}_rate`] }));

  root.innerHTML = `
  <div class="cols">
    <form class="card" id="f" autocomplete="off">
      <h2>${t('New milk entry')}</h2>
      <div class="grid">
        ${field(t('Date'), `<input type="date" name="date" value="${st.date}" required>`)}
        ${field(t('Time'), seg('shift', [['morning', SHIFT('morning')], ['evening', SHIFT('evening')]], st.shift))}
      </div>
      <div class="grid">${field(t('Farmer'), picker('party_id', { kinds: ['farmer'] }))}</div>
      <div class="grid">${field(t('Milk type'), milkTypeSeg())}</div>
      <div class="grid three">
        ${field(t('Litres'), '<input name="qty" class="big" type="number" step="0.01" min="0" inputmode="decimal" required>')}
        ${field(t('Fat %'), '<input name="fat" type="number" step="0.1" min="0" inputmode="decimal">')}
        ${field(`${t('Rate ₹/L')} <small id="rh"></small>`, '<input name="rate" type="number" step="0.01" min="0" inputmode="decimal" required>')}
      </div>
      <div class="amount-preview"><span>${t('Amount')}</span><b id="amt">₹0</b></div>
      <button class="btn block" type="submit">✓ ${t('Save entry')}</button>
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
    $('#lh', root).textContent = `${fmtDate(st.date)} · ${SHIFT(st.shift)} (${rows.length})`;
    const ofType = (ty) => rows.filter((r) => r.milk_type === ty);
    const sum = (a, k) => a.reduce((acc, r) => acc + r[k], 0);
    const fatAvg = (a) => { const w = a.filter((r) => r.fat); const q = sum(w, 'qty'); return q ? (w.reduce((acc, r) => acc + r.fat * r.qty, 0) / q).toFixed(1) : '–'; };
    $('#tot', root).innerHTML = ['cow', 'buffalo'].map((ty) => `
      <div class="stat ${ty === 'cow' ? 'cow' : 'buf'}"><div class="k">${TYPE(ty)}</div><div class="v">${qty(sum(ofType(ty), 'qty'))} ${t('L')}</div><div class="s">${money(sum(ofType(ty), 'amount'))} · ${t('avg fat')} ${fatAvg(ofType(ty))}</div></div>`).join('');
    $('#list', root).innerHTML = rows.length ? `<div class="list">${rows.map((r) => `
      <div class="item">
        <div class="avatar">${esc(r.party_code || initials(r.party_name))}</div>
        <div class="main"><b>${esc(r.party_name)}</b><small>${typeBadge(r.milk_type)} ${qty(r.qty)} ${t('L')}${r.fat ? ` · ${t('fat')} ${r.fat}` : ''} · ₹${r.rate}/${t('L')}</small></div>
        <div class="end"><b>${money(r.amount)}</b></div>
        ${rowActions('collection', r.id)}
      </div>`).join('')}</div>` : empty('No entries yet for this time.');
  }
  wireDeletes($('#list', root), list);

  onSubmit(f, async (d) => {
    await api('POST', '/api/milk/collections', d);
    lastType[d.party_id] = d.milk_type;
    lsSet('lastType', JSON.stringify(lastType));
    const p = partyById(d.party_id);
    toast(t('Saved: {name} {qty} L', { name: p ? p.name : '', qty: d.qty }));
    f.qty.value = ''; f.fat.value = ''; rateTouched = false;
    pick.clear(); updRate();
    $('.picker-input', f).focus();
    list();
  });
  updRate();
  list();
}

// Shrink a phone photo before upload (keeps handwriting readable, saves data).
function photoToJpeg(file, maxSide = 2000) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, maxSide / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Please choose a photo')); };
    img.src = url;
  });
}

function milkScan(root) {
  if (!S.status.scan_enabled) {
    root.innerHTML = `<div class="card"><h2>📷 ${t('Milk entry from photo')}</h2>
      <p>${t('Take a photo of your milk register or receipt and the app fills in all entries for you to check.')}</p>
      <div class="alert">${t('Photo reading is not switched on yet. Add an Anthropic API key as ANTHROPIC_API_KEY in your server settings (see README), then restart.')}</div></div>`;
    return;
  }
  const farmers = S.parties.filter((p) => p.active).sort((a, b) => (a.kind === 'farmer' ? 0 : 1) - (b.kind === 'farmer' ? 0 : 1) || String(a.code || '').localeCompare(String(b.code || ''), undefined, { numeric: true }) || a.name.localeCompare(b.name));
  let rows = [];
  let photo = null;
  root.innerHTML = `
  <div class="cols">
    <form class="card" id="f">
      <h2>📷 ${t('Milk entry from photo')}</h2>
      <p class="sub" style="margin-top:0">${t('Take a clear photo of the whole page in good light. You will check every line before saving.')}</p>
      <div class="grid">
        ${field(t('Date'), `<input type="date" name="date" value="${sessionStorage.getItem('mc_date') || today()}" required>`)}
        ${field(t('Time'), seg('shift', [['morning', SHIFT('morning')], ['evening', SHIFT('evening')]], sessionStorage.getItem('mc_shift') || defaultShift()))}
      </div>
      <label class="btn ghost block" style="margin-bottom:12px">📷 ${t('Take / choose photo')}<input type="file" id="file" accept="image/*" capture="environment" hidden></label>
      <img id="preview" alt="" hidden style="width:100%;max-height:340px;object-fit:contain;border-radius:12px;margin-bottom:12px;background:var(--bg)">
      <button class="btn block" type="submit" id="read" disabled>🔍 ${t('Read photo')}</button>
      <p class="sub" id="status"></p>
    </form>
    <div class="card" id="review"><h2>${t('Check and save')}</h2>${empty('Lines read from the photo will show here.')}</div>
  </div>`;
  const f = $('#f', root);
  const review = $('#review', root);

  $('#file', root).addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      photo = await photoToJpeg(file);
      const img = $('#preview', root);
      img.src = photo; img.hidden = false;
      $('#read', root).disabled = false;
    } catch (err) { toast(err.message, true); }
  });

  onSubmit(f, async () => {
    if (!photo) throw new Error('Please choose a photo');
    $('#status', root).textContent = t('Reading the photo… this can take up to a minute.');
    try {
      const res = await api('POST', '/api/milk/scan', { image: photo.split(',')[1], media_type: 'image/jpeg' });
      if (res.date) f.date.value = res.date;
      if (res.shift) f.shift.value = res.shift;
      rows = res.rows.map((r) => ({
        ...r,
        milk_type: r.milk_type === 'unknown' ? (r.fat > 5.5 ? 'buffalo' : 'cow') : r.milk_type,
        unclear: r.unclear || r.milk_type === 'unknown' || !r.party_id,
        fat: r.fat || '',
        rate: rateFor(r.milk_type === 'buffalo' || (r.milk_type === 'unknown' && r.fat > 5.5) ? 'buffalo' : 'cow', r.fat) || '',
        keep: true,
      }));
      $('#status', root).textContent = rows.length
        ? t('Found {n} lines. Please check the yellow ones.', { n: rows.length })
        : t('No milk lines found. Try a clearer photo.');
      renderReview();
    } catch (err) {
      $('#status', root).textContent = '';
      throw err;
    }
  });

  function renderReview() {
    const kept = rows.filter((r) => r.keep);
    const totQ = kept.reduce((a, r) => a + (Number(r.qty) || 0), 0);
    const totA = kept.reduce((a, r) => a + r2((Number(r.qty) || 0) * (Number(r.rate) || 0)), 0);
    review.innerHTML = `<h2>${t('Check and save')}</h2>
      ${rows.length ? `<div class="list">${rows.map((r, i) => r.keep ? `
        <div class="scan-row ${r.unclear ? 'warn' : ''}" data-i="${i}">
          <div class="scan-top">
            <small>${t('On paper:')} <b>${esc([r.code, r.name].filter(Boolean).join(' · ') || '?')}</b>${r.unclear ? ` <span class="badge warn">${t('Please check')}</span>` : ''}</small>
            ${delBtnRow(i)}
          </div>
          <select data-k="party_id"><option value="">— ${t('Choose farmer')} —</option>${farmers.map((p) => `<option value="${p.id}" ${p.id === r.party_id ? 'selected' : ''}>${esc(pLabel(p))}</option>`).join('')}</select>
          <div class="scan-grid">
            ${field(t('Milk type'), `<select data-k="milk_type"><option value="cow" ${r.milk_type === 'cow' ? 'selected' : ''}>🐄 ${t('Cow')}</option><option value="buffalo" ${r.milk_type === 'buffalo' ? 'selected' : ''}>🐃 ${t('Buffalo')}</option></select>`)}
            ${field(t('Litres'), `<input data-k="qty" type="number" step="0.01" min="0" inputmode="decimal" value="${r.qty}">`)}
            ${field(t('Fat'), `<input data-k="fat" type="number" step="0.1" min="0" inputmode="decimal" value="${r.fat}">`)}
            ${field(t('Rate ₹/L'), `<input data-k="rate" type="number" step="0.01" min="0" inputmode="decimal" value="${r.rate}">`)}
          </div>
          <div class="sub">${t('Amount')}: <b>${money(r2((Number(r.qty) || 0) * (Number(r.rate) || 0)))}</b>${r.amount ? ` · ${t('on paper')} ${money(r.amount)}` : ''}</div>
        </div>` : '').join('')}</div>
        <div class="amount-preview" style="margin-top:12px"><span>${kept.length} · ${qty(totQ)} ${t('L')}</span><b>${money(totA)}</b></div>
        <button class="btn block" id="saveall" ${kept.length ? '' : 'disabled'}>✓ ${t('Save all {n} entries', { n: kept.length })}</button>`
      : empty('Lines read from the photo will show here.')}`;
    const btn = $('#saveall', review);
    if (btn) btn.onclick = saveAll;
  }
  const delBtnRow = (i) => `<button type="button" class="icon-btn" data-drop="${i}" aria-label="${t('Delete')}">✕</button>`;

  review.addEventListener('click', (e) => {
    const b = e.target.closest('[data-drop]');
    if (b) { rows[Number(b.dataset.drop)].keep = false; renderReview(); }
  });
  review.addEventListener('change', (e) => {
    const el = e.target.closest('[data-k]');
    if (!el) return;
    const r = rows[Number(el.closest('[data-i]').dataset.i)];
    const k = el.dataset.k;
    r[k] = k === 'party_id' ? Number(el.value) || null : el.value;
    if (k === 'party_id' && r.party_id) r.unclear = false;
    if (k === 'rate') r.rateTouched = true;
    if ((k === 'fat' || k === 'milk_type') && !r.rateTouched) r.rate = rateFor(r.milk_type, r.fat) || '';
    renderReview();
  });

  async function saveAll() {
    const kept = rows.filter((r) => r.keep);
    const missing = kept.findIndex((r) => !r.party_id);
    if (missing >= 0) { toast(t('Line {n}: please choose the farmer', { n: missing + 1 }), true); return; }
    const btn = $('#saveall', review);
    btn.disabled = true;
    try {
      const d = formData(f);
      const res = await api('POST', '/api/milk/collections/bulk', {
        date: d.date, shift: d.shift,
        rows: kept.map((r) => ({ party_id: r.party_id, milk_type: r.milk_type, qty: r.qty, fat: r.fat, snf: r.snf || '', rate: r.rate })),
      });
      sessionStorage.setItem('mc_date', d.date); sessionStorage.setItem('mc_shift', d.shift);
      toast(t('{n} entries saved', { n: res.saved }));
      location.hash = '#/milk/collect';
    } catch (err) {
      toast(err.message, true);
      btn.disabled = false;
    }
  }
}

function milkOut(root) {
  const last = JSON.parse(lsGet('lastOut') || '{}');
  root.innerHTML = `
  <div class="grid two" id="stock" style="margin-bottom:16px"></div>
  <div class="cols">
    <form class="card" id="f" autocomplete="off">
      <h2>${t('Milk going out of cold storage')}</h2>
      <div class="grid">${field(t('Where did the milk go?'), seg('buyer_type', [['company', '🚚 ' + t('Company van')], ['local', '🏠 ' + t('Local sale')], ['wastage', '🗑 ' + t('Waste / home')]], last.buyer_type || 'company'))}</div>
      <div class="grid two">
        ${field(t('Date'), `<input type="date" name="date" value="${today()}" required>`)}
        ${field(t('Milk type'), milkTypeSeg())}
      </div>
      <div class="grid" data-show="company local">${field('<span id="plbl"></span>', picker('party_id', { kinds: ['company'] }))}</div>
      <div class="grid" data-show="local">${field(t('Or buyer name (walk-in)'), `<input name="buyer_name" placeholder="${t('Optional')}">`)}</div>
      <div class="grid three">
        ${field(t('Litres'), '<input name="qty" class="big" type="number" step="0.01" min="0" inputmode="decimal" required>')}
        ${field(t('Fat %'), '<input name="fat" type="number" step="0.1" min="0" inputmode="decimal">')}
        <span data-show="company local">${field(t('Rate ₹/L'), '<input name="rate" type="number" step="0.01" min="0" inputmode="decimal">')}</span>
      </div>
      <div data-show="company local">
        <div class="amount-preview"><span>${t('Amount')}</span><b id="amt">₹0</b></div>
        <div class="grid">${field(t('Payment'), seg('mode', [['credit', '📒 ' + t('Udhaar / later')], ['cash', '💵 ' + t('Cash')], ['online', '📱 ' + t('Online')]], 'credit'))}</div>
      </div>
      <div class="grid two">
        <span data-show="company">${field(t('Van / vehicle no.'), `<input name="vehicle" value="${esc(last.vehicle || '')}">`)}</span>
        ${field(t('Note'), `<input name="note" placeholder="${t('Optional')}">`)}
      </div>
      <button class="btn block" type="submit">✓ ${t('Save')}</button>
    </form>
    <div class="card"><h2>${t('Recent (last 30 days)')}</h2><div id="list"></div></div>
  </div>`;
  const f = $('#f', root);
  initPickers(root);
  const pick = $('.picker', f);
  const upd = () => { $('#amt', root).textContent = money(r2((Number(f.qty.value) || 0) * (Number(f.rate.value) || 0))); };
  const defaultRate = () => {
    const bt = f.buyer_type.value; const ty = f.milk_type.value;
    if (bt === 'local') f.rate.value = S.settings[`${ty}_sale_rate`] || '';
    else if (bt === 'company') f.rate.value = last[`company_${ty}`] || '';
    upd();
  };
  const sync = () => {
    const bt = f.buyer_type.value;
    $$('[data-show]', f).forEach((el) => { el.hidden = !el.dataset.show.split(' ').includes(bt); });
    $('#plbl', f).textContent = bt === 'company' ? t('Company') : t('Buyer (from people list – needed for udhaar)');
    pick.dataset.kinds = bt === 'company' ? 'company' : 'buyer';
    if (bt === 'local' && f.mode.value === 'credit' && !f.party_id.value) f.mode.value = 'cash';
    if (bt === 'company') {
      f.mode.value = 'credit';
      const c = S.parties.find((p) => p.kind === 'company' && p.active);
      if (c && !f.party_id.value) { f.party_id.value = c.id; $('.picker-input', f).value = pLabel(c); }
    }
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
      <div class="stat cow"><div class="k">❄️ ${t('Cow milk in storage')}</div><div class="v">${qty(dash.stock.cow)} ${t('L')}</div></div>
      <div class="stat buf"><div class="k">❄️ ${t('Buffalo milk in storage')}</div><div class="v">${qty(dash.stock.buffalo)} ${t('L')}</div></div>`;
    const icon = { company: '🚚', local: '🏠', wastage: '🗑' };
    $('#list', root).innerHTML = rows.length ? `<div class="list">${rows.map((r) => `
      <div class="item">
        <div class="avatar">${icon[r.buyer_type]}</div>
        <div class="main"><b>${esc(r.party_name || r.buyer_name || (r.buyer_type === 'wastage' ? t('Waste / home use') : t('Local sale')))}</b>
          <small>${fmtDate(r.date)} · ${typeBadge(r.milk_type)} ${qty(r.qty)} ${t('L')}${r.fat ? ` · ${t('fat')} ${r.fat}` : ''}${r.vehicle ? ` · ${esc(r.vehicle)}` : ''}</small></div>
        <div class="end"><b>${r.buyer_type === 'wastage' ? '–' : money(r.amount)}</b>${r.buyer_type !== 'wastage' ? `<small>${MODE(r.mode)}</small>` : ''}</div>
        ${rowActions('sale', r.id)}
      </div>`).join('')}</div>` : empty('Nothing yet.');
  }
  wireDeletes($('#list', root), refresh);

  onSubmit(f, async (d) => {
    await api('POST', '/api/milk/sales', d);
    last.buyer_type = d.buyer_type;
    if (d.buyer_type === 'company') { last[`company_${d.milk_type}`] = d.rate; last.vehicle = d.vehicle; }
    lsSet('lastOut', JSON.stringify(last));
    toast(t('Saved: {qty} L {type}', { qty: d.qty, type: TYPE(d.milk_type) }));
    f.qty.value = ''; f.fat.value = ''; f.note.value = '';
    upd(); refresh();
  });
  sync();
  refresh();
}

// ================= feed =================

const UNITS = ['bag', 'kg', 'quintal', 'packet', 'litre', 'piece'];

async function pageFeed(tab = 'sell') {
  const main = shell('feed', 'Feed');
  main.innerHTML = `<div class="tabs">
      <a href="#/feed/sell" class="${tab === 'sell' ? 'on' : ''}">🌾 ${t('Sell feed')}</a>
      <a href="#/feed/stock" class="${tab === 'stock' ? 'on' : ''}">📦 ${t('Stock & items')}</a>
      <a href="#/feed/buy" class="${tab === 'buy' ? 'on' : ''}">🚛 ${t('Buy stock')}</a>
    </div><div id="feedbody"></div>`;
  await Promise.all([loadParties(), loadItems()]);
  const body = $('#feedbody');
  if (!S.items.length && tab !== 'stock') {
    body.innerHTML = `<div class="card empty"><p>${t('First add your feed items (like Khal, Choker, Feed bag, Mineral mixture).')}</p><a class="btn" href="#/feed/stock">+ ${t('Add feed items')}</a></div>`;
    return;
  }
  if (tab === 'stock') return feedStock(body);
  if (tab === 'buy') return feedBuy(body);
  return feedSell(body);
}

const itemOptions = (sel) => S.items.filter((i) => i.active).map((i) =>
  `<option value="${i.id}" ${Number(sel) === i.id ? 'selected' : ''}>${esc(i.name)} — ${t('stock')} ${qty(i.stock)} ${esc(t(i.unit))}</option>`).join('');

function feedSell(root) {
  root.innerHTML = `
  <div class="cols">
    <form class="card" id="f" autocomplete="off">
      <h2>${t('Sell feed')}</h2>
      <div class="grid">${field(t('Customer'), picker('party_id', { kinds: ['farmer', 'feed'], placeholder: t('Search customer (leave empty for walk-in)') }))}</div>
      <div class="grid" id="walkin">${field(t('Or walk-in buyer name'), `<input name="buyer_name" placeholder="${t('Optional')}">`)}</div>
      <div class="grid">${field(t('Feed item'), `<select name="item_id" required>${itemOptions()}</select>`)}</div>
      <div class="grid two">
        ${field(t('Quantity'), '<input name="qty" class="big" type="number" step="0.01" min="0" inputmode="decimal" required>')}
        ${field(t('Rate ₹'), '<input name="rate" type="number" step="0.01" min="0" inputmode="decimal" required>')}
      </div>
      <div class="amount-preview"><span>${t('Amount')}</span><b id="amt">₹0</b></div>
      <div class="grid">${field(t('Payment'), seg('mode', [['account', '📒 ' + t('Cut from milk money')], ['cash', '💵 ' + t('Cash')], ['online', '📱 ' + t('Online')]], 'cash'))}</div>
      <div class="grid two">
        ${field(t('Date'), `<input type="date" name="date" value="${today()}" required>`)}
        ${field(t('Note'), `<input name="note" placeholder="${t('Optional')}">`)}
      </div>
      <button class="btn block" type="submit">✓ ${t('Save sale')}</button>
    </form>
    <div class="card"><h2>${t('Recent feed sales')}</h2><div id="list"></div></div>
  </div>`;
  const f = $('#f', root);
  initPickers(root);
  const upd = () => { $('#amt', root).textContent = money(r2((Number(f.qty.value) || 0) * (Number(f.rate.value) || 0))); };
  const setRate = () => { const i = S.items.find((x) => x.id === Number(f.item_id.value)); if (i) f.rate.value = i.sale_price || ''; upd(); };
  f.item_id.addEventListener('change', setRate);
  f.qty.addEventListener('input', upd); f.rate.addEventListener('input', upd);
  $('.picker', f).addEventListener('picked', (e) => {
    $('#walkin', root).hidden = !!e.detail;
    if (e.detail && e.detail.kind === 'farmer') f.mode.value = 'account';
    f.qty.focus();
  });

  async function list() {
    const rows = await api('GET', `/api/feed/sales?from=${addDays(today(), -30)}`);
    $('#list', root).innerHTML = rows.length ? `<div class="list">${rows.map((r) => `
      <div class="item">
        <div class="avatar">🌾</div>
        <div class="main"><b>${esc(r.party_name || r.buyer_name || t('Walk-in'))}</b><small>${fmtDate(r.date)} · ${esc(r.item)} · ${qty(r.qty)} ${esc(t(r.unit))} @ ₹${r.rate}</small></div>
        <div class="end"><b>${money(r.amount)}</b><small>${MODE(r.mode)}</small></div>
        ${rowActions('feedsale', r.id)}
      </div>`).join('')}</div>` : empty('No feed sold in last 30 days.');
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
    <div class="card-head"><h2>${t('Feed items & stock')}</h2><button class="btn sm" id="add">+ ${t('Add item')}</button></div>
    ${S.items.length ? `<div class="table-wrap"><table>
      <thead><tr><th>${t('Item')}</th><th class="n">${t('Stock')}</th><th class="n">${t('Buy ₹')}</th><th class="n">${t('Sell ₹')}</th><th class="n">${t('Stock value')}</th><th></th></tr></thead>
      <tbody>${S.items.map((i) => `<tr>
        <td><b>${esc(i.name)}</b> ${!i.active ? `<span class="badge">${t('hidden')}</span>` : ''}<br><small class="sub">${t('per {unit}', { unit: esc(t(i.unit)) })}</small></td>
        <td class="n"><span class="badge ${i.stock <= i.low_stock ? 'warn' : 'good'}">${qty(i.stock)} ${esc(t(i.unit))}</span></td>
        <td class="n">${money(i.purchase_price)}</td><td class="n">${money(i.sale_price)}</td>
        <td class="n">${money(i.stock * i.purchase_price)}</td>
        <td class="n"><button class="btn sm plain" data-edit="${i.id}">${t('Edit')}</button></td></tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="4">${t('Total stock value')}</td><td class="n">${money(S.items.reduce((s, i) => s + Math.max(0, i.stock) * i.purchase_price, 0))}</td><td></td></tr></tfoot>
    </table></div>` : empty('No feed items yet.')}
  </div>`;
  $('#add', root).onclick = () => itemForm();
  $$('[data-edit]', root).forEach((b) => (b.onclick = () => itemForm(S.items.find((i) => i.id === Number(b.dataset.edit)))));

  function itemForm(it) {
    const i = it || { unit: 'bag', low_stock: 5, active: 1 };
    const m = openModal(it ? t('Edit feed item') : t('New feed item'), `
      <form id="fi">
        <div class="grid">${field(t('Name'), `<input name="name" value="${esc(i.name || '')}" placeholder="${t('e.g. Cattle feed 50kg')}" required>`)}</div>
        <div class="grid two">
          ${field(t('Unit'), `<select name="unit">${UNITS.map((u) => `<option value="${u}" ${u === i.unit ? 'selected' : ''}>${t(u)}</option>`).join('')}</select>`)}
          ${field(t('Opening stock'), `<input name="opening_stock" type="number" step="0.01" value="${i.opening_stock ?? 0}">`)}
          ${field(t('Purchase price ₹'), `<input name="purchase_price" type="number" step="0.01" min="0" value="${i.purchase_price ?? ''}">`)}
          ${field(t('Sale price ₹'), `<input name="sale_price" type="number" step="0.01" min="0" value="${i.sale_price ?? ''}">`)}
          ${field(t('Warn when stock below'), `<input name="low_stock" type="number" step="0.01" min="0" value="${i.low_stock}">`)}
          ${field(t('Show in lists'), `<select name="active"><option value="1">${t('Yes')}</option><option value="0" ${!i.active ? 'selected' : ''}>${t('No (hide)')}</option></select>`)}
        </div>
        <button class="btn block" type="submit">${t('Save')}</button>
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
      <h2>${t('Buy feed stock (bulk)')}</h2>
      <div class="grid">${field(t('Feed item'), `<select name="item_id" required>${itemOptions()}</select>`)}</div>
      <div class="grid two">
        ${field(t('Quantity'), '<input name="qty" class="big" type="number" step="0.01" min="0" inputmode="decimal" required>')}
        ${field(t('Rate ₹ (per unit)'), '<input name="rate" type="number" step="0.01" min="0" inputmode="decimal" required>')}
      </div>
      <div class="amount-preview"><span>${t('Total')}</span><b id="amt">₹0</b></div>
      <div class="grid">${field(t('Supplier'), picker('party_id', { kinds: ['supplier'], placeholder: t('Search supplier (optional)') }))}</div>
      <div class="grid">${field(t('Payment'), seg('mode', [['cash', '💵 ' + t('Cash')], ['online', '📱 ' + t('Online')], ['account', '📒 ' + t('Pay later')]], 'cash'))}</div>
      <div class="grid two">
        ${field(t('Date'), `<input type="date" name="date" value="${today()}" required>`)}
        ${field(t('Note / bill no.'), `<input name="note" placeholder="${t('Optional')}">`)}
      </div>
      <button class="btn block" type="submit">✓ ${t('Add to stock')}</button>
    </form>
    <div class="card"><h2>${t('Recent purchases')}</h2><div id="list"></div></div>
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
        <div class="main"><b>${esc(r.item)}</b><small>${fmtDate(r.date)} · ${qty(r.qty)} ${esc(t(r.unit))} @ ₹${r.rate}${r.party_name ? ' · ' + esc(r.party_name) : ''}</small></div>
        <div class="end"><b>${money(r.amount)}</b><small>${r.mode === 'account' ? t('Pay later') : MODE(r.mode)}</small></div>
        ${rowActions('purchase', r.id)}
      </div>`).join('')}</div>` : empty('No purchases in last 90 days.');
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
    <div class="page-head"><h1>${t('People')}</h1><button class="btn" id="add">+ ${t('Add person')}</button></div>
    <div class="grid two" id="sum" style="margin-bottom:16px"></div>
    <input id="q" type="search" placeholder="🔍 ${t('Search name, code, village, phone')}" style="margin-bottom:12px">
    <div class="chips" id="chips"></div>
    <div class="card"><div class="list" id="list"></div></div>`;
  const toPay = S.parties.filter((p) => p.balance > 0).reduce((s, p) => s + p.balance, 0);
  const toGet = S.parties.filter((p) => p.balance < 0).reduce((s, p) => s - p.balance, 0);
  $('#sum').innerHTML = `
    <div class="stat bad"><div class="k">${t('Dairy has to pay')}</div><div class="v">${money(toPay)}</div></div>
    <div class="stat good"><div class="k">${t('Dairy will receive')}</div><div class="v">${money(toGet)}</div></div>`;
  const chips = [['all', 'All'], ['farmer', 'Farmers'], ['buyer', 'Buyers'], ['company', 'Company'], ['feed', 'Feed'], ['supplier', 'Suppliers'], ['pay', 'To pay'], ['due', 'To receive'], ['inactive', 'Hidden']];
  const kinds = KIND();
  const render = () => {
    $('#chips').innerHTML = chips.map(([k, l]) => `<button class="chip ${k === filter ? 'on' : ''}" data-k="${k}">${t(l)}</button>`).join('');
    const rows = S.parties.filter((p) => {
      if (filter === 'inactive') { if (p.active) return false; } else if (!p.active) return false;
      if (filter === 'pay' && !(p.balance > 0)) return false;
      if (filter === 'due' && !(p.balance < 0)) return false;
      if (kinds[filter] && p.kind !== filter) return false;
      return !q || [p.name, p.code, p.village, p.phone].some((x) => x && String(x).toLowerCase().includes(q));
    });
    $('#list').innerHTML = rows.length ? rows.map((p) => {
      const b = balanceText(p.balance);
      return `<a class="item" href="#/people/${p.id}">
        <div class="avatar">${esc(p.code || initials(p.name))}</div>
        <div class="main"><b>${esc(p.name)}</b><small>${esc(KIND_SHORT(p.kind))}${p.village ? ' · ' + esc(p.village) : ''}${p.phone ? ' · ' + esc(p.phone) : ''}</small></div>
        <div class="end"><span class="badge ${b.cls}">${b.short}</span></div></a>`;
    }).join('') : empty('Nobody here yet. Tap “+ Add person”.');
  };
  $('#chips').addEventListener('click', (e) => { const b = e.target.closest('[data-k]'); if (b) { filter = b.dataset.k; sessionStorage.setItem('pf', filter); render(); } });
  $('#q').addEventListener('input', (e) => { q = e.target.value.trim().toLowerCase(); render(); });
  $('#add').onclick = () => personForm(null, (p) => { location.hash = `#/people/${p.id}`; });
  render();
}

function personForm(p, done) {
  const x = p || { kind: 'farmer', active: 1, opening_balance: 0 };
  const m = openModal(p ? t('Edit person') : t('Add person'), `
    <form id="fp" autocomplete="off">
      <div class="grid">${field(t('Type'), `<select name="kind">${Object.entries(KIND()).map(([k, l]) => `<option value="${k}" ${k === x.kind ? 'selected' : ''}>${l}</option>`).join('')}</select>`)}</div>
      <div class="grid two">
        ${field(t('Name'), `<input name="name" value="${esc(x.name || '')}" required>`)}
        ${field(t('Code / number'), `<input name="code" value="${esc(x.code || '')}" placeholder="${t('e.g. 12')}">`)}
        ${field(t('Mobile'), `<input name="phone" type="tel" inputmode="tel" value="${esc(x.phone || '')}">`)}
        ${field(t('Village'), `<input name="village" value="${esc(x.village || '')}">`)}
      </div>
      <div class="grid">${field(t('Old balance (when starting the app)'), seg('ob_dir', [['pay', t('Dairy has to pay')], ['get', t('They have to pay')]], (x.opening_balance || 0) < 0 ? 'get' : 'pay'))}
        <input name="ob" type="number" step="0.01" min="0" inputmode="decimal" value="${Math.abs(x.opening_balance || 0) || ''}" placeholder="₹ 0">
      </div>
      <div class="grid two">
        ${field(p && p.has_pin ? t('Customer login PIN (already set – type to change)') : t('Customer login PIN (4–6 digits)'), `<input name="pin" inputmode="numeric" pattern="[0-9]{4,6}" placeholder="${t('Optional')}">`)}
        ${field(t('Status'), `<select name="active"><option value="1">${t('Active')}</option><option value="0" ${x.active ? '' : 'selected'}>${t('Hidden')}</option></select>`)}
      </div>
      <div class="grid">${field(t('Note'), `<input name="note" value="${esc(x.note || '')}">`)}</div>
      <p class="sub">${t('With mobile + PIN the person can log in and see their own record.')}</p>
      <button class="btn block" type="submit">${t('Save')}</button>
      ${p && p.has_pin ? `<br><br><button type="button" class="btn plain block" id="rmpin">${t('Remove login PIN')}</button>` : ''}
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

// Ledger lines are built here (not on the server) so they can be translated.
function ledgerDesc(r) {
  const L = t('L');
  const mode = r.mode ? ` · ${MODE(r.mode)}` : '';
  const note = r.note ? ` – ${r.note}` : '';
  switch (r.kind) {
    case 'milk_in': return `${t('Milk given')} – ${TYPE(r.milk_type)}, ${SHIFT(r.shift)} (${qty(r.qty)} ${L}${r.fat ? `, ${t('fat')} ${r.fat}` : ''} @ ₹${r.rate})`;
    case 'milk_out': return `${t('Milk taken')} – ${TYPE(r.milk_type)} (${qty(r.qty)} ${L} @ ₹${r.rate})${mode}`;
    case 'feed': return `${t('Feed')} – ${r.item} (${qty(r.qty)} ${t(r.unit)} @ ₹${r.rate})${mode}`;
    case 'feed_supply': return `${t('Feed supplied')} – ${r.item} (${qty(r.qty)} ${t(r.unit)} @ ₹${r.rate})${mode}`;
    case 'pay_out': return `${t('Paid by dairy')} (${MODE(r.mode)})${note}`;
    case 'pay_in': return `${t('Received by dairy')} (${MODE(r.mode)})${note}`;
    default: return r.desc;
  }
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
    <div class="page-head no-print"><a href="#/people" class="btn sm plain">← ${t('People')}</a>
      <div class="row-actions">
        <button class="btn sm ghost" id="edit">✏️ ${t('Edit')}</button>
        <button class="btn sm ghost" id="print">🖨 ${t('Print')}</button>
        ${p.phone ? `<button class="btn sm ghost" id="wa">💬 WhatsApp</button>` : ''}
      </div></div>
    <div class="print-only"><h1>${esc(S.status.dairy_name)}</h1><p>${t('Statement')} ${fmtDate(from, true)} – ${fmtDate(to, true)}</p></div>
    <div class="balance-card ${p.balance < 0 ? 'owe' : Math.abs(p.balance) < 0.005 ? 'zero' : ''}">
      <div class="lbl">${esc(p.code ? p.code + ' · ' : '')}${esc(p.name)} · ${esc(KIND_SHORT(p.kind))}</div>
      <div class="amt">${money(Math.abs(p.balance))}</div>
      <div class="lbl">${b.text}</div>
      <div class="meta">${p.village ? esc(p.village) + ' · ' : ''}${p.phone ? `<a href="tel:${esc(p.phone)}">📞 ${esc(p.phone)}</a>` : t('No mobile')} · ${p.has_pin ? '🔓 ' + t('Can log in') : '🔒 ' + t('No login PIN')}</div>
    </div>
    <div class="row-actions no-print" style="margin-bottom:16px">
      <button class="btn" id="pay">💸 ${t('Dairy pays')} ${p.balance > 0 ? money(p.balance) : ''}</button>
      <button class="btn ghost" id="recv">📥 ${t('Receive money')}</button>
    </div>
    ${rangeBar(from, to)}
    <div class="grid four" style="margin-bottom:16px">
      <div class="stat"><div class="k">${t('Milk given')}</div><div class="v">${qty(l.milk_qty)} ${t('L')}</div><div class="s">${money(l.milk_amount)}</div></div>
      <div class="stat"><div class="k">${t('Feed taken (khata)')}</div><div class="v">${money(l.feed_amount)}</div></div>
      <div class="stat"><div class="k">${t('Paid by dairy')}</div><div class="v">${money(paidOut)}</div></div>
      <div class="stat"><div class="k">${t('Received by dairy')}</div><div class="v">${money(paidIn)}</div></div>
    </div>
    <div class="card">
      <h2>${t('Record')} ${fmtDate(from)} – ${fmtDate(to)}</h2>
      ${ledgerTable(l, true)}
    </div>`;
  wireRange(main, (f, tt) => { sessionStorage.setItem('lf', f); sessionStorage.setItem('lt', tt); pagePerson(id, f, tt); });
  $('#edit').onclick = () => personForm(partyById(id), () => pagePerson(id, from, to));
  $('#print').onclick = () => window.print();
  $('#pay').onclick = () => paymentForm(p, 'out', () => pagePerson(id, from, to));
  $('#recv').onclick = () => paymentForm(p, 'in', () => pagePerson(id, from, to));
  const wa = $('#wa');
  if (wa) wa.onclick = () => {
    const lines = [
      `*${S.status.dairy_name}*`,
      `${t('Statement for {name}', { name: p.name })} (${fmtDate(from)} – ${fmtDate(to)})`,
      `${t('Milk')}: ${qty(l.milk_qty)} ${t('L')} = ${money(l.milk_amount)}`,
      `${t('Feed')}: ${money(l.feed_amount)}`,
      `${t('Paid by dairy')}: ${money(paidOut)}`,
      `${t('Received by dairy')}: ${money(paidIn)}`,
      `*${t('Balance')}: ${b.text}*`,
      p.has_pin ? `${t('See full details:')} ${location.origin}/` : '',
    ].filter(Boolean);
    let phone = p.phone.replace(/\D/g, '');
    if (phone.length === 10) phone = '91' + phone;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(lines.join('\n'))}`, '_blank');
  };
}

const LEDGER_KIND = { milk_in: 'collection', milk_out: 'sale', feed: 'feedsale', feed_supply: 'purchase', pay_out: 'payment', pay_in: 'payment' };

function ledgerTable(l, editable = false) {
  const rows = l.entries;
  const edit = (r) => (editable && r.id && LEDGER_KIND[r.kind] ? editBtn(LEDGER_KIND[r.kind], r.id) : '');
  return `<div class="list ledger-list">
    <div class="item"><div class="main"><b>${t('Opening balance')}</b><small>${l.from ? fmtDate(l.from) : ''}</small></div><div class="end"><b>${money(l.opening)}</b></div></div>
    ${rows.map((r) => `<div class="item"><div class="main"><small>${fmtDate(r.date)}</small><div>${esc(ledgerDesc(r))}</div></div>
      <div class="end">${r.credit ? `<b class="good-t">+${money(r.credit)}</b>` : ''}${r.debit ? `<b class="bad-t">−${money(r.debit)}</b>` : ''}<small>${t('Bal')} ${money(r.balance)}</small></div>${edit(r)}</div>`).join('')}
    <div class="item"><div class="main"><b>${t('Closing balance')}</b></div><div class="end"><b>${money(l.closing)}</b></div></div>
  </div>
  <div class="table-wrap ledger-table"><table>
    <thead><tr><th>${t('Date')}</th><th>${t('Details')}</th><th class="n">+ ${t('Credit')}</th><th class="n">− ${t('Debit')}</th><th class="n">${t('Balance')}</th>${editable ? '<th class="no-print"></th>' : ''}</tr></thead>
    <tbody>
      <tr class="opening"><td>${l.from ? fmtDate(l.from) : ''}</td><td>${t('Opening balance')}</td><td></td><td></td><td class="n">${money(l.opening)}</td>${editable ? '<td class="no-print"></td>' : ''}</tr>
      ${rows.map((r) => `<tr><td>${fmtDate(r.date)}</td><td>${esc(ledgerDesc(r))}</td>
        <td class="n">${r.credit ? money(r.credit) : ''}</td><td class="n">${r.debit ? money(r.debit) : ''}</td>
        <td class="n ${r.balance < 0 ? 'bad-t' : ''}">${money(r.balance)}</td>${editable ? `<td class="no-print">${edit(r)}</td>` : ''}</tr>`).join('')}
    </tbody>
    <tfoot><tr><td></td><td>${t('Total')}</td><td class="n">${money(l.total_credit)}</td><td class="n">${money(l.total_debit)}</td><td class="n">${money(l.closing)}</td>${editable ? '<td class="no-print"></td>' : ''}</tr></tfoot>
  </table></div>
  <p class="sub">${t('Balance in plus (+) = dairy has to pay. In minus (−) = person has to pay dairy.')}</p>`;
}

function paymentForm(p, direction, done) {
  const suggested = direction === 'out' ? Math.max(0, p.balance) : Math.max(0, -p.balance);
  const m = openModal(direction === 'out' ? t('Pay {name}', { name: p.name }) : t('Receive from {name}', { name: p.name }), `
    <form id="fpay">
      <div class="grid">${field(t('Amount ₹'), `<input name="amount" class="big" type="number" step="0.01" min="0" inputmode="decimal" value="${suggested ? r2(suggested) : ''}" required>`)}</div>
      <div class="grid">${field(t('Mode'), cashOnlineSeg())}</div>
      <div class="grid two">
        ${field(t('Date'), `<input type="date" name="date" value="${today()}" required>`)}
        ${field(t('Note'), `<input name="note" placeholder="${t('e.g. 1–10 Oct milk bill')}">`)}
      </div>
      <button class="btn block" type="submit">✓ ${t('Save')}</button>
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
    <div class="page-head"><h1>${t('Payments')}</h1></div>
    <div class="grid two" id="pos" style="margin-bottom:16px"></div>
    <div class="cols">
      <form class="card" id="f" autocomplete="off">
        <h2>${t('Pay or receive money')}</h2>
        <div class="grid">${seg('direction', [['out', '💸 ' + t('Dairy pays')], ['in', '📥 ' + t('Dairy receives')]], 'out')}</div>
        <div class="grid">${field(t('Person'), picker('party_id', { kinds: ['farmer'] }))}</div>
        <div class="grid">${field(t('Amount ₹'), '<input name="amount" class="big" type="number" step="0.01" min="0" inputmode="decimal" required>')}</div>
        <div class="grid">${field(t('Mode'), cashOnlineSeg())}</div>
        <div class="grid two">
          ${field(t('Date'), `<input type="date" name="date" value="${today()}" required>`)}
          ${field(t('Note'), `<input name="note" placeholder="${t('Optional')}">`)}
        </div>
        <button class="btn block" type="submit">✓ ${t('Save payment')}</button>
      </form>
      <div>
        <div class="card"><h2>${t('Pending: dairy has to pay')}</h2><div id="topay"></div></div>
        <div class="card"><h2>${t('Pending: to receive')}</h2><div id="toget"></div></div>
      </div>
    </div>
    <div class="card"><h2>${t('Recent payments')}</h2><div id="list"></div></div>`;
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
        <div class="main"><b>${esc(p.name)}</b><small>${esc(KIND_SHORT(p.kind))}${p.village ? ' · ' + esc(p.village) : ''}</small></div>
        <div class="end"><b>${money(Math.abs(p.balance))}</b></div>
        <button class="btn sm ghost" data-quick="${p.id}" data-dir="${dir}">${dir === 'out' ? t('Pay') : t('Receive')}</button></div>`).join('')}</div>`
    : empty('Nothing pending 🎉');

  async function refresh() {
    await loadParties();
    const [dash, rows] = await Promise.all([api('GET', `/api/dashboard?today=${today()}`), api('GET', `/api/payments?from=${addDays(today(), -60)}`)]);
    $('#pos').innerHTML = `
      <div class="stat"><div class="k">💵 ${t('Cash in hand')}</div><div class="v">${money(dash.money.cash)}</div></div>
      <div class="stat"><div class="k">📱 ${t('Online / Bank')}</div><div class="v">${money(dash.money.online)}</div></div>`;
    $('#topay').innerHTML = pendList(S.parties.filter((p) => p.balance > 0.005).sort((a, b) => b.balance - a.balance), 'out');
    $('#toget').innerHTML = pendList(S.parties.filter((p) => p.balance < -0.005).sort((a, b) => a.balance - b.balance), 'in');
    $('#list').innerHTML = rows.length ? `<div class="list">${rows.map((r) => `
      <div class="item"><div class="avatar">${r.direction === 'out' ? '💸' : '📥'}</div>
        <div class="main"><b>${esc(r.party_name)}</b><small>${fmtDate(r.date)} · ${r.direction === 'out' ? t('Paid by dairy') : t('Received')} · ${MODE(r.mode)}${r.note ? ' · ' + esc(r.note) : ''}</small></div>
        <div class="end"><b class="${r.direction === 'out' ? 'bad-t' : 'good-t'}">${r.direction === 'out' ? '−' : '+'}${money(r.amount)}</b></div>
        ${rowActions('payment', r.id)}</div>`).join('')}</div>`
      : empty('No payments in last 60 days.');
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

// Categories are saved in English and shown in the chosen language.
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
    <div class="page-head"><h1>${t('Expenses')}</h1></div>
    <div class="cols">
      <form class="card" id="f" autocomplete="off">
        <h2>${t('Add expense')}</h2>
        <div class="grid">${seg('kind', [['house', '🏠 ' + t('House')], ['business', '🏪 ' + t('Dairy business')]], kind)}</div>
        <div class="grid"><div class="f"><span class="sub"><b>${t('Spent on')}</b></span><div class="chips" id="cats" style="margin:4px 0 0"></div>
          <input name="category" id="cat" placeholder="${t('Or type here')}" required></div></div>
        <div class="grid">${field(t('Amount ₹'), '<input name="amount" class="big" type="number" step="0.01" min="0" inputmode="decimal" required>')}</div>
        <div class="grid">${field(t('Paid by'), cashOnlineSeg())}</div>
        <div class="grid two">
          ${field(t('Date'), `<input type="date" name="date" value="${today()}" required>`)}
          ${field(t('Note'), `<input name="note" placeholder="${t('Optional')}">`)}
        </div>
        <button class="btn block" type="submit">✓ ${t('Save expense')}</button>
      </form>
      <div>
        <div class="grid two" id="sum" style="margin-bottom:16px"></div>
        <div class="card"><h2>${t('This month')}</h2><div id="list"></div></div>
      </div>
    </div>`;
  const f = $('#f');
  const cats = () => {
    $('#cats').innerHTML = EXP_CATS[kind].map((c) => `<button type="button" class="chip ${f.category.value === t(c) ? 'on' : ''}" data-c="${esc(c)}">${t(c)}</button>`).join('');
  };
  $('#cats').addEventListener('click', (e) => { const b = e.target.closest('[data-c]'); if (b) { f.category.value = t(b.dataset.c); cats(); f.amount.focus(); } });
  f.category.addEventListener('input', cats);
  $$('input[name=kind]', f).forEach((r) => r.addEventListener('change', () => { kind = r.value; sessionStorage.setItem('ek', kind); f.category.value = ''; cats(); }));

  async function list() {
    const rows = await api('GET', `/api/expenses?from=${from}&to=${to}`);
    const tot = (k, m) => rows.filter((r) => r.kind === k && (!m || r.mode === m)).reduce((s, r) => s + r.amount, 0);
    const box = (k, icon, label) => `<div class="stat"><div class="k">${icon} ${t(label)}</div><div class="v">${money(tot(k))}</div><div class="s">${t('Cash')} ${money(tot(k, 'cash'))} · ${t('Online')} ${money(tot(k, 'online'))}</div></div>`;
    $('#sum').innerHTML = box('house', '🏠', 'House (this month)') + box('business', '🏪', 'Business (this month)');
    $('#list').innerHTML = rows.length ? `<div class="list">${rows.map((r) => `
      <div class="item"><div class="avatar">${r.kind === 'house' ? '🏠' : '🏪'}</div>
        <div class="main"><b>${esc(t(r.category))}</b><small>${fmtDate(r.date)} · ${MODE(r.mode)}${r.note ? ' · ' + esc(r.note) : ''}</small></div>
        <div class="end"><b>${money(r.amount)}</b></div>
        ${rowActions('expense', r.id)}</div>`).join('')}</div>`
      : empty('No expenses this month.');
  }
  wireDeletes($('#list'), list);
  onSubmit(f, async (d) => {
    // Save the English name of a chosen category so it shows in either language.
    const match = Object.values(EXP_CATS).flat().find((c) => t(c) === d.category);
    if (match) d.category = match;
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
  const byT = (arr, ty) => arr.find((x) => x.milk_type === ty) || { qty: 0, amount: 0 };
  const maxCat = Math.max(1, ...r.expense_categories.map((c) => c.amount));
  const fl = r.flows;
  const L = t('L');
  main.innerHTML = `
    <div class="page-head"><h1>${t('Reports')}</h1><button class="btn sm ghost no-print" id="print">🖨 ${t('Print')}</button></div>
    <div class="print-only"><h2>${esc(S.status.dairy_name)} · ${fmtDate(from, true)} – ${fmtDate(to, true)}</h2></div>
    ${rangeBar(from, to)}
    <div class="grid four" style="margin-bottom:16px">
      <div class="stat ${r.profit >= 0 ? 'good' : 'bad'}"><div class="k">${t('Business profit')}</div><div class="v">${money(r.profit)}</div></div>
      <div class="stat"><div class="k">${t('House expenses')}</div><div class="v">${money(r.house_expenses)}</div></div>
      <div class="stat ${r.savings >= 0 ? 'good' : 'bad'}"><div class="k">${t('Saved (profit − house)')}</div><div class="v">${money(r.savings)}</div></div>
      <div class="stat"><div class="k">${t('Milk wasted / home')}</div><div class="v">${qty(r.milk_wastage)} ${L}</div></div>
    </div>
    <div class="cols">
      <div class="card">
        <h2>${t('Profit & loss')}</h2>
        <div class="kv">
          <div>${t('Milk sold')} (${qty(r.milk_sold.qty)} ${L})</div><div>${money(r.milk_sold.amount)}</div>
          <div>${t('Milk bought')} (${qty(r.milk_bought.qty)} ${L})</div><div>− ${money(r.milk_bought.amount)}</div>
          <div class="total">${t('Milk profit')}</div><div class="total">${money(r.milk_margin)}</div>
          <div>${t('Feed sold')}</div><div>${money(r.feed_sales)}</div>
          <div>${t('Cost of that feed')}</div><div>− ${money(r.feed_cost)}</div>
          <div class="total">${t('Feed profit')}</div><div class="total">${money(r.feed_margin)}</div>
          <div>${t('Business expenses')}</div><div>− ${money(r.business_expenses)}</div>
          <div class="total">${t('Business profit')}</div><div class="total ${r.profit >= 0 ? 'good-t' : 'bad-t'}">${money(r.profit)}</div>
          <div>${t('House expenses')}</div><div>− ${money(r.house_expenses)}</div>
          <div class="total">${t('Saved')}</div><div class="total ${r.savings >= 0 ? 'good-t' : 'bad-t'}">${money(r.savings)}</div>
        </div>
        <p class="sub">${t('Feed bought for stock in this period: {amt} (counted as profit only when sold).', { amt: money(r.feed_bought) })}</p>
      </div>
      <div class="card">
        <h2>${t('Milk by type')}</h2>
        <div class="table-wrap"><table>
          <thead><tr><th></th><th class="n">${t('Bought')} ${L}</th><th class="n">${t('Bought')} ₹</th><th class="n">${t('Sold')} ${L}</th><th class="n">${t('Sold')} ₹</th></tr></thead>
          <tbody>${['cow', 'buffalo'].map((ty) => `<tr><td>${typeBadge(ty)}</td>
            <td class="n">${qty(byT(r.milk_bought_by_type, ty).qty)}</td><td class="n">${money(byT(r.milk_bought_by_type, ty).amount)}</td>
            <td class="n">${qty(byT(r.milk_sold_by_type, ty).qty)}</td><td class="n">${money(byT(r.milk_sold_by_type, ty).amount)}</td></tr>`).join('')}</tbody>
        </table></div>
        <p class="sub">${t('Now in cold storage:')} ${t('Cow')} ${qty(r.stock.cow)} ${L} · ${t('Buffalo')} ${qty(r.stock.buffalo)} ${L}</p>
      </div>
    </div>
    <div class="cols">
      <div class="card">
        <h2>${t('Cash vs Online in this period')}</h2>
        <div class="table-wrap"><table>
          <thead><tr><th></th><th class="n">💵 ${t('Cash')}</th><th class="n">📱 ${t('Online')}</th></tr></thead>
          <tbody>
            ${[['Milk sales', 'milk_sales'], ['Feed sales', 'feed_sales'], ['Received from people', 'received']].map(([lb, k]) => `<tr><td>+ ${t(lb)}</td><td class="n">${money(fl.cash[k])}</td><td class="n">${money(fl.online[k])}</td></tr>`).join('')}
            ${[['Paid to people', 'paid'], ['Feed stock bought', 'feed_purchases'], ['Business expenses', 'business_exp'], ['House expenses', 'house_exp']].map(([lb, k]) => `<tr><td>− ${t(lb)}</td><td class="n">${money(fl.cash[k])}</td><td class="n">${money(fl.online[k])}</td></tr>`).join('')}
          </tbody>
          <tfoot>
            <tr><td>${t('Net change')}</td><td class="n">${money(fl.cash.total_in - fl.cash.total_out)}</td><td class="n">${money(fl.online.total_in - fl.online.total_out)}</td></tr>
            <tr><td>${t('Balance today')}</td><td class="n">${money(r.money_now.cash)}</td><td class="n">${money(r.money_now.online)}</td></tr>
          </tfoot>
        </table></div>
      </div>
      <div class="card">
        <h2>${t('Where the money went')}</h2>
        ${r.expense_categories.length ? r.expense_categories.map((c) => `
          <div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;font-size:.92rem"><span>${c.kind === 'house' ? '🏠' : '🏪'} ${esc(t(c.category))}</span><b>${money(c.amount)}</b></div>
          <div class="hbar ${c.kind}" style="width:${(c.amount / maxCat) * 100}%"></div></div>`).join('') : empty('No expenses in this period.')}
      </div>
    </div>
    <div class="card">
      <h2>${t('Day by day milk')}</h2>
      ${r.daily.length ? `<div class="table-wrap"><table>
        <thead><tr><th>${t('Date')}</th><th class="n">${t('In')} (${L})</th><th class="n">${t('Out')} (${L})</th><th class="n">${t('Bought')} ₹</th><th class="n">${t('Sold')} ₹</th></tr></thead>
        <tbody>${r.daily.map((d) => `<tr><td>${fmtDate(d.date)}</td><td class="n">${qty(d.qty_in)}</td><td class="n">${qty(d.qty_out)}</td><td class="n">${money(d.bought)}</td><td class="n">${money(d.sold)}</td></tr>`).join('')}</tbody>
      </table></div>` : empty('No milk entries in this period.')}
    </div>`;
  wireRange(main, (f, tt) => { sessionStorage.setItem('rf', f); sessionStorage.setItem('rt', tt); pageReports(f, tt); });
  $('#print').onclick = () => window.print();
}

// ================= settings =================

async function pageSettings() {
  const main = shell('settings', 'Settings');
  const s = await loadSettings();
  const typeName = (ty) => (ty === 'cow' ? '🐄 ' + t('Cow') : '🐃 ' + t('Buffalo'));
  main.innerHTML = `
    <div class="page-head"><h1>${t('Settings')}</h1></div>
    <div class="cols">
      <form class="card" id="fs">
        <h2>${t('Dairy details')}</h2>
        <div class="grid">
          ${field(t('Dairy name'), `<input name="dairy_name" value="${esc(s.dairy_name)}" required>`)}
          ${field(t('Phone (shown to customers)'), `<input name="dairy_phone" value="${esc(s.dairy_phone)}">`)}
          ${field(t('Address'), `<input name="dairy_address" value="${esc(s.dairy_address)}">`)}
        </div>
        <h2 style="margin:16px 0 12px">${t('Milk buying rates')}</h2>
        ${['cow', 'buffalo'].map((ty) => `
          <div class="grid two">
            ${field(`${typeName(ty)} – ${t('rate type')}`, `<select name="${ty}_rate_mode"><option value="liter">${t('Fixed ₹ per litre')}</option><option value="fat" ${s[`${ty}_rate_mode`] === 'fat' ? 'selected' : ''}>${t('₹ per fat point (rate × fat)')}</option></select>`)}
            ${field(t('Rate ₹'), `<input name="${ty}_rate" type="number" step="0.01" min="0" value="${esc(s[`${ty}_rate`])}">`)}
          </div>`).join('')}
        <p class="sub">${t('Example: fat type with ₹7.50 and fat 6.5 → ₹48.75 per litre.')}</p>
        <h2 style="margin:16px 0 12px">${t('Local selling rates (₹ per litre)')}</h2>
        <div class="grid two">
          ${field(typeName('cow'), `<input name="cow_sale_rate" type="number" step="0.01" min="0" value="${esc(s.cow_sale_rate)}">`)}
          ${field(typeName('buffalo'), `<input name="buffalo_sale_rate" type="number" step="0.01" min="0" value="${esc(s.buffalo_sale_rate)}">`)}
        </div>
        <h2 style="margin:16px 0 12px">${t('Starting balances (when you began using the app)')}</h2>
        <div class="grid two">
          ${field('💵 ' + t('Cash in hand'), `<input name="opening_cash" type="number" step="0.01" value="${esc(s.opening_cash)}">`)}
          ${field('📱 ' + t('Bank / online'), `<input name="opening_bank" type="number" step="0.01" value="${esc(s.opening_bank)}">`)}
          ${field(t('Cow milk in storage (L)'), `<input name="opening_stock_cow" type="number" step="0.01" value="${esc(s.opening_stock_cow)}">`)}
          ${field(t('Buffalo milk in storage (L)'), `<input name="opening_stock_buffalo" type="number" step="0.01" value="${esc(s.opening_stock_buffalo)}">`)}
        </div>
        <button class="btn block" type="submit">${t('Save settings')}</button>
      </form>
      <div>
        <div class="card">
          <h2>${t('Language')}</h2>
          <div class="row-actions">
            <button class="btn ${getLang() === 'en' ? '' : 'plain'}" data-lang="en">English</button>
            <button class="btn ${getLang() === 'pa' ? '' : 'plain'}" data-lang="pa">ਪੰਜਾਬੀ</button>
          </div>
          <p class="sub">${t('Each phone remembers its own language. Customers can also switch on their login page.')}</p>
        </div>
        <div class="card">
          <h2>${t('Customer login')}</h2>
          <p>${t('Customers open {link} on their phone and log in with their mobile number + PIN. Set the PIN in People → person → Edit.', { link: `<b>${esc(location.origin)}</b>` })}</p>
          <button class="btn ghost" id="copy">📋 ${t('Copy link')}</button>
        </div>
        <form class="card" id="fpw">
          <h2>${t('Change owner password')}</h2>
          <div class="grid">
            ${field(t('Current password'), '<input name="old_password" type="password" required autocomplete="current-password">')}
            ${field(t('New password'), '<input name="new_password" type="password" minlength="4" required autocomplete="new-password">')}
          </div>
          <button class="btn" type="submit">${t('Change password')}</button>
        </form>
        <div class="card">
          <h2>${t('Backup')}</h2>
          <p class="sub">${t('Download all your records as a file. Keep it safe (e.g. on Google Drive) every week.')}</p>
          <button class="btn ghost" id="backup">⬇️ ${t('Download backup')}</button>
        </div>
        <div class="card danger-card">
          <h2>🗑 ${t('Delete test data')}</h2>
          <p class="sub">${t('Used fake entries to try the app? Remove them here before you start real work.')}</p>
          <button class="btn danger" id="reset">${t('Delete test data…')}</button>
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
  $('#reset').onclick = () => {
    const m = openModal(t('Delete test data'), `
      <form id="freset">
        <div class="grid">${seg('scope', [['entries', t('Only entries')], ['all', t('Everything')]], 'entries')}</div>
        <p id="rhelp" class="sub"></p>
        <div class="alert">${t('This cannot be undone. Download a backup first if you are not sure.')}</div>
        <div class="grid">${field(t('Owner password'), '<input name="password" type="password" required autocomplete="current-password">')}</div>
        <div class="row-actions"><button class="btn danger" type="submit">🗑 ${t('Delete now')}</button>
          <button class="btn plain" type="button" data-close>${t('Cancel')}</button></div>
      </form>`);
    $$('[data-close]', m).forEach((b) => { b.onclick = () => m.close(); });
    const f = $('#freset', m);
    const help = () => {
      $('#rhelp', m).textContent = f.scope.value === 'all'
        ? t('Deletes all entries, all people and all feed items. Your dairy name, rates and password stay.')
        : t('Deletes all milk, milk-out, feed sales, feed purchases, payments and expenses. Your people, feed items and rates stay.');
    };
    $$('input[name=scope]', f).forEach((x) => x.addEventListener('change', help));
    help();
    onSubmit(f, async (d) => {
      await api('POST', '/api/reset', d);
      m.close();
      S.parties = []; S.items = [];
      toast('Test data deleted');
      location.hash = '#/home';
    });
  };
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
  app.innerHTML = `<header class="topbar"><img class="logo" src="icon.svg" alt=""><div class="title">${esc(S.status.dairy_name)}</div>${langBtn()}<button id="out">${t('Log out')}</button></header><main id="main">${empty('Loading…')}</main>`;
  $('#out').onclick = () => { location.hash = '#/logout'; };
  let d;
  try { d = await api('GET', `/api/portal?from=${from}&to=${to}`); } catch (e) { toast(e.message, true); return; }
  const p = d.party;
  const bal = p.balance;
  const msg = Math.abs(bal) < 0.005 ? t('All settled 👍') : bal > 0 ? t('Dairy will pay you') : t('You have to pay the dairy');
  const milk = d.entries.filter((e) => e.kind === 'milk_in');
  const fatW = milk.filter((e) => e.fat);
  const avgFat = fatW.length ? (fatW.reduce((s, e) => s + e.fat * e.qty, 0) / fatW.reduce((s, e) => s + e.qty, 0)).toFixed(1) : null;
  const paid = d.entries.filter((e) => e.kind === 'pay_out').reduce((s, e) => s + e.debit, 0);
  const L = t('L');
  const main = $('#main');
  main.style.paddingBottom = '32px';
  main.innerHTML = `
    <div class="page-head"><div><h1>${t('Hello, {name}', { name: esc(p.name) })} 🙏</h1><div class="sub">${[p.code ? t('Code') + ' ' + esc(p.code) : '', esc(p.village || '')].filter(Boolean).join(' · ')}</div></div></div>
    <div class="balance-card ${bal < 0 ? 'owe' : Math.abs(bal) < 0.005 ? 'zero' : ''}">
      <div class="lbl">${msg}</div>
      <div class="amt">${money(Math.abs(bal))}</div>
      ${d.dairy.phone ? `<div class="meta"><a href="tel:${esc(d.dairy.phone)}">📞 ${t('Call dairy:')} ${esc(d.dairy.phone)}</a></div>` : ''}
    </div>
    ${rangeBar(from, to)}
    <div class="grid four" style="margin-bottom:16px">
      <div class="stat"><div class="k">🥛 ${t('Milk given')}</div><div class="v">${qty(d.milk_qty)} ${L}</div><div class="s">${avgFat ? t('Avg fat') + ' ' + avgFat : '&nbsp;'}</div></div>
      <div class="stat"><div class="k">${t('Milk amount')}</div><div class="v">${money(d.milk_amount)}</div></div>
      <div class="stat"><div class="k">🌾 ${t('Feed (cut)')}</div><div class="v">${money(d.feed_amount)}</div></div>
      <div class="stat"><div class="k">💸 ${t('Paid to you')}</div><div class="v">${money(paid)}</div></div>
    </div>
    ${milk.length ? `<div class="card"><h2>🥛 ${t('Daily milk')}</h2><div class="table-wrap"><table>
      <thead><tr><th>${t('Date')}</th><th class="n">${t('Litres')}</th><th class="n">${t('Fat')}</th><th class="n">${t('Amount')}</th></tr></thead>
      <tbody>${milk.slice().reverse().map((e) => `<tr><td style="white-space:nowrap">${fmtDate(e.date)} ${e.shift === 'morning' ? '🌅' : '🌇'}<br>${typeBadge(e.milk_type)}</td>
        <td class="n">${qty(e.qty)}</td><td class="n">${e.fat ?? '–'}</td><td class="n">${money(e.credit)}<br><small class="sub">@ ₹${e.rate}</small></td></tr>`).join('')}</tbody>
      <tfoot><tr><td>${t('Total')}</td><td class="n">${qty(d.milk_qty)}</td><td></td><td class="n">${money(d.milk_amount)}</td></tr></tfoot>
    </table></div></div>` : ''}
    <div class="card"><h2>📒 ${t('Full account')}</h2>${ledgerTable(d)}</div>`;
  wireRange(main, (f, tt) => pagePortal(f, tt));
}

router();
