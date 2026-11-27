// The made-up world: six random islands. Each save has its own `seed`, which decides
// the island shapes and which flags go where. Same seed = same world every visit.
import { rng, fbm, noise2 } from './noise.js';
import { TEST_BUILD } from './config.js';

const ALL = [
  { id: 'sunny', name: 'Sunny Island', color: '#ffd84d', patches: ['#c9e27c', '#f4dc8c', '#ffe08a', '#d7ef9c', '#f7c08f', '#b8dc72'] },
  { id: 'berry', name: 'Berry Island', color: '#ff8aa6', patches: ['#eeaecb', '#f5c1d6', '#d9b3ee', '#ffd0d8', '#c6b3ee', '#a8dca0'] },
  { id: 'leafy', name: 'Leafy Island', color: '#5fcf7f', patches: ['#9fd86b', '#8fcf7a', '#b5e283', '#93d6b4', '#7cc56a', '#c3e88f'] },
  { id: 'rocky', name: 'Rocky Island', color: '#c9a27a', patches: ['#d8c3a0', '#cbb894', '#e3d2ae', '#bfc59a', '#d6b48c', '#c8d0a4'] },
  { id: 'candy', name: 'Candy Island', color: '#b993ff', patches: ['#ffd3a1', '#c6b3ee', '#93d6e8', '#f4dc8c', '#eeaecb', '#a6e3b4'] },
  { id: 'snowy', name: 'Snowy Island', color: '#9fd3ff', patches: ['#f3f7fb', '#e4eef7', '#ffffff', '#dfe9f2', '#eaf3ea', '#e8eef9'] },
];
export const ISLANDS = TEST_BUILD ? ALL.slice(0, 1) : ALL;
export const ISLAND_BY_ID = Object.fromEntries(ISLANDS.map((i) => [i.id, i]));

const SIZE = 560; // steps across each island's square world
const CELL = 2; // steps per land-mask cell
export const MIN_GAP = 22; // steps between any two flags on an island

let seed = 1, where = {}, plans = {};

// Deals the flags out to the islands at random (but the same way for the same seed).
export function initIslands(worldSeed, codes) {
  seed = worldSeed >>> 0;
  plans = {};
  where = {};
  const R = rng(seed ^ 0x51f15e);
  const list = codes.slice();
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(R() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  list.forEach((code, i) => { where[code] = ISLANDS[i % ISLANDS.length].id; });
}
export const islandOf = (code) => where[code];
export const codesOn = (id) => Object.keys(where).filter((c) => where[c] === id);

// Land height before hills are added: -0.8 at sea, above 0 on land.
export const baseHeight = (soft, x, z) => {
  const t = Math.min(1, Math.max(0, (soft - 0.3) / 0.45));
  const m = t * t * (3 - 2 * t);
  return -0.8 + m * (1.1 + fbm(x * 0.018, z * 0.018) * 3.2);
};

export function sampler(m, W, H) {
  return (x, z) => {
    const gx = Math.min(m.w - 1.001, Math.max(0, (x + W / 2) / m.cell - 0.5));
    const gz = Math.min(m.h - 1.001, Math.max(0, (z + H / 2) / m.cell - 0.5));
    const i = Math.floor(gx), j = Math.floor(gz), fx = gx - i, fz = gz - j;
    const a = m.arr[j * m.w + i], b = m.arr[j * m.w + i + 1];
    const c = m.arr[(j + 1) * m.w + i], d = m.arr[(j + 1) * m.w + i + 1];
    return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
  };
}

export function blur(m, passes) {
  let src = m.arr;
  for (let p = 0; p < passes; p++) {
    const out = new Float32Array(src.length);
    for (let j = 0; j < m.h; j++) {
      for (let i = 0; i < m.w; i++) {
        let s = 0, n = 0;
        for (let dj = -1; dj <= 1; dj++) {
          const jj = j + dj; if (jj < 0 || jj >= m.h) continue;
          for (let di = -1; di <= 1; di++) {
            const ii = i + di; if (ii < 0 || ii >= m.w) continue;
            s += src[jj * m.w + ii]; n++;
          }
        }
        out[j * m.w + i] = s / n;
      }
    }
    src = out;
  }
  return { ...m, arr: src };
}

// A random blob-shaped island with a few small islands around it.
function shapeFn(R) {
  const ox = R() * 900, oz = R() * 900, wx = R() * 900, wz = R() * 900;
  const ax = 0.72 + R() * 0.16, az = 0.72 + R() * 0.16;
  const rot = R() * Math.PI;
  const cr = Math.cos(rot), sr = Math.sin(rot);
  const islets = [];
  const nIslets = 3 + Math.floor(R() * 4);
  for (let k = 0; k < nIslets; k++) {
    const a = R() * Math.PI * 2, d = 0.72 + R() * 0.12;
    islets.push({ u: Math.cos(a) * d, v: Math.sin(a) * d, r: 0.05 + R() * 0.06 });
  }
  // u, v in -1..1. Returns > 0 on land.
  return (u, v) => {
    const pu = u + (fbm(u * 1.6 + wx, v * 1.6 + wz) - 0.5) * 0.55;
    const pv = v + (fbm(u * 1.6 + wz + 31, v * 1.6 + wx + 17) - 0.5) * 0.55;
    const ru = (pu * cr - pv * sr) / ax, rv = (pu * sr + pv * cr) / az;
    let val = 0.78 - Math.hypot(ru, rv) + (fbm(u * 2.6 + ox, v * 2.6 + oz) - 0.5) * 0.6;
    for (const s of islets) {
      const d = Math.hypot(u - s.u, v - s.v);
      val = Math.max(val, (s.r - d) * 2 + (noise2(u * 12 + ox, v * 12 + oz) - 0.5) * 0.08);
    }
    // never touch the edge of the world
    const edge = Math.max(Math.abs(u), Math.abs(v));
    if (edge > 0.86) val -= (edge - 0.86) * 6;
    return val;
  };
}

// Everything about an island except the 3D meshes: land shape and flag spots.
export function planIsland(id) {
  if (plans[id]) return plans[id];
  const isl = ISLAND_BY_ID[id];
  const R = rng((seed ^ Math.imul(ISLANDS.indexOf(isl) + 1, 0x9e3779b1)) >>> 0);
  const W = SIZE, H = SIZE;
  const shape = shapeFn(R);
  const w = Math.ceil(W / CELL), h = Math.ceil(H / CELL);
  const arr = new Float32Array(w * h);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      arr[j * w + i] = shape(((i + 0.5) / w) * 2 - 1, ((j + 0.5) / h) * 2 - 1) > 0 ? 1 : 0;
    }
  }
  const mask = { w, h, cell: CELL, arr };
  const land = sampler(mask, W, H);
  const soft = sampler(blur(mask, 2), W, H);

  // scatter this island's flags at random spots on land, spread apart
  const codes = codesOn(id).sort();
  const flags = [];
  for (const code of codes) {
    let best = null, bestGap = -1;
    for (let tries = 0; tries < 400; tries++) {
      const x = (R() - 0.5) * (W - 30), z = (R() - 0.5) * (H - 30);
      if (soft(x, z) < 0.9) continue;
      let gap = Infinity;
      for (const f of flags) gap = Math.min(gap, Math.hypot(f.x - x, f.z - z));
      if (gap >= MIN_GAP) { best = { x, z }; break; }
      if (gap > bestGap) { bestGap = gap; best = { x, z }; }
    }
    flags.push({ code, ...(best || { x: 0, z: 0 }) });
  }
  // middle of the biggest piece of land, for the first spawn
  let cx = 0, cz = 0, n = 0;
  for (let j = 0; j < h; j += 2) for (let i = 0; i < w; i += 2) {
    const x = (i + 0.5) * CELL - W / 2, z = (j + 0.5) * CELL - H / 2;
    if (Math.hypot(x, z) < W * 0.3 && arr[j * w + i]) { cx += x; cz += z; n++; }
  }
  const plan = { region: isl, W, H, mask, land, soft, flags, center: n ? { x: cx / n, z: cz / n } : { x: 0, z: 0 }, paint: (px) => paintIsland(plan, px) };
  plans[id] = plan;
  return plan;
}

export const WATER = '#3d9be0';
const SHALLOW = [120, 198, 239], DEEP = [61, 155, 224], SAND = [241, 227, 168];
const hex = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];

// Paints the island as a colourful map: meadows in pastel patches with white lines
// between them, beaches and shallow water. px = pixels per step.
export function paintIsland(plan, px) {
  const { W, H, soft } = plan;
  const cw = Math.round(W * px), ch = Math.round(H * px);
  const cv = document.createElement('canvas');
  cv.width = cw; cv.height = ch;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(cw, ch);
  const d = img.data;
  const pal = plan.region.patches.map(hex);
  // patch centres on a jittered grid (Voronoi), so they look like little regions
  const G = 70, gw = Math.ceil(W / G) + 2;
  const R = rng(plan.region.id + seed);
  const cells = [];
  for (let j = 0; j < gw; j++) for (let i = 0; i < gw; i++) {
    cells.push({ x: (i - 1 + 0.15 + R() * 0.7) * G - W / 2, z: (j - 1 + 0.15 + R() * 0.7) * G - H / 2, c: pal[Math.floor(R() * pal.length)] });
  }
  const line = Math.max(0.9, 1.5 / px);
  for (let py = 0; py < ch; py++) {
    const z = (py + 0.5) / px - H / 2;
    for (let pxl = 0; pxl < cw; pxl++) {
      const x = (pxl + 0.5) / px - W / 2;
      const s = soft(x, z);
      const k = (py * cw + pxl) * 4;
      let c;
      if (s < 0.05) c = DEEP;
      else {
        const hgt = baseHeight(s, x, z);
        if (hgt < -0.35) c = s < 0.18 ? DEEP : SHALLOW;
        else if (hgt < 0.25) c = SAND;
        else {
          // wiggly borders: look up the patch at a slightly warped spot
          const qx = x + (noise2(x * 0.05, z * 0.05) - 0.5) * 18, qz = z + (noise2(x * 0.05 + 40, z * 0.05 + 9) - 0.5) * 18;
          const gi = Math.floor((qx + W / 2) / G) + 1, gj = Math.floor((qz + H / 2) / G) + 1;
          let d1 = Infinity, d2 = Infinity, best = null;
          for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
            const ii = gi + di, jj = gj + dj;
            if (ii < 0 || jj < 0 || ii >= gw || jj >= gw) continue;
            const p = cells[jj * gw + ii];
            const dd = Math.hypot(p.x - qx, p.z - qz);
            if (dd < d1) { d2 = d1; d1 = dd; best = p; } else if (dd < d2) d2 = dd;
          }
          c = d2 - d1 < line ? [255, 255, 255] : best.c;
        }
      }
      d[k] = c[0]; d[k + 1] = c[1]; d[k + 2] = c[2]; d[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}
