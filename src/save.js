// Progress is kept in this browser (localStorage), keyed by country code,
// so it survives closing the game and game updates.
const KEY = 'flag-explorer-save-v1';

const fresh = () => ({ found: {}, last: null, pos: {}, celebrated: {}, settings: { voice: true, fast: false } });

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

export function writeSave(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage full or blocked */ }
}

export function resetSave() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
