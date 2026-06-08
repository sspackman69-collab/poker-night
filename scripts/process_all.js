// Build the final rimless, transparent coin chips, named by COIN (not value),
// so values can be reassigned without reprocessing images.
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const CAND = path.join(__dirname, '..', 'client', 'public', 'coins', 'candidates_wiki');
const OUT = path.join(__dirname, '..', 'client', 'public', 'coins', 'chips');
fs.mkdirSync(OUT, { recursive: true });

const SIZE = 256;
const circle = Buffer.from(
  `<svg width="${SIZE}" height="${SIZE}"><circle cx="${SIZE/2}" cy="${SIZE/2}" r="${SIZE/2}" fill="#fff"/></svg>`
);
const maskToChip = (buf, file) =>
  sharp(buf).composite([{ input: circle, blend: 'dest-in' }]).png().toFile(path.join(OUT, file));
const cover = (buf, zoom) =>
  sharp(buf).resize(Math.round(SIZE * zoom), Math.round(SIZE * zoom), { fit: 'cover' })
            .resize(SIZE, SIZE, { fit: 'cover' }).toBuffer();

const COINS = [
  { name: 'aureus',       src: 'aureus_3.jpg',     mode: 'trim',     trim: 35, zoom: 1.04 },
  { name: 'solidus',      src: 'solidus_1.jpg',    mode: 'trim',     trim: 35, zoom: 1.04 },
  { name: 'quinarius',    src: 'goldquinarius_1.jpg', mode: 'trim',  trim: 38, zoom: 1.05 },
  { name: 'sestertius',   src: 'sestertius_2.jpg', mode: 'trimleft', trim: 45, zoom: 1.06 },
  { name: 'denarius',     src: 'denarius_2.jpg',   mode: 'trimleft', trim: 45, zoom: 1.06 },
  { name: 'antoninianus', src: 'antoninianus_1.jpg', mode: 'centercrop', frac: 0.74, zoom: 1.08, dy: -0.01 },
  { name: 'as',           src: 'cma_4.jpg',        mode: 'extract',  cx: 0.305, cy: 0.50, r: 0.295, zoom: 1.18 },
];

async function build(c) {
  const src = path.join(CAND, c.src);
  let coin;
  if (c.mode === 'trim') {
    const trimmed = await sharp(src).trim({ threshold: c.trim }).toBuffer();
    coin = await cover(trimmed, c.zoom);
  } else if (c.mode === 'trimleft') {
    const t = await sharp(src).trim({ threshold: c.trim }).toBuffer({ resolveWithObject: true });
    const side = Math.min(t.info.height, t.info.width);
    const left = await sharp(t.data).extract({ left: 0, top: 0, width: side, height: side }).toBuffer();
    coin = await cover(left, c.zoom);
  } else if (c.mode === 'centercrop') {
    const m = await sharp(src).metadata();
    const side = Math.round(Math.min(m.width, m.height) * c.frac);
    const left = Math.max(0, Math.round((m.width - side) / 2 + (c.dx || 0) * m.width));
    const top = Math.max(0, Math.round((m.height - side) / 2 + (c.dy || 0) * m.height));
    coin = await cover(await sharp(src).extract({ left, top, width: side, height: side }).toBuffer(), c.zoom);
  } else { // extract by position
    const m = await sharp(src).metadata();
    const r = Math.round(c.r * m.height);
    const left = Math.max(0, Math.round(c.cx * m.width) - r);
    const top = Math.max(0, Math.round(c.cy * m.height) - r);
    const side = Math.min(2 * r, m.width - left, m.height - top);
    coin = await cover(await sharp(src).extract({ left, top, width: side, height: side }).toBuffer(), c.zoom);
  }
  await maskToChip(coin, `${c.name}.png`);
  console.log(`chip ${c.name}.png <- ${c.src}`);
}

(async () => {
  for (const c of COINS) await build(c);
  // Remove the old value-named chips (now superseded by coin-named files).
  for (const f of ['1.png', '5.png', '25.png', '100.png', '500.png']) {
    const p = path.join(OUT, f);
    if (fs.existsSync(p)) { fs.unlinkSync(p); console.log('removed old', f); }
  }
  console.log('\nDone ->', OUT);
})();
