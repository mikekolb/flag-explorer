// Everything on screen that isn't the 3D world: counter, popups, My Flags,
// hints, maps, settings and celebrations.
import { CONTINENTS, CONTINENT_BY_ID } from './data/continents.js';
import { BY_CODE } from './data/countries.js';
import { FACTS } from './data/facts.js';
import { ACTIVE_COUNTRIES, countriesIn, FLAG_URL } from './config.js';
import { ISLANDS, ISLAND_BY_ID, codesOn, planIsland, paintIsland, WATER } from './islands.js';
import { flagReady, flagCanvas } from './flags.js';
import { say } from './speech.js';

const $ = (id) => document.getElementById(id);
let G; // game object from main.js
const openModals = new Set();

function openModal(id) {
  $(id).classList.remove('hidden');
  openModals.add(id);
  G.onModalChange(true);
}
function closeModal(id) {
  $(id).classList.add('hidden');
  openModals.delete(id);
  if (!openModals.size) G.onModalChange(false);
}
export const anyModalOpen = () => openModals.size > 0;

const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function initUI(game) {
  G = game;
  document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => closeModal(b.dataset.close)));
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') [...openModals].forEach((m) => { if (m !== 'celebrate' && m !== 'found') closeModal(m); });
  });
  $('btn-flags').addEventListener('click', openMyFlags);
  $('btn-hint').addEventListener('click', openHints);
  $('btn-map').addEventListener('click', () => openMap('here'));
  $('btn-settings').addEventListener('click', openSettings);
  $('tab-here').addEventListener('click', () => openMap('here'));
  $('tab-world').addEventListener('click', () => openMap('world'));
  $('hint-search').addEventListener('input', renderHintList);
  $('hint-stop').addEventListener('click', () => G.setHint(null));
  $('banner-close').addEventListener('click', hideBanner);
  $('banner-go').addEventListener('click', () => { hideBanner(); openMap('world'); });
  $('found-say').addEventListener('click', () => { if (shownCountry) say(shownCountry.say); });
  $('found-ok').addEventListener('click', () => { closeModal('found'); const r = foundResolve; foundResolve = null; r?.(); });
  $('cel-ok').addEventListener('click', () => { closeModal('celebrate'); stopConfetti(); const r = celResolve; celResolve = null; r?.(); });
  initSettings();
  window.addEventListener('resize', () => { if (openModals.has('mapscreen')) openMap(mapView); });
}

// ---------- counter ----------
export function updateCounter() {
  const total = ACTIVE_COUNTRIES.length;
  const n = ACTIVE_COUNTRIES.filter((c) => G.save.found[c.code]).length;
  $('count-num').textContent = `${n} / ${total}`;
  const isl = G.world?.island;
  if (isl) {
    const list = codesOn(isl.id);
    const k = list.filter((code) => G.save.found[code]).length;
    $('where').textContent = `${isl.name}: ${k} of ${list.length}`;
  }
}

// ---------- found popup ----------
let shownCountry = null, foundResolve = null;
export function showFound(country, title = 'You found a flag!') {
  shownCountry = country;
  $('found-flag').src = FLAG_URL(country.code);
  $('found-name').textContent = country.name;
  $('found-where').textContent = `A country in ${CONTINENT_BY_ID[country.continent].name}`;
  document.querySelector('.found-title').textContent = title;
  const facts = $('found-facts');
  facts.innerHTML = '';
  for (const f of FACTS[country.code] || []) {
    const li = document.createElement('li');
    li.textContent = f;
    facts.appendChild(li);
  }
  openModal('found');
  say(country.say);
  return new Promise((r) => { foundResolve = r; });
}

// ---------- My Flags ----------
function openMyFlags() {
  const box = $('myflags-list');
  box.innerHTML = '';
  for (const cont of CONTINENTS) {
    const list = countriesIn(cont.id).slice().sort((a, b) => a.name.localeCompare(b.name));
    if (!list.length) continue;
    const got = list.filter((c) => G.save.found[c.code]);
    const g = document.createElement('div');
    g.className = 'cont-group';
    g.innerHTML = `<h3>${cont.name} <small>${got.length} of ${list.length}</small></h3>`;
    const grid = document.createElement('div');
    grid.className = 'flag-grid';
    for (const c of list) {
      const t = document.createElement('button');
      if (G.save.found[c.code]) {
        t.className = 'flag-tile';
        t.innerHTML = `<img loading="lazy" src="${FLAG_URL(c.code)}" alt="">`;
        t.append(c.name);
        t.addEventListener('click', () => showFound(c, 'My flag'));
      } else {
        t.className = 'flag-tile missing';
        t.innerHTML = '<div class="q">?</div>Not found yet';
      }
      grid.appendChild(t);
    }
    g.appendChild(grid);
    box.appendChild(g);
  }
  openModal('myflags');
  box.scrollTop = 0;
}

// ---------- Hints ----------
function openHints() {
  $('hint-search').value = '';
  renderHintList();
  openModal('hints');
}
function renderHintList() {
  const q = norm($('hint-search').value.trim());
  const box = $('hint-list');
  box.innerHTML = '';
  const here = G.world?.island.id;
  const order = [here, ...ISLANDS.map((i) => i.id).filter((id) => id !== here)];
  let shown = 0;
  for (const id of order) {
    const list = codesOn(id).map((code) => BY_CODE[code]).filter((c) => !G.save.found[c.code] && (!q || norm(c.name).includes(q)))
      .sort((a, b) => a.name.localeCompare(b.name));
    if (!list.length) continue;
    const head = document.createElement('div');
    head.className = 'hint-head';
    head.textContent = id === here ? `Here on ${ISLAND_BY_ID[id].name}` : `On ${ISLAND_BY_ID[id].name}`;
    box.appendChild(head);
    for (const c of list) {
      const row = document.createElement('button');
      row.className = 'hint-row';
      row.innerHTML = `<img loading="lazy" src="${FLAG_URL(c.code)}" alt=""><span></span>${id === here ? '' : '<small>Fly there first ✈️</small>'}`;
      row.querySelector('span').textContent = c.name;
      row.addEventListener('click', () => { closeModal('hints'); G.setHint(c.code); });
      box.appendChild(row);
      shown++;
    }
  }
  if (!shown) {
    box.innerHTML = `<div class="empty-note">${q ? 'No flag with that name is left to find.' : 'You found them all! 🎉'}</div>`;
  }
}

export function updateHintGuide(info) {
  const el = $('hint-guide');
  if (!info) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  $('hint-flag').src = FLAG_URL(info.code);
  if (info.elsewhere) {
    $('hint-arrow').style.display = 'none';
    $('hint-dist').textContent = `${BY_CODE[info.code].name} is on ${info.elsewhere}`;
  } else {
    $('hint-arrow').style.display = '';
    $('hint-arrow').style.transform = `rotate(${info.angle - Math.PI / 2}rad)`;
    $('hint-dist').textContent = info.dist < 6 ? `${BY_CODE[info.code].name}: right here!` : `${BY_CODE[info.code].name}: ${Math.round(info.dist)} steps`;
  }
}

export function showBanner(text) {
  $('banner-text').textContent = text;
  $('banner').classList.remove('hidden');
}
export function hideBanner() { $('banner').classList.add('hidden'); }

// ---------- Minimap ----------
let miniBase = null, miniKey = '';
export function drawMinimap() {
  const w = G.world;
  if (!w) return;
  const cv = $('minimap');
  const maxW = window.innerWidth < 1000 ? 190 : 230, maxH = 170;
  const s = Math.min(maxW / w.W, maxH / w.H);
  const cw = Math.round(w.W * s), ch = Math.round(w.H * s);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const key = `${w.island.id}|${cw}|${ch}|${Object.keys(G.save.found).length}|${flagReady.size}`;
  if (key !== miniKey) {
    miniKey = key;
    cv.width = cw * dpr; cv.height = ch * dpr;
    cv.style.width = cw + 'px'; cv.style.height = ch + 'px';
    miniBase = document.createElement('canvas');
    miniBase.width = cv.width; miniBase.height = cv.height;
    const b = miniBase.getContext('2d');
    b.drawImage(w.groundCanvas, 0, 0, cv.width, cv.height);
    for (const f of w.flags) {
      if (!G.save.found[f.code]) continue;
      const img = flagReady.get(f.code);
      const x = (f.x + w.W / 2) * s * dpr, y = (f.z + w.H / 2) * s * dpr;
      if (img) { b.drawImage(img, x - 7 * dpr, y - 5 * dpr, 14 * dpr, 10.5 * dpr); b.strokeStyle = '#fff'; b.lineWidth = dpr; b.strokeRect(x - 7 * dpr, y - 5 * dpr, 14 * dpr, 10.5 * dpr); }
    }
  }
  const ctx = cv.getContext('2d');
  ctx.drawImage(miniBase, 0, 0);
  const k = s * dpr;
  const t = performance.now() / 1000;
  const hf = G.hintFlag();
  if (hf) {
    ctx.beginPath();
    ctx.arc((hf.x + w.W / 2) * k, (hf.z + w.H / 2) * k, (6 + Math.sin(t * 5) * 2) * dpr, 0, 7);
    ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = 3 * dpr; ctx.stroke();
  }
  drawPlayer(ctx, (G.player.x + w.W / 2) * k, (G.player.z + w.H / 2) * k, G.player.face, 6 * dpr);
}

function drawPlayer(ctx, x, y, face, r) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-face);
  ctx.beginPath();
  ctx.moveTo(0, r * 1.6); ctx.lineTo(r, -r * 0.9); ctx.lineTo(-r, -r * 0.9); ctx.closePath();
  ctx.fillStyle = '#e8483f'; ctx.fill();
  ctx.lineWidth = r / 3; ctx.strokeStyle = '#fff'; ctx.stroke();
  ctx.restore();
}

// ---------- Full map ----------
let mapView = 'here', pulseIsland = null;
const thumbs = {}; // small painted map of each island, for the World tab
const GRID_COLS = Math.min(3, ISLANDS.length), GRID_ROWS = Math.ceil(ISLANDS.length / GRID_COLS);
export function openMap(view, pulse) {
  if (pulse !== undefined) pulseIsland = pulse;
  mapView = view;
  if (!openModals.has('mapscreen')) openModal('mapscreen');
  $('tab-here').classList.toggle('on', view === 'here');
  $('tab-world').classList.toggle('on', view === 'world');
  const holder = $('map-holder');
  const wrap = $('map-wrap');
  const labels = $('map-labels');
  labels.innerHTML = '';
  const hw = holder.clientWidth, hh = holder.clientHeight;
  const w = G.world;
  const aspect = view === 'here' ? w.W / w.H : GRID_COLS / GRID_ROWS;
  let cw = hw, ch = hw / aspect;
  if (ch > hh) { ch = hh; cw = hh * aspect; }
  wrap.style.width = cw + 'px'; wrap.style.height = ch + 'px';
  const cv = $('map-canvas');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
  const ctx = cv.getContext('2d');
  const ic = 26 * dpr; // flag icon width

  if (view === 'here') {
    ctx.drawImage(w.groundCanvas, 0, 0, cv.width, cv.height);
    const k = cv.width / w.W;
    for (const f of w.flags) {
      if (!G.save.found[f.code]) continue;
      const x = (f.x + w.W / 2) * k, y = (f.z + w.H / 2) * k;
      const img = flagReady.get(f.code);
      if (img) {
        ctx.fillStyle = '#fff';
        ctx.fillRect(x - ic / 2 - 2 * dpr, y - ic * 0.375 - 2 * dpr, ic + 4 * dpr, ic * 0.75 + 4 * dpr);
        ctx.drawImage(img, x - ic / 2, y - ic * 0.375, ic, ic * 0.75);
      }
    }
    const hf = G.hintFlag();
    if (hf) {
      const x = (hf.x + w.W / 2) * k, y = (hf.z + w.H / 2) * k;
      ctx.font = `${34 * dpr}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.beginPath(); ctx.arc(x, y, 20 * dpr, 0, 7); ctx.fillStyle = 'rgba(255,225,77,.6)'; ctx.fill();
      ctx.fillText('⭐', x, y);
    }
    drawPlayer(ctx, (G.player.x + w.W / 2) * k, (G.player.z + w.H / 2) * k, G.player.face, 11 * dpr);
    const list = codesOn(w.island.id);
    const got = list.filter((code) => G.save.found[code]).length;
    $('map-note').textContent = `${w.island.name}: you found ${got} of ${list.length} flags. The red arrow is you.${hf ? ' The star is your hint.' : ''}`;
  } else {
    // all islands in a grid; tap one to fly there
    ctx.fillStyle = WATER;
    ctx.fillRect(0, 0, cv.width, cv.height);
    const cellW = cv.width / GRID_COLS, cellH = cv.height / GRID_ROWS;
    const small = 14 * dpr;
    ISLANDS.forEach((isl, n) => {
      const plan = planIsland(isl.id);
      if (!thumbs[isl.id]) thumbs[isl.id] = paintIsland(plan, 0.5);
      const size = Math.min(cellW, cellH) * 0.92;
      const ox = (n % GRID_COLS) * cellW + (cellW - size) / 2, oy = Math.floor(n / GRID_COLS) * cellH + (cellH - size) / 2;
      ctx.drawImage(thumbs[isl.id], ox, oy, size, size);
      const k = size / plan.W;
      for (const f of plan.flags) {
        if (!G.save.found[f.code]) continue;
        const img = flagReady.get(f.code);
        if (!img) { flagCanvas(f.code); continue; }
        const x = ox + (f.x + plan.W / 2) * k, y = oy + (f.z + plan.H / 2) * k;
        ctx.drawImage(img, x - small / 2, y - small * 0.375, small, small * 0.75);
      }
      const list = plan.flags;
      const got = list.filter((f) => G.save.found[f.code]).length;
      const lb = document.createElement('button');
      lb.className = 'cont-label' + (isl.id === w.island.id ? ' here' : '') + (pulseIsland === isl.id ? ' pulse' : '');
      lb.style.left = (((n % GRID_COLS) + 0.5) / GRID_COLS) * 100 + '%';
      lb.style.top = ((Math.floor(n / GRID_COLS) + 0.86) / GRID_ROWS) * 100 + '%';
      lb.style.borderBottom = `6px solid ${isl.color}`;
      lb.innerHTML = `${isl.name}<small>${isl.id === w.island.id ? 'You are here' : `${got} of ${list.length} found`}</small>`;
      lb.addEventListener('click', () => flyTo(isl.id));
      labels.appendChild(lb);
    });
    $('map-note').textContent = 'Tap an island to fly there.';
  }
}

// taps on the world map (not on a label) pick the island under your finger
$('map-canvas').addEventListener('click', (e) => {
  if (mapView !== 'world') return;
  const r = e.target.getBoundingClientRect();
  const col = Math.floor(((e.clientX - r.left) / r.width) * GRID_COLS);
  const row = Math.floor(((e.clientY - r.top) / r.height) * GRID_ROWS);
  const isl = ISLANDS[row * GRID_COLS + col];
  if (isl) flyTo(isl.id);
});

function flyTo(id) {
  pulseIsland = null;
  closeModal('mapscreen');
  if (id !== G.world.island.id) G.travel(id);
}

// ---------- Settings ----------
function openSettings() {
  $('set-voice').checked = G.save.settings.voice;
  $('set-fast').checked = G.save.settings.fast;
  $('version').textContent = `Version: ${__BUILD_TIME__}`;
  delete $('btn-newworld').dataset.sure;
  $('btn-newworld').querySelector('.lbl').textContent = 'New random world';
  const fsOK = !!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen);
  $('btn-fullscreen').classList.toggle('hidden', !fsOK || window.navigator.standalone);
  openModal('settings');
}
function initSettings() {
  $('set-voice').addEventListener('change', (e) => G.setSetting('voice', e.target.checked));
  $('set-fast').addEventListener('change', (e) => G.setSetting('fast', e.target.checked));
  $('btn-fullscreen').addEventListener('click', () => {
    const el = document.documentElement;
    (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el);
  });
  $('btn-newworld').addEventListener('click', () => {
    const b = $('btn-newworld');
    if (b.dataset.sure) G.newWorld();
    else { b.dataset.sure = '1'; b.querySelector('.lbl').textContent = 'Tap again to make a new world'; }
  });
  const btn = $('btn-reset'), fill = $('reset-fill');
  let timer = null, start = 0;
  const begin = (e) => {
    e.preventDefault();
    start = performance.now();
    clearInterval(timer);
    timer = setInterval(() => {
      const p = Math.min(1, (performance.now() - start) / 3000);
      fill.style.width = p * 100 + '%';
      if (p >= 1) { clearInterval(timer); timer = null; fill.style.width = '0'; G.resetAll(); }
    }, 50);
  };
  const cancel = () => { clearInterval(timer); timer = null; fill.style.width = '0'; };
  btn.addEventListener('touchstart', begin, { passive: false });
  btn.addEventListener('mousedown', begin);
  ['touchend', 'touchcancel', 'mouseup', 'mouseleave'].forEach((ev) => btn.addEventListener(ev, cancel));
}

// ---------- Celebrations ----------
let celResolve = null, confettiOn = false;
export function celebrate(big, text, sub) {
  $('celebrate').classList.toggle('big', big);
  $('cel-icon').textContent = big ? '🏆' : '⭐🎉⭐';
  $('cel-text').textContent = text;
  $('cel-sub').textContent = sub || '';
  openModal('celebrate');
  startConfetti(big ? 320 : 120, big);
  return new Promise((r) => { celResolve = r; });
}
function startConfetti(n, endless) {
  const cv = $('confetti');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
  const ctx = cv.getContext('2d');
  const COLORS = ['#e8483f', '#ffcf3f', '#2fb85a', '#3d8ef0', '#b993ff', '#ff8aa6'];
  const make = (top) => ({
    x: Math.random() * cv.width, y: top ? -Math.random() * cv.height * 0.5 : Math.random() * -40,
    vx: (Math.random() - 0.5) * 3 * dpr, vy: (2 + Math.random() * 3) * dpr, r: Math.random() * 6,
    vr: (Math.random() - 0.5) * 0.3, w: (6 + Math.random() * 6) * dpr, h: (8 + Math.random() * 8) * dpr,
    c: COLORS[Math.floor(Math.random() * COLORS.length)],
  });
  const ps = Array.from({ length: n }, () => make(true));
  confettiOn = true;
  const step = () => {
    if (!confettiOn) { ctx.clearRect(0, 0, cv.width, cv.height); return; }
    ctx.clearRect(0, 0, cv.width, cv.height);
    for (const p of ps) {
      p.x += p.vx; p.y += p.vy; p.r += p.vr;
      if (p.y > cv.height + 20 && endless) Object.assign(p, make(false));
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
      ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    requestAnimationFrame(step);
  };
  step();
}
function stopConfetti() { confettiOn = false; }
