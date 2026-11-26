// Progress is kept in this browser (localStorage), keyed by country code,
// so it survives closing the game and game updates.
const KEY = 'flag-explorer-save-v1';

// seed = which random world this save plays on (island shapes and where each flag is)
export const newSeed = () => Math.floor(Math.random() * 2 ** 31) + 1;
const fresh = () => ({ found: {}, seed: newSeed(), last: null, pos: {}, celebrated: {}, settings: { voice: true, fast: false } });

export function loadSave() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && typeof s === 'object') {
      const f = fresh();
      return { ...f, ...s, settings: { ...f.settings, ...(s.settings || {}) } };
    }
  } catch { /* fall through */ }
  return fresh();
}

let locked = false; // after a reset, nothing may write the old progress back

export function writeSave(s) {
  if (locked) return;
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage full or blocked */ }
}

// Erases progress but keeps settings (voice, fast mode).
export function resetSave(s) {
  const keep = s?.settings;
  try {
    localStorage.removeItem(KEY);
    if (keep) localStorage.setItem(KEY, JSON.stringify({ ...fresh(), settings: keep }));
  } catch { /* ignore */ }
  locked = true;
}

// Stops all saving until the page reloads (used when making a new world).
export function lockSave() { locked = true; }
