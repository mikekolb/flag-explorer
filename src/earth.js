// "Real world" map mode: each continent is a world shaped like the real map, and each
// flag sits near its real spot (pushed apart so tiny countries each get room).
// Makes the same kind of plan as planIsland() in islands.js, so world.js can build either.
import { loadGeo, makeProjection, drawMask, drawGround } from './geo.js';
import { CONTINENTS, CONTINENT_BY_ID } from './data/continents.js';
import { ACTIVE_COUNTRIES, countriesIn } from './config.js';
import { sampler, blur } from './islands.js';

const MIN_GAP = 15; // steps between any two flags, so tiny countries each get room

// only continents that have flags (the test build has just Europe)
export const CONTINENT_REGIONS = CONTINENTS.filter((c) => ACTIVE_COUNTRIES.some((k) => k.continent === c.id));

const plans = {};

export async function planContinent(id) {
  if (plans[id]) return plans[id];
  await loadGeo();
  const cont = CONTINENT_BY_ID[id];
  const proj = makeProjection(cont);
  const { W, H } = proj;

  // place flags near their real spots, pushed apart so each has room
  let mask = drawMask(proj, 2);
  let land = sampler(mask, W, H);
  const flags = countriesIn(id).map((c) => ({ code: c.code, ...proj.toWorld(c.lat, c.lon) }));
  const lim = (v, m) => Math.max(-m, Math.min(m, v));
  for (let it = 0; it < 120; it++) {
    for (let i = 0; i < flags.length; i++) {
      for (let j = i + 1; j < flags.length; j++) {
        const a = flags[i], b = flags[j];
        let dx = b.x - a.x, dz = b.z - a.z;
        let d = Math.hypot(dx, dz);
        if (d >= MIN_GAP) continue;
        if (d < 0.01) { dx = Math.cos(i + j); dz = Math.sin(i + j); d = 1; }
        const push = (MIN_GAP - d) / 2 + 0.01;
        a.x -= (dx / d) * push; a.z -= (dz / d) * push;
        b.x += (dx / d) * push; b.z += (dz / d) * push;
      }
    }
    for (const f of flags) { f.x = lim(f.x, W / 2 - 12); f.z = lim(f.z, H / 2 - 12); }
  }
  // move flags that ended up in the sea onto nearby land, or give them a small island
  const islands = [];
  const spacedOK = (f, x, z) => flags.every((o) => o === f || Math.hypot(o.x - x, o.z - z) >= MIN_GAP * 0.9);
  for (const f of flags) {
    if (land(f.x, f.z) > 0.7) continue;
    let done = false;
    for (let r = 2; r <= 26 && !done; r += 2) {
      for (let k = 0; k < 16 && !done; k++) {
        const a = (k / 16) * Math.PI * 2;
        const x = f.x + Math.cos(a) * r, z = f.z + Math.sin(a) * r;
        if (Math.abs(x) < W / 2 - 10 && Math.abs(z) < H / 2 - 10 && land(x, z) > 0.8 && spacedOK(f, x, z)) {
          f.x = x; f.z = z; done = true;
        }
      }
    }
    if (!done) islands.push({ x: f.x, z: f.z, r: 7 });
  }
  if (islands.length) { mask = drawMask(proj, 2, islands); land = sampler(mask, W, H); }
  const soft = sampler(blur(mask, 2), W, H);

  const n = Math.max(1, flags.length);
  const center = { x: flags.reduce((s, f) => s + f.x, 0) / n, z: flags.reduce((s, f) => s + f.z, 0) / n };
  const plan = { region: cont, W, H, mask, land, soft, flags, center, pxMax: 3.2, paint: (px) => drawGround(proj, px, islands) };
  plans[id] = plan;
  return plan;
}
