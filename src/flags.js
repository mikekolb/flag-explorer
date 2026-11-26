// Loads the bundled flag SVGs into small canvases (for 3D textures and map icons).
import { FLAG_URL } from './config.js';

const pending = new Map();
export const flagReady = new Map(); // code -> canvas, once loaded

export function flagCanvas(code) {
  if (!pending.has(code)) {
    pending.set(code, new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const cv = document.createElement('canvas');
        cv.width = 256; cv.height = 192;
        cv.getContext('2d').drawImage(img, 0, 0, 256, 192);
        flagReady.set(code, cv);
        resolve(cv);
      };
      img.onerror = () => resolve(null);
      img.src = FLAG_URL(code);
    }));
  }
  return pending.get(code);
}
