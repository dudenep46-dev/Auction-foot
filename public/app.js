(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const PL = new Map(PLAYERS.map(p => [p.id, p]));
const POS = ['GK', 'DEF', 'MID', 'FWD'];
const fmt = n => Number(n).toLocaleString('en-US');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ini = n => n.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
const store = {
  get() { try { return JSON.parse(localStorage.getItem('gavelfc') || 'null'); } catch { return null; } },
  set(v) { try { localStorage.setItem('gavelfc', JSON.stringify(v)); } catch {} },
  clear() { try { localStorage.removeItem('gavelfc'); } catch {} }
};
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

let S = null, me = store.get(), offset = 0, es = null, tab = 'feed', viewId = null;
let lastKey = '', lastBid = -1, lastStatus = '', doneFx = false, muted = false;
const CIRC = 326.7;

/* ---------- helpers ---------- */
function toast(msg, ok) {
  const t = document.createElement('div');
  t.className = 'toast' + (ok ? ' ok' : '');
  t.textContent = msg;
  $('#toasts').append(t);
  setTimeout(() => t.remove(), 3400);
}
async function api(path, body) {
  let r;
  try { r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) }); }
  catch { throw new Error('Cannot reach the server'); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Something went wrong');
  return j;
}
async function copy(text) {
  try { await navigator.clipboard.writeText(text); toast('Copied', true); }
  catch {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.append(ta); ta.select();
    try { document.execCommand('copy'); toast('Copied', true); } catch { toast('Copy failed. Select the text and copy it by hand.'); }
    ta.remove();
  }
}
const withAuth = extra => ({ code: me.code, token: me.token, ...extra });
const meMember = () => S.members.find(m => m.id === me.id);
const maxBid = m => m.budget - S.cfg.reserve * (S.cfg.squad - m.roster.length - 1);
const tier = r => r >= 88 ? 'elite' : r >= 84 ? 'gold' : r >= 79 ? 'silver' : 'bronze';
const hue = s => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
const sortRoster = roster => roster.map(r => ({ ...r, p: PL.get(r.pid) }))
  .sort((a, b) => POS.indexOf(a.p.pos) - POS.indexOf(b.p.pos) || b.p.rating - a.p.rating);

/* ---------- sound + confetti ---------- */
let ac;
function beep(freq, dur = .08, type = 'sine', vol = .05, delay = 0) {
  if (muted) return;
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.value = freq; g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + dur);
  } catch {}
}
const gavel = () => { beep(196, .16, 'square', .06); beep(147, .3, 'square', .06, .13); };

const fx = $('#fx'), fctx = fx.getContext('2d');
let parts = [], fxRun = false;
function burst() {
  if (reduced) return;
  fx.width = innerWidth; fx.height = innerHeight;
  const colors = ['#ffd98a', '#e8b04a', '#eef0e6', '#55e0a4', '#ff5c3a', '#4ac9ff'];
  for (let i = 0; i < 160; i++) parts.push({
    x: innerWidth / 2 + (Math.random() - .5) * 200, y: innerHeight * .4,
    vx: (Math.random() - .5) * 16, vy: -Math.random() * 15 - 3, s: 5 + Math.random() * 7,
    r: Math.random() * 6, vr: (Math.random() - .5) * .4, c: colors[i % colors.length], life: 1
  });
  if (!fxRun) { fxRun = true; requestAnimationFrame(fxLoop); }
}
function fxLoop() {
  fctx.clearRect(0, 0, fx.width, fx.height);
  parts = parts.filter(p => p.life > 0 && p.y < fx.height + 20);
  for (const p of parts) {
    p.vy += .42; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.life -= .006;
    fctx.save(); fctx.translate(p.x, p.y); fctx.rotate(p.r); fctx.globalAlpha = Math.min(1, p.life * 2);
    fctx.fillStyle = p.c; fctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); fctx.restore();
  }
  if (parts.length) requestAnimationFrame(fxLoop); else { fxRun = false; fctx.clearRect(0, 0, fx.width, fx.height); }
}

/* ---------- cards ---------- */
const SHIRT = 'M32 12 14 26l10 17 8-6v52h56V37l8 6 10-17-18-14c-5 10-15 14-28 14S37 22 32 12Z';
function cardHTML(p, big) {
  return `<div class="pcard t-${tier(p.rating)}${big ? ' big' : ''}" style="--h:${hue(p.club)}">
    <div class="pc-top"><b class="pc-r">${p.rating}</b><span class="pc-pos">${p.pos}</span><span class="pc-nat">${esc(p.nat)}</span></div>
    <svg class="pc-kit" viewBox="0 0 120 100" aria-hidden="true"><path class="shirt" d="${SHIRT}"/><path class="trim" d="M46 15c4 9 24 9 28 0M24 41l8-5M96 41l-8-5"/><text x="60" y="66">${esc(ini(p.name))}</text></svg>
    <div class="pc-name">${esc(p.name)}</div>
    <div class="pc-club">${esc(p.club)}</div>
  </div>`;
}
function bestXI(roster) {
  const ps = roster.map(r => PL.get(r.pid)).sort((a, b) => b.rating - a.rating);
  const need = { GK: 1, DEF: 4, MID: 3, FWD: 3 }, xi = {};
  let sum = 0;
  for (const pos of POS) {
    xi[pos] = ps.filter(p => p.pos === pos).slice(0, need[pos]);
    for (let i = 0; i < need[pos]; i++) sum += xi[pos][i] ? xi[pos][i].rating : 50;
  }
  return { xi, avg: sum / 11 };
}
function mini(p) { return `<div class="mini t-${tier(p.rating)}" title="${esc(p.name)}"><b>${p.rating}</b><span>${esc(p.name)}</span></div>`; }
function pitchHTML(roster) {
  const { xi } = bestXI(roster);
  const row = (pos, n) => `<div class="pr">${Array.from({ length: n }, (_, i) => xi[pos][i] ? mini(xi[pos][i]) : `<div class="mini gap"><b>50</b><span>No ${pos}</span></div>`).join('')}</div>`;
  return `<div class="pitch">${row('FWD', 3)}${row('MID', 3)}${row('DEF', 4)}${row('GK', 1)}</div>`;
}
function slotsHTML(roster) {
  const rows = sortRoster(roster).map(r => `<li class="slot t-${tier(r.p.rating)}"><span class="sp">${r.p.pos}</span><span class="sn">${esc(r.p.name)}</span><span class="sv">${r.p.rating}</span><span class="sc">${fmt(r.price)}</span></li>`);
  for (let i = roster.length; i < S.cfg.squad; i++) rows.push('<li class="slot empty">Open slot</li>');
  return `<ul class="slots">${rows.join('')}</ul>`;
}
function posCountHTML(roster) {
  const c = Object.fromEntries(POS.map(p => [p, 0]));
  roster.forEach(r => c[PL.get(r.pid).pos]++);
  return `<div class="poscount">${POS.map(p => `<span>${p} <b>${c[p]}</b></span>`).join('')}</div>`;
}

/* ---------- connection ---------- */
function show(id) { for (const s of $$('.screen')) s.hidden = s.id !== id; }
function resetToHome() {
  if (es) es.close();
  es = null; S = null; me = null; lastKey = ''; doneFx = false; viewId = null;
  store.clear(); history.replaceState(null, '', location.pathname);
  show('home');
}
function connect() {
  if (es) es.close();
  es = new EventSource(`/api/events?code=${encodeURIComponent(me.code)}&token=${encodeURIComponent(me.token)}`);
  es.addEventListener('state', e => {
    S = JSON.parse(e.data);
    offset = S.now - Date.now();
    $('#conn').hidden = true;
    render();
  });
  es.addEventListener('gone', e => {
    const msg = JSON.parse(e.data).msg;
    resetToHome(); toast(msg);
  });
  es.onerror = () => { if (S && S.phase === 'auction') $('#conn').hidden = false; };
}
function enter(session) {
  me = { code: session.code, token: session.token, id: session.id };
  store.set(me);
  history.replaceState(null, '', '#' + me.code);
  connect();
}

/* ---------- home ---------- */
$('#poolN').textContent = PLAYERS.length;
if (location.hash.length > 1 && !me) { $('#j-code').value = location.hash.slice(1, 7).toUpperCase(); $('#j-name').focus(); }
async function submit(form, path, body) {
  const btn = $('button[type=submit]', form);
  btn.disabled = true;
  try { enter(await api(path, body)); }
  catch (e) { toast(e.message); }
  finally { btn.disabled = false; }
}
$('#createForm').addEventListener('submit', e => {
  e.preventDefault();
  submit(e.target, '/api/create', { name: $('#c-name').value, password: $('#c-pw').value });
});
$('#joinForm').addEventListener('submit', e => {
  e.preventDefault();
  submit(e.target, '/api/join', { code: $('#j-code').value.trim().toUpperCase(), name: $('#j-name').value, password: $('#j-pw').value });
});

/* ---------- lobby ---------- */
$('#copyCode').onclick = () => copy(me.code);
$('#copyLink').onclick = () => copy(location.origin + location.pathname + '#' + me.code);
$('#startBtn').onclick = () => api('/api/start', withAuth()).catch(e => toast(e.message));
$('#leaveLobby').onclick = async () => { try { await api('/api/leave', withAuth()); } catch {} resetToHome(); };
function renderLobby() {
  $('#lobbyCode').textContent = S.code;
  $('#lobbyCount').textContent = `${S.members.length} / ${S.cfg.max}`;
  $('#lobbyList').innerHTML = S.members.map(m =>
    `<li style="--c:${m.color}"><span class="av">${esc(ini(m.name))}</span><b>${esc(m.name)}${m.id === me.id ? ' (you)' : ''}</b>${m.id === S.hostId ? '<em>Host</em>' : ''}</li>`).join('');
  const host = S.hostId === me.id, enough = S.members.length >= S.cfg.min;
  const btn = $('#startBtn');
  btn.hidden = !host; btn.disabled = !enough;
  $('#lobbyHint').textContent = host
    ? (enough ? 'Everyone here? Start when ready.' : 'Waiting for at least one more manager.')
    : 'Waiting for the host to start the auction.';
}

/* ---------- auction ---------- */
$('#mute').onclick = () => {
  muted = !muted;
  $('#mute').classList.toggle('off', muted);
  $('#muteWave').style.display = muted ? 'none' : '';
};
$('#quick').innerHTML = [50, 100, 250, 500, 1000, 0].map(inc => `<button type="button" data-inc="${inc}">${inc ? '+' + fmt(inc) : 'Max'}<small>-</small></button>`).join('');
$('#quick').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (b && !b.disabled) bid(+b.dataset.amt);
});
$('#customForm').addEventListener('submit', e => {
  e.preventDefault();
  const v = Math.round(Number($('#custom').value) / S.cfg.step) * S.cfg.step;
  if (!v) return toast('Enter an amount to bid');
  bid(v);
  $('#custom').value = '';
});
function bid(amount) {
  api('/api/bid', withAuth({ amount })).catch(e => toast(e.message));
}
$$('.tabs button').forEach(b => b.onclick = () => {
  tab = b.dataset.tab;
  $$('.tabs button').forEach(x => x.classList.toggle('on', x === b));
  renderTab();
});
$('#tabBody').addEventListener('click', e => {
  const b = e.target.closest('[data-view]');
  if (b) { viewId = b.dataset.view; renderTab(); }
});

function renderAuction() {
  const L = S.lot, m = meMember();
  $('#a-code').textContent = S.code;
  $('#a-lot').textContent = 'Lot ' + L.n;
  $('#a-left').textContent = `${S.poolLeft} more in the pool`;
  $('#a-budget').textContent = fmt(m.budget);
  $('#a-slots').textContent = `${m.roster.length}/${S.cfg.squad}`;
  renderLot(L);
  renderControls(L, m);
  renderMembers();
  renderTab();
}

function renderLot(L) {
  const key = L.pid + ':' + L.n, fresh = key !== lastKey;
  const p = PL.get(L.pid);
  if (fresh) {
    $('#lotCard').innerHTML = cardHTML(p, true);
    const w = $('#lotWrap');
    w.classList.remove('enter'); void w.offsetWidth; w.classList.add('enter');
    $('#stamp').className = 'stamp';
    lastBid = -1; lastStatus = '';
  } else {
    if (L.bidderId && L.bid !== lastBid && L.status === 'live') beep(L.bidderId === me.id ? 720 : 470);
    if (L.status === 'sold' && lastStatus !== 'sold') { gavel(); if (L.bidderId === me.id) burst(); }
  }
  const leader = S.members.find(m => m.id === L.bidderId);
  const priceEl = $('#price'), shown = L.bidderId ? L.bid : L.base;
  priceEl.textContent = fmt(shown);
  if (!fresh && L.bid !== lastBid && L.bidderId) { priceEl.classList.remove('bump'); void priceEl.offsetWidth; priceEl.classList.add('bump'); }
  $('#priceLabel').textContent = L.status === 'sold' ? 'Sold for' : L.bidderId ? 'Current bid' : 'Opening price';
  const lead = $('#leader');
  if (leader) { lead.style.setProperty('--c', leader.color); lead.innerHTML = `<i></i><span>${esc(leader.name)}${leader.id === me.id ? ' (you)' : ''}</span>`; }
  else lead.innerHTML = L.status === 'unsold' ? '<span>No bids. The price drops and he returns later.</span>' : '<span class="small">No bids yet</span>';
  const stamp = $('#stamp');
  if (L.status === 'sold') { stamp.innerHTML = `Sold<small>${esc(leader.name)} &middot; ${fmt(L.bid)}</small>`; stamp.className = 'stamp sold show'; }
  else if (L.status === 'unsold') { stamp.innerHTML = 'No sale'; stamp.className = 'stamp show'; }
  lastKey = key; lastBid = L.bid; lastStatus = L.status;
}

function renderControls(L, m) {
  const live = L.status === 'live', full = m.roster.length >= S.cfg.squad, leading = L.bidderId === me.id;
  const cur = L.bidderId ? L.bid : L.base - S.cfg.step, minNext = cur + S.cfg.step, mx = maxBid(m);
  const can = live && !full && !leading;
  $$('#quick button').forEach(b => {
    const inc = +b.dataset.inc, amt = inc ? cur + inc : mx;
    b.dataset.amt = amt;
    b.disabled = !can || amt < minNext || amt > mx;
    $('small', b).textContent = amt >= minNext && amt <= mx ? fmt(amt) : '-';
  });
  $('#custom').disabled = !can;
  $('#customForm button').disabled = !can;
  $('#hint').textContent = full ? 'Your squad is complete. Watch the others finish.'
    : leading && live ? 'You hold the highest bid.'
    : live ? `Your limit is ${fmt(mx)}. ${fmt(S.cfg.reserve)} stays reserved for each empty slot.` : '';
}

function renderMembers() {
  const L = S.lot;
  $('#members').innerHTML = S.members.map(m => {
    const n = m.roster.length;
    return `<li class="mem${L && L.bidderId === m.id ? ' lead' : ''}${m.connected ? '' : ' off'}" style="--c:${m.color}">
      <span class="av">${esc(ini(m.name))}</span>
      <div class="mi"><b>${esc(m.name)}</b>${m.id === me.id ? '<em>You</em>' : ''}<span class="bud">${fmt(m.budget)}</span></div>
      <span class="cnt">${n}/${S.cfg.squad}</span>
      <div class="bar"><i style="width:${n / S.cfg.squad * 100}%"></i></div></li>`;
  }).join('');
}

function feedLine(e) {
  const nm = id => { const m = S.members.find(x => x.id === id); return `<b>${m ? esc(m.name) : '?'}</b>`; };
  const pn = pid => esc(PL.get(pid).name);
  switch (e.k) {
    case 'bid': return `${nm(e.who)} bids <em>${fmt(e.amt)}</em> for ${pn(e.pid)}`;
    case 'sold': return `${pn(e.pid)} sold to ${nm(e.who)} for <em>${fmt(e.amt)}</em>`;
    case 'auto': return `${pn(e.pid)} assigned to ${nm(e.who)} for <em>${fmt(e.amt)}</em>`;
    case 'unsold': return `No bids for ${pn(e.pid)}. Price drops.`;
    case 'start': return 'The auction begins.';
    default: return 'Auction complete.';
  }
}
function renderTab() {
  const body = $('#tabBody');
  if (tab === 'feed') {
    body.innerHTML = `<ul class="feed">${S.log.slice().reverse().slice(0, 45).map(e => `<li class="k-${e.k}">${feedLine(e)}</li>`).join('')}</ul>`;
    return;
  }
  if (!S.members.some(m => m.id === viewId)) viewId = me.id;
  const m = S.members.find(x => x.id === viewId);
  body.innerHTML = `<div style="display:grid;gap:.8rem">
    <div class="pills">${S.members.map(x => `<button type="button" data-view="${x.id}" class="${x.id === viewId ? 'on' : ''}" style="--c:${x.color}"><span class="av" style="--c:${x.color}">${esc(ini(x.name))}</span>${esc(x.name)}</button>`).join('')}</div>
    ${posCountHTML(m.roster)}
    ${slotsHTML(m.roster)}</div>`;
}

/* ---------- finish ---------- */
function renderDone() {
  const rows = S.members.map(m => ({ m, ...bestXI(m.roster), spent: S.cfg.budget - m.budget }))
    .sort((a, b) => b.avg - a.avg || b.m.budget - a.m.budget);
  const win = rows[0];
  $('#winName').textContent = win.m.name + ' wins';
  $('#winSub').textContent = `Best XI rating ${win.avg.toFixed(1)}, spent ${fmt(win.spent)} of ${fmt(S.cfg.budget)}`;
  if (!rows.some(r => r.m.id === viewId)) viewId = win.m.id;
  $('#stand').innerHTML = rows.map((r, i) => `<li><button type="button" data-view="${r.m.id}" class="${r.m.id === viewId ? 'on' : ''}" style="--c:${r.m.color}">
      <span class="rk">${i + 1}</span><span class="av" style="--c:${r.m.color}">${esc(ini(r.m.name))}</span>
      <span class="nm"><b>${esc(r.m.name)}${r.m.id === me.id ? ' (you)' : ''}</b><span>Spent ${fmt(r.spent)} &middot; ${fmt(r.m.budget)} left</span></span>
      <span class="sc">${r.avg.toFixed(1)}<small>BEST XI</small></span></button></li>`).join('');
  const sel = rows.find(r => r.m.id === viewId);
  $('#teamView').innerHTML = `<h2>${esc(sel.m.name)}'s squad</h2>${pitchHTML(sel.m.roster)}<p class="small xi-note">Best XI in a 4-3-3. A missing position counts as 50.</p>${slotsHTML(sel.m.roster)}`;
  if (!doneFx) { doneFx = true; if (win.m.id === me.id) burst(); gavel(); }
}
$('#stand').addEventListener('click', e => {
  const b = e.target.closest('[data-view]');
  if (b) { viewId = b.dataset.view; renderDone(); }
});
$('#newGame').onclick = async () => { try { await api('/api/leave', withAuth()); } catch {} resetToHome(); };

/* ---------- render + clock ---------- */
function render() {
  if (!S) return show('home');
  if (S.phase === 'lobby') { show('lobby'); renderLobby(); }
  else if (S.phase === 'auction' && S.lot) { show('auction'); renderAuction(); }
  else { show('done'); renderDone(); }
}
function clockLoop() {
  requestAnimationFrame(clockLoop);
  if (!S || S.phase !== 'auction' || !S.lot) return;
  const L = S.lot, clock = $('#clock'), arc = $('#ringArc'), ring = $('#ring');
  if (L.status !== 'live') {
    clock.textContent = L.status === 'sold' ? 'SOLD' : 'PASS';
    clock.style.fontSize = '1.5rem';
    arc.style.strokeDashoffset = CIRC; ring.classList.remove('urgent');
    return;
  }
  clock.style.fontSize = '';
  const rem = Math.max(0, L.endsAt - (Date.now() + offset));
  arc.style.strokeDashoffset = CIRC * (1 - Math.min(1, rem / L.span));
  clock.textContent = (rem / 1000).toFixed(1);
  ring.classList.toggle('urgent', rem < 5000);
}
requestAnimationFrame(clockLoop);

if (me) connect(); else show('home');
})();
