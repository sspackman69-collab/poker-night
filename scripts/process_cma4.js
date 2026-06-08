// Verify the Cleveland bronze As (gradient bg, two faces) crops cleanly to a
// rimless circular chip by extracting the obverse coin and masking to a circle.
const path = require('path');
const sharp = require('sharp');

const SIZE = 256;
const src = path.join(__dirname, '..', 'client', 'public', 'coins', 'candidates_wiki', 'cma_4.jpg');
const out = path.join(__dirname, '..', 'client', 'public', 'coins', 'processed', 'as_test.png');

(async () => {
  const meta = await sharp(src).metadata();
  const W = meta.width, H = meta.height;
  // Obverse coin sits in the left portion; estimate its bounding box.
  const cx = Math.round(0.305 * W), cy = Math.round(0.5 * H), r = Math.round(0.30 * H);
  const left = Math.max(0, cx - r), top = Math.max(0, cy - r);
  const side = Math.min(2 * r, W - left, H - top);

  const circle = Buffer.from(
    `<svg width="${SIZE}" height="${SIZE}"><circle cx="${SIZE/2}" cy="${SIZE/2}" r="${SIZE/2}" fill="#fff"/></svg>`
  );

  const coin = await sharp(src)
    .extract({ left, top, width: side, height: side })
    .resize(Math.round(SIZE * 1.04), Math.round(SIZE * 1.04), { fit: 'cover' })
    .resize(SIZE, SIZE, { fit: 'cover' })
    .toBuffer();

  await sharp(coin).composite([{ input: circle, blend: 'dest-in' }]).png().toFile(out);
  console.log(`src ${W}x${H}; crop left=${left} top=${top} side=${side} -> as_test.png`);
})();
