// The player's character: a friendly low-poly kid with brown hair.
import * as THREE from 'three';

const SKIN = '#f0c39a', HAIR = '#6b3d1e', SHIRT = '#e8483f', PANTS = '#2f4f8f', SHOE = '#ffffff';

function box(w, h, d, color, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color, flatShading: true }));
  m.position.set(x, y, z);
  return m;
}

export function makeKid() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const legs = [-0.2, 0.2].map((x) => {
    const g = new THREE.Group();
    g.position.set(x, 0.85, 0);
    g.add(box(0.34, 0.62, 0.36, PANTS, 0, -0.3, 0));
    g.add(box(0.36, 0.2, 0.5, SHOE, 0, -0.74, 0.06));
    body.add(g);
    return g;
  });
  body.add(box(0.9, 0.9, 0.52, SHIRT, 0, 1.28, 0));
  body.add(box(0.92, 0.12, 0.54, PANTS, 0, 0.86, 0)); // belt line
  const arms = [-0.6, 0.6].map((x) => {
    const g = new THREE.Group();
    g.position.set(x, 1.66, 0);
    g.add(box(0.26, 0.4, 0.3, SHIRT, 0, -0.18, 0));
    g.add(box(0.22, 0.42, 0.26, SKIN, 0, -0.56, 0));
    body.add(g);
    return g;
  });

  const head = new THREE.Group();
  head.position.set(0, 2.15, 0);
  head.add(box(0.8, 0.78, 0.76, SKIN));
  head.add(box(0.88, 0.26, 0.84, HAIR, 0, 0.42, -0.01)); // top
  head.add(box(0.88, 0.62, 0.2, HAIR, 0, 0.12, -0.36)); // back
  head.add(box(0.12, 0.42, 0.7, HAIR, -0.43, 0.2, -0.05)); // sides
  head.add(box(0.12, 0.42, 0.7, HAIR, 0.43, 0.2, -0.05));
  head.add(box(0.5, 0.14, 0.12, HAIR, -0.12, 0.3, 0.38)); // fringe
  head.add(box(0.11, 0.13, 0.04, '#2a1a10', -0.17, 0.02, 0.39)); // eyes
  head.add(box(0.11, 0.13, 0.04, '#2a1a10', 0.17, 0.02, 0.39));
  head.add(box(0.26, 0.06, 0.04, '#b5523b', 0, -0.2, 0.39)); // smile
  head.add(box(0.1, 0.06, 0.03, '#f29b8a', -0.27, -0.1, 0.385)); // cheeks
  head.add(box(0.1, 0.06, 0.03, '#f29b8a', 0.27, -0.1, 0.385));
  body.add(head);

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.6, 16).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.25, depthWrite: false }),
  );

  let phase = 0;
  function animate(dt, speed, onGround, vy) {
    const amt = Math.min(1, speed / 8);
    if (onGround) {
      phase += dt * (4 + speed * 1.1);
      const s = Math.sin(phase) * 0.8 * amt;
      legs[0].rotation.x = s; legs[1].rotation.x = -s;
      arms[0].rotation.x = -s * 0.9; arms[1].rotation.x = s * 0.9;
      arms[0].rotation.z = arms[1].rotation.z = 0;
      body.position.y = Math.abs(Math.cos(phase)) * 0.09 * amt;
      if (amt < 0.05) { // idle: gentle breathing
        legs[0].rotation.x *= 0.8; legs[1].rotation.x *= 0.8;
        body.position.y = Math.sin(performance.now() / 500) * 0.02;
      }
    } else { // jumping
      const up = vy > 0 ? 1 : 0.6;
      arms[0].rotation.x = arms[1].rotation.x = -2.6 * up;
      arms[0].rotation.z = 0.3; arms[1].rotation.z = -0.3;
      legs[0].rotation.x = 0.5; legs[1].rotation.x = -0.3;
      body.position.y = 0;
    }
  }
  return { root, shadow, animate };
}
