// Gather ancient Greek bronze coin candidates (for the value-1 chip) and merge
// into the existing manifest.
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'client', 'public', 'coins', 'candidates_wiki');
const API = 'https://commons.wikimedia.org/w/api.php';
const UA = 'PokerNight/1.0 (personal project)';

const TERMS = [
  'ancient Greek bronze coin',
  'Greek bronze coin Syracuse',
  'Hellenistic bronze coin',
  'Greek bronze coin Apollo',
  'Greek bronze coin Athena',
];
const TARGET = 8;
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
  let saved = 0;

  for (const term of TERMS) {
    if (saved >= TARGET) break;
    const url = `${API}?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=25`
      + `&gsrsearch=${encodeURIComponent(term)}`
      + `&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=500`;
    let data;
    try { data = await getJSON(url); } catch { continue; }
    for (const pg of Object.values(data?.query?.pages || {})) {
      if (saved >= TARGET) break;
      const ii = pg.imageinfo && pg.imageinfo[0];
      if (!ii || !ii.thumburl) continue;
      if (!/\.(jpe?g|png)$/i.test(ii.url)) continue;
      if (have.has(pg.title)) continue;
      const meta = ii.extmetadata || {};
      const lic = strip(meta.LicenseShortName?.value) || 'unknown';
      const file = `greekbronze_${saved + 1}.jpg`;
      try {
        await download(ii.thumburl, path.join(OUT, file));
        have.add(pg.title);
        manifest.push({ label: 'greekbronze', file, title: pg.title, license: lic, artist: strip(meta.Artist?.value), source: ii.descriptionurl });
        console.log(`greekbronze: ${file} [${lic}] ${pg.title.replace('File:', '')}`);
        saved++;
      } catch { /* skip */ }
    }
  }
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`\nmanifest now has ${manifest.length} candidates`);
})();
