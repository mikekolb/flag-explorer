// Draws the home-screen icon (sky, hill, flag on a pole) as PNGs. Run once: node scripts/make-icons.mjs
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
const crcT = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
}
function png(size, file) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      let c = [143 - v * 40, 211 - v * 20, 255];                       // sky
      if ((u - 0.5) ** 2 / 0.5 + (v - 1.25) ** 2 / 0.25 < 1) c = [95, 200, 100]; // hill
      if (u > 0.33 && u < 0.37 && v > 0.18 && v < 0.78) c = [250, 250, 250];     // pole
      if (u >= 0.37 && u < 0.75 && v > 0.2 && v < 0.48) {                          // flag
        const wave = Math.sin(u * 14) * 0.02;
        if (v > 0.2 + wave && v < 0.48 + wave) c = [232, 72, 63];
        if (Math.hypot(u - 0.56, v - 0.34 - wave) < 0.06) c = [255, 210, 63];
      }
      if (Math.hypot(u - 0.35, v - 0.17) < 0.03) c = [255, 205, 50];              // gold ball
      raw.set([...c.map(Math.round), 255], y * (size * 4 + 1) + 1 + x * 4);
    }
  }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(size, 0); ih.writeUInt32BE(size, 4); ih[8] = 8; ih[9] = 6;
  writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}
for (const s of [180, 192, 512]) png(s, new URL(`../public/icon-${s}.png`, import.meta.url));
console.log('icons done');
