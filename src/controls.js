// Touch controls (joystick on the left, drag to look, jump button) plus keyboard and mouse.
export function makeControls(layer, joyBase, joyKnob, jumpBtn) {
  const st = { mx: 0, my: 0, look: { x: 0, y: 0 }, jump: false, enabled: true };
  let joyId = null, joyOX = 0, joyOY = 0;
  let lookId = null, lastX = 0, lastY = 0;
  const keys = new Set();
  const RADIUS = 60;

  function showJoy(x, y) {
    joyBase.style.transform = `translate(${x - 70}px, ${y - 70}px)`;
    joyBase.classList.add('active');
    setKnob(0, 0);
  }
  function setKnob(dx, dy) { joyKnob.style.transform = `translate(${dx}px, ${dy}px)`; }
  function resetJoy() {
    joyId = null; st.mx = st.my = 0;
    joyBase.classList.remove('active');
    placeJoyHome();
  }
  function placeJoyHome() {
    const y = window.innerHeight - 150;
    joyBase.style.transform = `translate(${80}px, ${y - 70}px)`;
    setKnob(0, 0);
  }
  placeJoyHome();
  window.addEventListener('resize', () => { if (joyId === null) placeJoyHome(); });

  layer.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (!st.enabled) return;
    for (const t of e.changedTouches) {
      if (joyId === null && t.clientX < window.innerWidth * 0.45) {
        joyId = t.identifier; joyOX = t.clientX; joyOY = t.clientY;
        showJoy(joyOX, joyOY);
      } else if (lookId === null) {
        lookId = t.identifier; lastX = t.clientX; lastY = t.clientY;
      }
    }
  }, { passive: false });
  layer.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === joyId) {
        let dx = t.clientX - joyOX, dy = t.clientY - joyOY;
        const d = Math.hypot(dx, dy);
        if (d > RADIUS) { dx *= RADIUS / d; dy *= RADIUS / d; }
        setKnob(dx, dy);
        st.mx = dx / RADIUS; st.my = dy / RADIUS;
      } else if (t.identifier === lookId) {
        st.look.x += t.clientX - lastX; st.look.y += t.clientY - lastY;
        lastX = t.clientX; lastY = t.clientY;
      }
    }
  }, { passive: false });
  const end = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === joyId) resetJoy();
      if (t.identifier === lookId) lookId = null;
    }
  };
  layer.addEventListener('touchend', end);
  layer.addEventListener('touchcancel', end);

  // mouse: drag to look
  let mouseDown = false;
  layer.addEventListener('mousedown', (e) => { mouseDown = true; lastX = e.clientX; lastY = e.clientY; });
  window.addEventListener('mousemove', (e) => {
    if (!mouseDown || !st.enabled) return;
    st.look.x += e.clientX - lastX; st.look.y += e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
  });
  window.addEventListener('mouseup', () => { mouseDown = false; });

  // keyboard
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    keys.add(e.code);
    if (e.code === 'Space') { st.jump = true; e.preventDefault(); }
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());

  const pressJump = (e) => { e.preventDefault(); if (st.enabled) st.jump = true; };
  jumpBtn.addEventListener('touchstart', pressJump, { passive: false });
  jumpBtn.addEventListener('mousedown', pressJump);

  return {
    state: st,
    // returns movement in camera space: x = right, y = forward (each -1..1)
    read() {
      let x = st.mx, y = -st.my;
      if (st.enabled) {
        if (keys.has('KeyW') || keys.has('ArrowUp')) y += 1;
        if (keys.has('KeyS') || keys.has('ArrowDown')) y -= 1;
        if (keys.has('KeyD')) x += 1;
        if (keys.has('KeyA')) x -= 1;
        if (keys.has('ArrowLeft') || keys.has('KeyQ')) st.look.x -= 6;
        if (keys.has('ArrowRight') || keys.has('KeyE')) st.look.x += 6;
      } else { x = 0; y = 0; }
      const len = Math.hypot(x, y);
      if (len > 1) { x /= len; y /= len; }
      const look = { ...st.look };
      st.look.x = st.look.y = 0;
      const jump = st.jump; st.jump = false;
      return { x, y, look, jump };
    },
    setEnabled(v) {
      st.enabled = v;
      if (!v) { resetJoy(); lookId = null; keys.clear(); }
    },
  };
}
