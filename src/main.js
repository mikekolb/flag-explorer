import * as THREE from 'three';
import { CONTINENT_BY_ID } from './data/continents.js';
import { BY_CODE } from './data/countries.js';
import { ACTIVE_COUNTRIES, countriesIn } from './config.js';
import { ISLANDS, ISLAND_BY_ID, initIslands, islandOf, codesOn, planIsland } from './islands.js';
import { buildWorld } from './world.js';
import { makeKid } from './player.js';
import { makeControls } from './controls.js';
import { loadSave, writeSave, resetSave, lockSave, newSeed } from './save.js';
import { unlockSpeech, setVoiceOn } from './speech.js';
import { flagCanvas } from './flags.js';
import * as UI from './ui.js';

const $ = (id) => document.getElementById(id);
const save = loadSave();
// saves from before the random world: forget positions on the old real-map continents
for (const k of Object.keys(save.pos)) if (!ISLAND_BY_ID[k]) delete save.pos[k];
if (save.last && !ISLAND_BY_ID[save.last]) save.last = null;
writeSave(save); // keeps the world seed
initIslands(save.seed, ACTIVE_COUNTRIES.map((c) => c.code));
setVoiceOn(save.settings.voice);

// ---------- renderer & scene ----------
const fast = save.settings.fast;
const renderer = new THREE.WebGLRenderer({ antialias: !fast, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, fast ? 1 : 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
$('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const SKY = new THREE.Color('#8fd3ff');
scene.background = SKY;
scene.fog = new THREE.Fog(SKY, fast ? 90 : 120, fast ? 220 : 300);
scene.add(new THREE.HemisphereLight('#ffffff', '#7fae6a', 1.6));
const sun = new THREE.DirectionalLight('#fff6e0', 1.7);
sun.position.set(60, 100, 40);
scene.add(sun);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.3, fast ? 240 : 320);
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

const kid = makeKid();
scene.add(kid.root, kid.shadow);

const controls = makeControls($('touch-layer'), $('joy-base'), $('joy-knob'), $('btn-jump'));

// ---------- game state ----------
const player = { x: 0, y: 0, z: 0, vy: 0, onGround: true, face: 0, speed: 0 };
const cam = { yaw: 0, pitch: 0.38, dist: 10 };
let world = null;
let hint = null; // country code
let paused = true;

const game = {
  save, player,
  get world() { return world; },
  hintFlag: () => (hint && world ? world.flags.find((f) => f.code === hint) || null : null),
  onModalChange(open) { paused = open; controls.setEnabled(!open); },
  travel,
  setHint,
  setSetting(k, v) {
    save.settings[k] = v; writeSave(save);
    if (k === 'voice') setVoiceOn(v);
    if (k === 'fast') location.reload();
  },
  newWorld() {
    // a new random world: same found flags, new island shapes and flag spots
    save.seed = newSeed(); save.pos = {}; save.last = null;
    writeSave(save);
    lockSave(); // so the old position is not saved back while reloading
    location.reload();
  },
  resetAll() {
    // clear the copy in memory too, so nothing can save the old flags back
    save.found = {}; save.pos = {}; save.celebrated = {}; save.last = null;
    writeSave(save);
    resetSave(save);
    location.reload();
  },
};
UI.initUI(game);
if (import.meta.env.DEV) window.__game = game; // for testing on a computer only

function setHint(code) {
  hint = code;
  UI.hideBanner();
  const f = game.hintFlag();
  world?.setBeacon(f);
  if (code && !f) {
    const c = BY_CODE[code];
    const isl = ISLAND_BY_ID[islandOf(code)];
    UI.showBanner(`The flag of ${c.name} is on ${isl.name}. Open the Map and fly to ${isl.name} first!`);
    $('banner-go').onclick = () => { UI.hideBanner(); UI.openMap('world', isl.id); };
  }
}

// ---------- travelling between islands ----------
async function travel(id) {
  const isl = ISLAND_BY_ID[id];
  if (!isl) return;
  $('loading-text').textContent = `Flying to ${isl.name}…`;
  $('loading').classList.remove('hidden');
  paused = true;
  await new Promise((r) => setTimeout(r, 60)); // let the loading screen show
  if (world) { scene.remove(world.group); world.dispose(); world = null; }
  const found = new Set(Object.keys(save.found));
  world = await buildWorld(planIsland(id), found, { anisotropy: Math.min(4, renderer.capabilities.getMaxAnisotropy()) });
  scene.add(world.group);
  const p = save.pos[id] || world.spawn;
  player.x = p.x; player.z = p.z; player.y = world.heightAt(p.x, p.z); player.vy = 0;
  cam.yaw = p.yaw ?? 0;
  player.face = cam.yaw + Math.PI;
  save.last = id; writeSave(save);
  world.setBeacon(game.hintFlag());
  if (hint && game.hintFlag()) UI.hideBanner();
  UI.updateCounter();
  snapCamera();
  $('loading').classList.add('hidden');
  paused = UI.anyModalOpen();
}

// ---------- collecting ----------
let queue = Promise.resolve();
function collect(f) {
  save.found[f.code] = Date.now();
  writeSave(save);
  world.markCollected(f.code);
  if (hint === f.code) setHint(null);
  UI.updateCounter();
  const c = BY_CODE[f.code];
  queue = queue.then(() => UI.showFound(c)).then(() => checkCelebrations(c.continent, islandOf(c.code)));
}

async function checkCelebrations(contId, islId) {
  const ik = `island-${save.seed}-${islId}`;
  if (codesOn(islId).every((code) => save.found[code]) && !save.celebrated[ik]) {
    save.celebrated[ik] = 1; writeSave(save);
    await UI.celebrate(false, `You found every flag on ${ISLAND_BY_ID[islId].name}!`, 'Open the Map to fly to another island.');
  }
  const list = countriesIn(contId);
  const cont = CONTINENT_BY_ID[contId];
  if (list.every((c) => save.found[c.code]) && save.celebrated[contId] !== list.length) {
    save.celebrated[contId] = list.length; writeSave(save);
    await UI.celebrate(false, `You found every flag from ${cont.name}!`, `That's all ${list.length} countries. Amazing!`);
  }
  const total = ACTIVE_COUNTRIES.length;
  if (ACTIVE_COUNTRIES.every((c) => save.found[c.code]) && save.celebrated.all !== total) {
    save.celebrated.all = total; writeSave(save);
    await UI.celebrate(true, `You found all ${total} flags!`, 'You are a World Flag Champion!');
  }
}

// ---------- main loop ----------
const WALK = 10, GRAVITY = 32, JUMP = 12;
function snapCamera() { updateCamera(1, true); }
function updateCamera(dt, snap) {
  const tx = player.x, ty = player.y + 2, tz = player.z;
  const cp = Math.cos(cam.pitch);
  let x = tx + Math.sin(cam.yaw) * cp * cam.dist;
  let z = tz + Math.cos(cam.yaw) * cp * cam.dist;
  let y = ty + Math.sin(cam.pitch) * cam.dist;
  const g = world.heightAt(x, z) + 1.2;
  if (y < g) y = g;
  const k = snap ? 1 : Math.min(1, dt * 10);
  camera.position.x += (x - camera.position.x) * k;
  camera.position.y += (y - camera.position.y) * k;
  camera.position.z += (z - camera.position.z) * k;
  camera.lookAt(tx, ty, tz);
}

let last = performance.now(), t = 0, saveTimer = 0, miniTimer = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!world) return;
  t += dt;
  const input = controls.read();
  cam.yaw -= input.look.x * 0.0085;
  cam.pitch = Math.max(0.05, Math.min(1.2, cam.pitch + input.look.y * 0.005));

  if (!paused) {
    // walk relative to where the camera looks
    const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw);
    const rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
    let mx = fx * input.y + rx * input.x, mz = fz * input.y + rz * input.x;
    const mag = Math.min(1, Math.hypot(mx, mz));
    const ground = world.heightAt(player.x, player.z);
    const wading = ground < -0.25 && player.onGround;
    const speed = WALK * mag * (wading ? 0.8 : 1);
    if (mag > 0.05) {
      const l = Math.hypot(mx, mz); mx /= l; mz /= l;
      const target = Math.atan2(mx, mz);
      let d = target - player.face;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      player.face += d * Math.min(1, dt * 12);
    }
    let nx = player.x + mx * speed * dt, nz = player.z + mz * speed * dt;
    [nx, nz] = world.resolve(nx, nz, 0.5, player.y);
    nx = Math.max(-world.W / 2 + 2, Math.min(world.W / 2 - 2, nx));
    nz = Math.max(-world.H / 2 + 2, Math.min(world.H / 2 - 2, nz));
    player.x = nx; player.z = nz;
    player.speed = speed;

    if (input.jump && player.onGround) { player.vy = JUMP; player.onGround = false; }
    player.vy -= GRAVITY * dt;
    player.y += player.vy * dt;
    const gh = world.heightAt(player.x, player.z);
    if (player.y <= gh) { player.y = gh; player.vy = 0; player.onGround = true; }
    else if (player.onGround && player.y - gh < 0.6 && player.vy <= 0) { player.y = gh; player.vy = 0; } // stick to downhill slopes
    else player.onGround = false;

    // collect flags
    for (const f of world.flags) {
      if (save.found[f.code]) continue;
      if (Math.hypot(f.x - player.x, f.z - player.z) < 2.6 && Math.abs(f.y - player.y) < 4) collect(f);
    }
  } else {
    player.speed = 0;
  }

  kid.root.position.set(player.x, player.y, player.z);
  kid.root.rotation.y = player.face;
  kid.animate(dt, player.speed, player.onGround, player.vy);
  const sh = world.heightAt(player.x, player.z);
  kid.shadow.position.set(player.x, Math.max(sh, 0) + 0.06, player.z);
  kid.shadow.material.opacity = 0.25 * Math.max(0, 1 - (player.y - sh) / 6);

  updateCamera(dt);
  world.update(dt, t, player.x, player.z);
  renderer.render(scene, camera);

  // hint arrow
  const hf = game.hintFlag();
  if (hint && hf) {
    const dx = hf.x - player.x, dz = hf.z - player.z;
    const fwd = -Math.sin(cam.yaw) * dx + -Math.cos(cam.yaw) * dz;
    const right = Math.cos(cam.yaw) * dx + -Math.sin(cam.yaw) * dz;
    UI.updateHintGuide({ code: hint, angle: Math.atan2(right, fwd), dist: Math.hypot(dx, dz) });
  } else if (hint) {
    UI.updateHintGuide({ code: hint, elsewhere: ISLAND_BY_ID[islandOf(hint)].name });
  } else UI.updateHintGuide(null);

  miniTimer -= dt;
  if (miniTimer <= 0) { miniTimer = 0.1; UI.drawMinimap(); }
  saveTimer -= dt;
  if (saveTimer <= 0) {
    saveTimer = 3;
    save.pos[world.island.id] = { x: Math.round(player.x * 10) / 10, z: Math.round(player.z * 10) / 10, yaw: Math.round(cam.yaw * 100) / 100 };
    writeSave(save);
  }
}
requestAnimationFrame(frame);

// ---------- start screen ----------
const startId = save.last || ISLANDS[0].id;
const nFound = ACTIVE_COUNTRIES.filter((c) => save.found[c.code]).length;
$('start-progress').textContent = nFound ? `You have found ${nFound} of ${ACTIVE_COUNTRIES.length} flags.` : `There are ${ACTIVE_COUNTRIES.length} flags to find.`;
$('start-tip').textContent = window.navigator.standalone ? '' : 'Tip for grown-ups: tap Share, then "Add to Home Screen" to play full screen.';
ACTIVE_COUNTRIES.forEach((c) => { if (save.found[c.code]) flagCanvas(c.code); });

{
  const b = $('btn-play');
  b.disabled = false;
  b.textContent = nFound ? 'Keep playing' : 'Play';
  b.addEventListener('click', async () => {
    unlockSpeech();
    $('start').classList.add('hidden');
    $('hud').classList.remove('hidden');
    await travel(startId);
  }, { once: true });
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden && world) {
    save.pos[world.island.id] = { x: player.x, z: player.z, yaw: cam.yaw };
    writeSave(save);
  }
});
// stop iPad pinch-zoom and double-tap zoom
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());
