// Top up the missing denominations (sestertius, aureus) and merge into the
// existing candidate manifest.
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'client', 'public', 'coins', 'candidates_wiki');
const API = 'https://commons.wikimedia.org/w/api.php';
const UA = 'PokerNight/1.0 (personal project)';

const QUERIES = {
  sestertius: ['sestertius', 'sestertius Hadrian', 'sestertius Nero'],
  aureus:     ['aureus', 'aureus Augustus', 'aureus Nero gold'],
};
const PER = 4;
const strip = (s) => (s || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

async function getJSON(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}
async function download(url, file) {
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`img ${r.status}`);
  fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
}

(async () => {
  const manifestPath = path.join(OUT, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const have = new Set(manifest.map(m => m.title));

  for (const [label, terms] of Object.entries(QUERIES)) {
    let saved = 0;
    for (const term of terms) {
      if (saved >= PER) break;
      const url = `${API}?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=25`
        + `&gsrsearch=${encodeURIComponent(term)}`
        + `&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=500`;
      let data;
      try { data = await getJSON(url); } catch { continue; }
      for (const pg of Object.values(data?.query?.pages || {})) {
        if (saved >= PER) break;
        const ii = pg.imageinfo && pg.imageinfo[0];
        if (!ii || !ii.thumburl) continue;
        if (!/\.(jpe?g|png)$/i.test(ii.url)) continue;
        if (have.has(pg.title)) continue;
        const meta = ii.extmetadata || {};
        const file = `${label}_${saved + 1}.jpg`;
        try {
          await download(ii.thumburl, path.join(OUT, file));
          have.add(pg.title);
          manifest.push({ label, file, title: pg.title, license: strip(meta.LicenseShortName?.value) || 'unknown', artist: strip(meta.Artist?.value), source: ii.descriptionurl });
          console.log(`${label}: ${file} [${strip(meta.LicenseShortName?.value)}] ${pg.title.replace('File:', '')}`);
          saved++;
        } catch { /* skip */ }
      }
    }
    if (saved === 0) console.log(`${label}: still none`);
  }
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`\nmanifest now has ${manifest.length} candidates`);
})();
