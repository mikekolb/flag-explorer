// Copies the flag SVGs the game needs from the flag-icons package into public/flags.
// Adds width/height so iPad Safari can draw them onto a canvas.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { COUNTRIES } from '../src/data/countries.js';

const src = new URL('../node_modules/flag-icons/flags/4x3/', import.meta.url);
const out = new URL('../public/flags/', import.meta.url);
mkdirSync(out, { recursive: true });
let n = 0;
for (const c of COUNTRIES) {
  const file = c.code.toLowerCase() + '.svg';
  let svg = readFileSync(new URL(file, src), 'utf8');
  if (!/<svg[^>]*\swidth=/.test(svg)) svg = svg.replace('<svg', '<svg width="640" height="480"');
  writeFileSync(new URL(file, out), svg);
  n++;
}
console.log(`Copied ${n} flags to public/flags`);
