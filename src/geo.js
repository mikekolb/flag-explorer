// Real-world map data: projection from lat/lon to world steps, and canvas drawings
// of land and country borders (used for the ground, the minimap and the big map).
import { feature } from 'topojson-client';
import { COUNTRIES } from './data/countries.js';
import { CONTINENTS } from './data/continents.js';

let polys = null; // [{ id, rings: [[ [lon,lat], ... ], ...] }]

export async function loadGeo() {
  if (polys) return polys;
  const topo = (await import('world-atlas/countries-50m.json')).default;
  const fc = feature(topo, topo.objects.countries);
  polys = [];
  for (const f of fc.features) {
    const g = f.geometry;
    if (!g) continue;
    const list = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    for (const rings of list) polys.push({ id: String(f.id ?? f.properties.name), rings });
  }
  return polys;
}

export function makeProjection(c) {
  const shift = c.lon[1] > 180; // Oceania crosses the date line
  const norm = (lon) => (shift && lon < 0 ? lon + 360 : lon);
  const latMid = (c.lat[0] + c.lat[1]) / 2;
  const k = Math.cos((latMid * Math.PI) / 180);
  const spanX = (c.lon[1] - c.lon[0]) * k;
  const spanY = c.lat[1] - c.lat[0];
  const scale = c.size / Math.max(spanX, spanY);
  const W = spanX * scale;
  const H = spanY * scale;
  return {
    W, H, scale, norm,
    toWorld(lat, lon) {
      return { x: (norm(lon) - c.lon[0]) * k * scale - W / 2, z: (c.lat[1] - lat) * scale - H / 2 };
    },
    inBox(lon, lat, pad = 3) {
      lon = norm(lon);
      return lon > c.lon[0] - pad && lon < c.lon[1] + pad && lat > c.lat[0] - pad && lat < c.lat[1] + pad;
    },
  };
}

const PASTELS = ['#9fd86b', '#c9e27c', '#f4dc8c', '#f7c08f', '#eeaecb', '#c6b3ee', '#93d6b4', '#d7ef9c', '#ffd3a1'];
function colorFor(id) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PASTELS[h % PASTELS.length];
}

function polyInView(p, proj) {
  for (const ring of p.rings) for (const [lon, lat] of ring) if (proj.inBox(lon, lat)) return true;
  return false;
}

function tracePoly(ctx, p, proj, sx, sy) {
  ctx.beginPath();
  for (const ring of p.rings) {
    let prev = proj.norm(ring[0][0]), off = prev - ring[0][0];
    ring.forEach(([lon0, lat], i) => {
      // keep rings that cross the date line in one piece
      let lon = lon0 + off;
      if (lon - prev > 180) { off -= 360; lon -= 360; } else if (lon - prev < -180) { off += 360; lon += 360; }
      prev = lon;
      const w = proj.toWorld(lat, lon);
      const x = (w.x + proj.W / 2) * sx;
      const y = (w.z + proj.H / 2) * sy;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
  }
}

// Land mask: 1 = land, 0 = sea. cell = steps per cell.
export function drawMask(proj, cell, islands = []) {
  const w = Math.ceil(proj.W / cell);
  const h = Math.ceil(proj.H / cell);
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#fff';
  const s = 1 / cell;
  for (const p of polys) {
    if (!polyInView(p, proj)) continue;
    tracePoly(ctx, p, proj, s, s);
    ctx.fill('evenodd');
  }
  for (const isl of islands) {
    ctx.beginPath();
    ctx.arc((isl.x + proj.W / 2) * s, (isl.z + proj.H / 2) * s, isl.r * s, 0, Math.PI * 2);
    ctx.fill();
  }
  const data = ctx.getImageData(0, 0, w, h).data;
  const arr = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) arr[i] = data[i * 4] / 255;
  return { w, h, cell, arr };
}

export const WATER = '#3d9be0';

// Colourful political map of a continent, drawn at `px` pixels per step.
export function drawGround(proj, px, islands = []) {
  const cv = document.createElement('canvas');
  cv.width = Math.round(proj.W * px);
  cv.height = Math.round(proj.H * px);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = WATER;
  ctx.fillRect(0, 0, cv.width, cv.height);
  const visible = polys.filter((p) => polyInView(p, proj));
  ctx.lineJoin = 'round';
  // shallow water glow, then beaches
  ctx.strokeStyle = '#78c6ef';
  ctx.lineWidth = 9 * px;
  for (const p of visible) { tracePoly(ctx, p, proj, px, px); ctx.stroke(); }
  for (const isl of islands) { ctx.beginPath(); ctx.arc((isl.x + proj.W / 2) * px, (isl.z + proj.H / 2) * px, (isl.r + 4.5) * px, 0, 7); ctx.fillStyle = '#78c6ef'; ctx.fill(); }
  ctx.strokeStyle = '#f1e3a8';
  ctx.lineWidth = 2.2 * px;
  for (const p of visible) { tracePoly(ctx, p, proj, px, px); ctx.stroke(); }
  for (const p of visible) {
    tracePoly(ctx, p, proj, px, px);
    ctx.fillStyle = colorFor(p.id);
    ctx.fill('evenodd');
  }
  for (const isl of islands) {
    ctx.beginPath();
    ctx.arc((isl.x + proj.W / 2) * px, (isl.z + proj.H / 2) * px, isl.r * px, 0, 7);
    ctx.fillStyle = '#f1e3a8'; ctx.fill();
    ctx.beginPath();
    ctx.arc((isl.x + proj.W / 2) * px, (isl.z + proj.H / 2) * px, (isl.r - 1.5) * px, 0, 7);
    ctx.fillStyle = '#9fd86b'; ctx.fill();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = Math.max(1, 0.45 * px);
  for (const p of visible) { tracePoly(ctx, p, proj, px, px); ctx.stroke(); }
  return cv;
}

// ---------- World map (for fast travel) ----------
export const WORLD_VIEW = { lon: [-180, 180], lat: [84, -58] };

function unit(lat, lon) {
  const a = (lat * Math.PI) / 180, b = (lon * Math.PI) / 180;
  return [Math.cos(a) * Math.cos(b), Math.cos(a) * Math.sin(b), Math.sin(a)];
}
const UNITS = COUNTRIES.map((c) => ({ c, u: unit(c.lat, c.lon) }));

export function nearestCountry(lat, lon) {
  const u = unit(lat, lon);
  let best = null, bd = -2;
  for (const e of UNITS) {
    const d = e.u[0] * u[0] + e.u[1] * u[1] + e.u[2] * u[2];
    if (d > bd) { bd = d; best = e.c; }
  }
  return { country: best, degrees: (Math.acos(Math.min(1, bd)) * 180) / Math.PI };
}

const CONT_COLOR = Object.fromEntries(CONTINENTS.map((c) => [c.id, c.color]));
const OVERRIDE = { 643: 'europe', 304: 'northAmerica' }; // Russia, Greenland

export function worldXY(lat, lon, w, h) {
  return [((lon - WORLD_VIEW.lon[0]) / 360) * w, ((WORLD_VIEW.lat[0] - lat) / (WORLD_VIEW.lat[0] - WORLD_VIEW.lat[1])) * h];
}

export function drawWorld(w, h, isOpen) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = WATER;
  ctx.fillRect(0, 0, w, h);
  ctx.lineJoin = 'round';
  for (const p of polys) {
    let sl = 0, so = 0, n = 0;
    for (const [lon, lat] of p.rings[0]) { sl += lat; so += lon; n++; }
    const lat = sl / n, lon = so / n;
    if (lat < -58) continue; // Antarctica
    const cont = OVERRIDE[p.id] || nearestCountry(lat, lon).country.continent;
    // unwrap rings that cross the date line, then draw them on both edges of the map
    const rings = p.rings.map((ring) => {
      let prev = ring[0][0], off = 0;
      return ring.map(([lo, la]) => {
        if (lo + off - prev > 180) off -= 360; else if (lo + off - prev < -180) off += 360;
        prev = lo + off;
        return [lo + off, la];
      });
    });
    for (const shift of [0, -360, 360]) {
      ctx.beginPath();
      for (const ring of rings) {
        ring.forEach(([lo, la], i) => {
          const [x, y] = worldXY(la, lo + shift, w, h);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.closePath();
      }
      ctx.fillStyle = isOpen(cont) ? CONT_COLOR[cont] : '#b9c2c9';
      ctx.fill('evenodd');
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 0.6;
      ctx.stroke();
    }
  }
  return cv;
}
