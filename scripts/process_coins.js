// Turn a real coin photo (uniform background) into a circular, transparent
// chip where the coin fills the whole disc — no background border.
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const OUT = path.join(__dirname, '..', 'client', 'public', 'coins', 'processed');
fs.mkdirSync(OUT, { recursive: true });

const SIZE = 256; // master size; displayed smaller via CSS, stays crisp

async function makeChip(input, outName, { zoom = 1.06, trimThreshold = 40 } = {}) {
  // 1) Trim the uniform background down to the coin's bounding box.
  // 2) Resize to fill a square (cover), zoomed slightly so the round coin
  //    reaches the chip edge.
  // 3) Mask to a circle so corners (and any leftover background) become clear.
  const circle = Buffer.from(
    `<svg width="${SIZE}" height="${SIZE}"><circle cx="${SIZE / 2}" cy="${SIZE / 2}" r="${SIZE / 2}" fill="#fff"/></svg>`
  );
  const ring = Buffer.from(
    `<svg width="${SIZE}" height="${SIZE}"><circle cx="${SIZE / 2}" cy="${SIZE / 2}" r="${SIZE / 2 - 3}" fill="none" stroke="#d4af37" stroke-width="6"/></svg>`
  );

  const coin = await sharp(input)
    .trim({ threshold: trimThreshold })
    .resize(Math.round(SIZE * zoom), Math.round(SIZE * zoom), { fit: 'cover' })
    .resize(SIZE, SIZE, { fit: 'cover' })
    .toBuffer();

  await sharp(coin)
    .composite([
      { input: circle, blend: 'dest-in' }, // circular mask
      { input: ring },                     // subtle gold rim
    ])
    .png()
    .toFile(path.join(OUT, outName));

  console.log('wrote', outName);
}

(async () => {
  const src = path.join(__dirname, '..', 'client', 'public', 'coins', 'candidates', 'as_248032.jpg');
  // Also emit a no-rim version to compare.
  await makeChip(src, 'denarius.png');
  // no-rim variant
  const circle = Buffer.from(`<svg width="${SIZE}" height="${SIZE}"><circle cx="${SIZE/2}" cy="${SIZE/2}" r="${SIZE/2}" fill="#fff"/></svg>`);
  const coin = await sharp(src).trim({ threshold: 40 }).resize(Math.round(SIZE*1.06), Math.round(SIZE*1.06), {fit:'cover'}).resize(SIZE, SIZE, {fit:'cover'}).toBuffer();
  await sharp(coin).composite([{ input: circle, blend: 'dest-in' }]).png().toFile(path.join(OUT, 'denarius_norim.png'));
  console.log('wrote denarius_norim.png');
  console.log('done ->', OUT);
})();
