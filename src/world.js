// Builds one continent: terrain shaped like the real map, sea, trees, houses,
// hills, caves and the hidden flags.
import * as THREE from 'three';
import { loadGeo, makeProjection, drawMask, drawGround } from './geo.js';
import { rng, fbm, smoothstep } from './noise.js';
import { flagCanvas } from './flags.js';

const MIN_GAP = 15; // steps between any two flags, so tiny countries each get room

function sampler(m, W, H) {
  return (x, z) => {
    const gx = Math.min(m.w - 1.001, Math.max(0, (x + W / 2) / m.cell - 0.5));
    const gz = Math.min(m.h - 1.001, Math.max(0, (z + H / 2) / m.cell - 0.5));
    const i = Math.floor(gx), j = Math.floor(gz), fx = gx - i, fz = gz - j;
    const a = m.arr[j * m.w + i], b = m.arr[j * m.w + i + 1];
    const c = m.arr[(j + 1) * m.w + i], d = m.arr[(j + 1) * m.w + i + 1];
    return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
  };
}

function blur(m, passes) {
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

export async function buildWorld(cont, countries, found, opts = {}) {
  await loadGeo();
  const proj = makeProjection(cont);
  const { W, H } = proj;
  const R = rng(cont.id + '-world');

  // ---- 1. place flags near their real spots, pushed apart so each has room ----
  let mask = drawMask(proj, 2);
  let land = sampler(mask, W, H);
  const flags = countries.map((c) => ({ c, code: c.code, ...proj.toWorld(c.lat, c.lon) }));
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
  // move flags that ended up in the sea onto nearby land, or give them an island
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

  // ---- 2. hiding spot for each flag ----
  for (const f of flags) {
    const r = rng(f.code)();
    f.type = r < 0.34 ? 'open' : r < 0.6 ? 'house' : r < 0.8 ? 'hill' : 'cave';
  }

  // ---- 3. height of the ground everywhere ----
  const bumps = [];
  for (const f of flags) if (f.type === 'hill') bumps.push({ x: f.x, z: f.z, h: 9, s: 6 });
  for (let n = 0, tries = 0; n < 22 && tries < 400; tries++) {
    const x = (R() - 0.5) * W, z = (R() - 0.5) * H;
    if (land(x, z) < 0.9 || flags.some((f) => Math.hypot(f.x - x, f.z - z) < 24)) continue;
    bumps.push({ x, z, h: 5 + R() * 6, s: 8 + R() * 6 }); n++;
  }
  function heightAt(x, z) {
    const m = smoothstep(0.3, 0.75, soft(x, z));
    let h = -0.8 + m * (1.1 + fbm(x * 0.018, z * 0.018) * 3.2);
    for (const b of bumps) {
      const dx = x - b.x, dz = z - b.z, d2 = dx * dx + dz * dz, lim2 = 9 * b.s * b.s;
      if (d2 < lim2) h += b.h * Math.exp(-d2 / (2 * b.s * b.s));
    }
    return h;
  }
  // tiny islands can end up under the sea once smoothed: lift a small mound so the flag stays dry
  for (const f of flags) {
    const y = heightAt(f.x, f.z);
    if (y < 0.7) bumps.push({ x: f.x, z: f.z, h: 1.5 - y, s: 4.5 });
  }
  for (const f of flags) f.y = heightAt(f.x, f.z);

  const group = new THREE.Group();
  const disposables = [];
  const keep = (o) => { disposables.push(o); return o; };

  // ---- 4. terrain mesh with the political map painted on it ----
  const px = Math.min(3.2, 2048 / Math.max(W, H));
  const groundCanvas = drawGround(proj, px, islands);
  const tex = keep(new THREE.CanvasTexture(groundCanvas));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = opts.anisotropy || 1;
  const segX = Math.round(W / 3), segZ = Math.round(H / 3);
  const tgeo = keep(new THREE.PlaneGeometry(W, H, segX, segZ));
  tgeo.rotateX(-Math.PI / 2);
  const pos = tgeo.attributes.position;
  const cols = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const h = heightAt(pos.getX(i), pos.getZ(i));
    pos.setY(i, h);
    const rock = smoothstep(5, 9, h);
    const shade = 0.93 + fbm(pos.getX(i) * 0.3, pos.getZ(i) * 0.3) * 0.14;
    cols[i * 3] = (1 - rock * 0.2) * shade;
    cols[i * 3 + 1] = (1 - rock * 0.28) * shade;
    cols[i * 3 + 2] = (1 - rock * 0.32) * shade;
  }
  tgeo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  tgeo.computeVertexNormals();
  const terrain = new THREE.Mesh(tgeo, keep(new THREE.MeshLambertMaterial({ map: tex, vertexColors: true, flatShading: true })));
  group.add(terrain);

  const seaGeo = keep(new THREE.PlaneGeometry(W * 5, H * 5));
  seaGeo.rotateX(-Math.PI / 2);
  const sea = new THREE.Mesh(seaGeo, keep(new THREE.MeshBasicMaterial({ color: '#2b8ee0', transparent: true, opacity: 0.45, depthWrite: false })));
  sea.position.y = 0;
  group.add(sea);
  const floor = new THREE.Mesh(seaGeo, keep(new THREE.MeshBasicMaterial({ color: '#2f86cf' })));
  floor.position.y = -1.0;
  floor.renderOrder = -1;
  group.add(floor);
  terrain.position.y = 0.001;

  // ---- 5. colliders (circles and boxes) in a grid for fast lookups ----
  const CS = 8, cells = new Map();
  function addCollider(c) {
    const ex = c.r ?? Math.max(c.hx, c.hz);
    for (let i = Math.floor((c.x - ex) / CS); i <= Math.floor((c.x + ex) / CS); i++)
      for (let j = Math.floor((c.z - ex) / CS); j <= Math.floor((c.z + ex) / CS); j++) {
        const k = i * 100003 + j;
        if (!cells.has(k)) cells.set(k, []);
        cells.get(k).push(c);
      }
  }
  function blocked(x, z, pad) {
    const k = Math.floor(x / CS) * 100003 + Math.floor(z / CS);
    const list = cells.get(k);
    if (!list) return false;
    return list.some((c) => (c.r != null ? Math.hypot(c.x - x, c.z - z) < c.r + pad : Math.abs(c.x - x) < c.hx + pad && Math.abs(c.z - z) < c.hz + pad));
  }
  function resolve(x, z, pr, feetY) {
    for (let pass = 0; pass < 2; pass++) {
      const ci = Math.floor(x / CS), cj = Math.floor(z / CS);
      for (let i = ci - 1; i <= ci + 1; i++) for (let j = cj - 1; j <= cj + 1; j++) {
        const list = cells.get(i * 100003 + j);
        if (!list) continue;
        for (const c of list) {
          if (c.top != null && feetY > c.top) continue;
          if (c.r != null) {
            const dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz), m = c.r + pr;
            if (d < m && d > 1e-4) { x = c.x + (dx / d) * m; z = c.z + (dz / d) * m; }
          } else {
            const qx = Math.max(c.x - c.hx, Math.min(x, c.x + c.hx));
            const qz = Math.max(c.z - c.hz, Math.min(z, c.z + c.hz));
            const dx = x - qx, dz = z - qz, d = Math.hypot(dx, dz);
            if (d < pr) {
              if (d > 1e-4) { x = qx + (dx / d) * pr; z = qz + (dz / d) * pr; }
              else { // inside the box: push out the short way
                const ox = c.hx + pr - Math.abs(x - c.x), oz = c.hz + pr - Math.abs(z - c.z);
                if (ox < oz) x += Math.sign(x - c.x || 1) * ox; else z += Math.sign(z - c.z || 1) * oz;
              }
            }
          }
        }
      }
    }
    return [x, z];
  }

  // ---- 6. houses ----
  const houses = [];
  const cx = flags.reduce((s, f) => s + f.x, 0) / Math.max(1, flags.length);
  const cz = flags.reduce((s, f) => s + f.z, 0) / Math.max(1, flags.length);
  for (const f of flags) {
    if (f.type !== 'house') continue;
    // put the house between the flag and the middle of the continent, so the flag hides behind it
    let dx = cx - f.x, dz = cz - f.z;
    const d = Math.hypot(dx, dz) || 1;
    dx /= d; dz /= d;
    const r = rng(f.code + 'h');
    if (r() < 0.5) { const t = dx; dx = -dz; dz = t; } // sometimes hide it on the side
    houses.push({ x: f.x + dx * 5.2, z: f.z + dz * 5.2, w: 4.6, d: 4.6, h: 3.4 + r() * 1.2, big: true });
  }
  for (let n = 0, tries = 0; n < 70 && tries < 2000; tries++) {
    const x = (R() - 0.5) * W, z = (R() - 0.5) * H;
    if (land(x, z) < 0.95 || heightAt(x, z) > 5) continue;
    if (flags.some((f) => Math.hypot(f.x - x, f.z - z) < 12)) continue;
    if (houses.some((h) => Math.hypot(h.x - x, h.z - z) < 7)) continue;
    houses.push({ x, z, w: 3 + R() * 2, d: 3 + R() * 2, h: 2.6 + R() * 1.4 });
    n++;
  }
  const wallMesh = new THREE.InstancedMesh(keep(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)), keep(new THREE.MeshLambertMaterial({ flatShading: true })), Math.max(1, houses.length));
  const roofGeo = keep(new THREE.ConeGeometry(0.75, 1, 4, 1).rotateY(Math.PI / 4).translate(0, 0.5, 0));
  const roofMesh = new THREE.InstancedMesh(roofGeo, keep(new THREE.MeshLambertMaterial({ flatShading: true })), Math.max(1, houses.length));
  const WALLS = ['#fff4e0', '#ffe7c2', '#e9f1ff', '#ffe0e6', '#e6ffe9'];
  const ROOFS = ['#e0533d', '#3d7be0', '#a0522d', '#e08a3d', '#7a4fc9'];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p3 = new THREE.Vector3();
  const col = new THREE.Color();
  houses.forEach((h, i) => {
    const base = Math.min(heightAt(h.x - h.w / 2, h.z - h.d / 2), heightAt(h.x + h.w / 2, h.z + h.d / 2), heightAt(h.x, h.z)) - 0.3;
    m4.compose(p3.set(h.x, base, h.z), q.identity(), sc.set(h.w, h.h + 0.3, h.d));
    wallMesh.setMatrixAt(i, m4);
    wallMesh.setColorAt(i, col.set(WALLS[i % WALLS.length]));
    m4.compose(p3.set(h.x, base + h.h + 0.3, h.z), q.identity(), sc.set(h.w * 1.45, 2, h.d * 1.45));
    roofMesh.setMatrixAt(i, m4);
    roofMesh.setColorAt(i, col.set(ROOFS[(i * 3) % ROOFS.length]));
    addCollider({ x: h.x, z: h.z, hx: h.w / 2, hz: h.d / 2 });
  });
  wallMesh.count = roofMesh.count = houses.length;
  group.add(wallMesh, roofMesh);

  // ---- 7. caves ----
  const caves = [];
  const rocks = [];
  for (const f of flags) {
    if (f.type !== 'cave') continue;
    const r = rng(f.code + 'c');
    const open = r() * Math.PI * 2; // direction of the cave mouth
    const gap = 1.3;
    caves.push({ x: f.x, z: f.z, open, gap });
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2;
      let diff = Math.abs(((a - open + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (diff < gap / 2 + 0.15) continue;
      const x = f.x + Math.cos(a) * 4.6, z = f.z + Math.sin(a) * 4.6;
      rocks.push({ x, z, s: 1.3 + r() * 0.5, rot: r() * 6 });
      addCollider({ x, z, r: 1.25 });
    }
  }
  const rockMesh = new THREE.InstancedMesh(keep(new THREE.DodecahedronGeometry(1, 0)), keep(new THREE.MeshLambertMaterial({ color: '#9a9088', flatShading: true })), Math.max(1, rocks.length));
  rocks.forEach((rk, i) => {
    m4.compose(p3.set(rk.x, heightAt(rk.x, rk.z) + 0.6, rk.z), q.setFromEuler(new THREE.Euler(rk.rot, rk.rot * 2, 0)), sc.set(rk.s, rk.s * 1.5, rk.s));
    rockMesh.setMatrixAt(i, m4);
  });
  rockMesh.count = rocks.length;
  group.add(rockMesh);
  for (const c of caves) {
    const phiG = Math.PI - c.open; // three.js sphere angle that faces the mouth
    const g = keep(new THREE.SphereGeometry(5.4, 10, 4, phiG + c.gap / 2, Math.PI * 2 - c.gap, 0, Math.PI / 2));
    const mat = keep(new THREE.MeshLambertMaterial({ color: '#8a8076', flatShading: true, side: THREE.DoubleSide, transparent: true, opacity: 1 }));
    const dome = new THREE.Mesh(g, mat);
    dome.scale.y = 0.85;
    dome.position.set(c.x, heightAt(c.x, c.z) - 0.4, c.z);
    c.mat = mat;
    group.add(dome);
  }

  // ---- 8. trees ----
  const trees = [];
  const target = Math.min(1800, Math.round((W * H) / 170));
  for (let tries = 0; trees.length < target && tries < target * 4; tries++) {
    const x = (R() - 0.5) * W, z = (R() - 0.5) * H;
    if (soft(x, z) < 0.85) continue;
    const h = heightAt(x, z);
    if (h > 8) continue;
    if (flags.some((f) => Math.hypot(f.x - x, f.z - z) < (f.type === 'cave' ? 9 : 6))) continue;
    if (blocked(x, z, 2)) continue;
    trees.push({ x, z, y: h, s: 0.8 + R() * 0.6, kind: R() < 0.55 ? 0 : 1 });
    addCollider({ x, z, r: 0.45 });
  }
  const trunkMesh = new THREE.InstancedMesh(keep(new THREE.CylinderGeometry(0.18, 0.26, 1.4, 5).translate(0, 0.7, 0)), keep(new THREE.MeshLambertMaterial({ color: '#8b5a2b', flatShading: true })), Math.max(1, trees.length));
  const pineGeo = keep(new THREE.ConeGeometry(1.3, 2.8, 6).translate(0, 2.6, 0));
  const roundGeo = keep(new THREE.IcosahedronGeometry(1.25, 0).translate(0, 2.4, 0));
  const leafMat = keep(new THREE.MeshLambertMaterial({ flatShading: true }));
  const pines = trees.filter((t) => t.kind === 0), rounds = trees.filter((t) => t.kind === 1);
  const pineMesh = new THREE.InstancedMesh(pineGeo, leafMat, Math.max(1, pines.length));
  const roundMesh = new THREE.InstancedMesh(roundGeo, leafMat, Math.max(1, rounds.length));
  const LEAVES = ['#3fa34d', '#4cb85a', '#2e8b45', '#66c25a', '#7fcf4f'];
  trees.forEach((t, i) => {
    m4.compose(p3.set(t.x, t.y - 0.1, t.z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), t.s * 9), sc.set(t.s, t.s, t.s));
    trunkMesh.setMatrixAt(i, m4);
  });
  [[pines, pineMesh], [rounds, roundMesh]].forEach(([list, mesh]) => {
    list.forEach((t, i) => {
      m4.compose(p3.set(t.x, t.y - 0.1, t.z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), t.s * 9), sc.set(t.s, t.s, t.s));
      mesh.setMatrixAt(i, m4);
      mesh.setColorAt(i, col.set(LEAVES[Math.floor(t.s * 37) % LEAVES.length]));
    });
    mesh.count = list.length;
  });
  trunkMesh.count = trees.length;
  group.add(trunkMesh, pineMesh, roundMesh);

  // ---- 9. flags ----
  const poleMesh = new THREE.InstancedMesh(keep(new THREE.CylinderGeometry(0.08, 0.1, 1, 6).translate(0, 0.5, 0)), keep(new THREE.MeshLambertMaterial({ flatShading: true })), Math.max(1, flags.length));
  const starGeo = keep(new THREE.OctahedronGeometry(0.4, 0));
  const starMat = keep(new THREE.MeshLambertMaterial({ color: '#ffd23f', emissive: '#7a5a00', flatShading: true }));
  const WHITE = new THREE.Color('#f4f4f4'), GOLD = new THREE.Color('#ffcc33');
  flags.forEach((f, i) => {
    const inCave = f.type === 'cave';
    f.poleH = inCave ? 2.7 : 4.6;
    f.fw = inCave ? 2.0 : 2.8;
    f.fh = f.fw * 0.75;
    m4.compose(p3.set(f.x, f.y - 0.2, f.z), q.identity(), sc.set(1, f.poleH + 0.2, 1));
    poleMesh.setMatrixAt(i, m4);
    poleMesh.setColorAt(i, found.has(f.code) ? GOLD : WHITE);
    addCollider({ x: f.x, z: f.z, r: 0.2 });
    const geo = keep(new THREE.PlaneGeometry(f.fw, f.fh, 10, 1).translate(f.fw / 2, 0, 0));
    const mat = keep(new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide }));
    const cloth = new THREE.Mesh(geo, mat);
    cloth.position.set(f.x, f.y + f.poleH - f.fh / 2 - 0.05, f.z);
    cloth.rotation.y = rng(f.code + 'r')() * Math.PI * 2;
    group.add(cloth);
    f.cloth = cloth;
    f.base = Float32Array.from(geo.attributes.position.array);
    f.index = i;
    flagCanvas(f.code).then((cv) => {
      if (!cv) return;
      const t = keep(new THREE.CanvasTexture(cv));
      t.colorSpace = THREE.SRGBColorSpace;
      mat.map = t; mat.needsUpdate = true;
    });
    if (found.has(f.code)) addStar(f);
  });
  poleMesh.count = flags.length;
  group.add(poleMesh);

  function addStar(f) {
    const s = new THREE.Mesh(starGeo, starMat);
    s.position.set(f.x, f.y + f.poleH + 0.45, f.z);
    group.add(s);
    f.star = s;
  }

  // ---- 10. hint beacon ----
  const beamMat = keep(new THREE.MeshBasicMaterial({ color: '#fff05a', transparent: true, opacity: 0.3, depthWrite: false, fog: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  const beam = new THREE.Mesh(keep(new THREE.CylinderGeometry(1.1, 1.1, 140, 12, 1, true).translate(0, 70, 0)), beamMat);
  beam.visible = false;
  group.add(beam);

  // ---- spawn point: on land, near the middle of the flags, not on top of one ----
  let spawn = { x: cx, z: cz };
  outer: for (let r = 0; r < 200; r += 3) {
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2;
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      if (Math.abs(x) > W / 2 - 5 || Math.abs(z) > H / 2 - 5) continue;
      if (land(x, z) > 0.9 && !blocked(x, z, 1.5) && flags.every((f) => Math.hypot(f.x - x, f.z - z) > 9)) { spawn = { x, z }; break outer; }
    }
  }

  return {
    cont, proj, W, H, group, flags, caves, groundCanvas, spawn, heightAt, resolve,
    markCollected(code) {
      const f = flags.find((x) => x.code === code);
      if (!f) return;
      poleMesh.setColorAt(f.index, GOLD);
      poleMesh.instanceColor.needsUpdate = true;
      if (!f.star) addStar(f);
    },
    setBeacon(f) {
      beam.visible = !!f;
      if (f) beam.position.set(f.x, f.y, f.z);
    },
    update(dt, t, px, pz) {
      for (const f of flags) {
        const d = Math.abs(f.x - px) + Math.abs(f.z - pz);
        if (d < 90) {
          const arr = f.cloth.geometry.attributes.position.array;
          for (let i = 0; i < arr.length; i += 3) {
            const x = f.base[i];
            arr[i + 2] = Math.sin(x * 2.2 - t * 5 + f.index) * 0.13 * (x / f.fw);
          }
          f.cloth.geometry.attributes.position.needsUpdate = true;
        }
        if (f.star) f.star.rotation.y = t * 2;
      }
      for (const c of caves) {
        const inside = Math.hypot(c.x - px, c.z - pz) < 7.5;
        const target = inside ? 0.22 : 1;
        c.mat.opacity += (target - c.mat.opacity) * Math.min(1, dt * 6);
        c.mat.depthWrite = c.mat.opacity > 0.95;
      }
      if (beam.visible) beamMat.opacity = 0.22 + Math.sin(t * 4) * 0.1;
    },
    dispose() {
      for (const d of disposables) d.dispose?.();
    },
  };
}
