const path = require('path');
const sharp = require('sharp');

const CAND = path.join(__dirname, '..', 'client', 'public', 'coins', 'candidates_wiki');
const OUT = path.join(__dirname, '..', 'client', 'public', 'coins', 'processed');
const SIZE = 256;
const circle = Buffer.from(
  `<svg width="${SIZE}" height="${SIZE}"><circle cx="${SIZE/2}" cy="${SIZE/2}" r="${SIZE/2}" fill="#fff"/></svg>`
);
const cover = (buf, zoom) =>
  sharp(buf).resize(Math.round(SIZE*zoom), Math.round(SIZE*zoom), { fit: 'cover' })
            .resize(SIZE, SIZE, { fit: 'cover' }).toBuffer();

async function chip(srcName, outName, opts) {
  const src = path.join(CAND, srcName);
  let coin;
  if (opts.mode === 'trim') {
    const t = await sharp(src).trim({ threshold: opts.trim }).toBuffer();
    coin = await cover(t, opts.zoom);
  } else { // centercrop
    const m = await sharp(src).metadata();
    const side = Math.round(Math.min(m.width, m.height) * opts.frac);
    const left = Math.max(0, Math.round((m.width - side) / 2 + (opts.dx || 0) * m.width));
    const top = Math.max(0, Math.round((m.height - side) / 2 + (opts.dy || 0) * m.height));
    const ex = await sharp(src).extract({ left, top, width: side, height: side }).toBuffer();
    coin = await cover(ex, opts.zoom);
  }
  await sharp(coin).composite([{ input: circle, blend: 'dest-in' }]).png().toFile(path.join(OUT, outName));
  console.log('wrote', outName);
}

(async () => {
  // Gold quinarius (Gallienus) — single coin on clean light bg -> auto-trim.
  await chip('goldquinarius_1.jpg', 'goldquinarius_preview.png', { mode: 'trim', trim: 38, zoom: 1.05 });
  // Philip I antoninianus — single coin on reddish textured bg -> center crop.
  await chip('antoninianus_1.jpg', 'antoninianus_preview.png', { mode: 'centercrop', frac: 0.74, zoom: 1.08, dy: -0.01 });
})();
