// Gather Roman coin image candidates from Wikimedia Commons, with license &
// attribution captured for each, so we can pick clean-background ones to process.
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'client', 'public', 'coins', 'candidates_wiki');
fs.mkdirSync(OUT, { recursive: true });

const API = 'https://commons.wikimedia.org/w/api.php';
const UA = 'PokerNight/1.0 (personal project; contact: local)';

const QUERIES = {
  as:         'Roman as coin bronze',
  sestertius: 'sestertius Roman coin',
  denarius:   'denarius Roman coin',
  aureus:     'aureus Roman coin',
  solidus:    'solidus Roman coin',
};
const PER = 5;

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
  const manifest = [];
  for (const [label, term] of Object.entries(QUERIES)) {
    let saved = 0;
    const url = `${API}?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=20`
      + `&gsrsearch=${encodeURIComponent(term)}`
      + `&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=500`;
    let data;
    try { data = await getJSON(url); } catch (e) { console.log(`${label}: search failed ${e.message}`); continue; }
    const pages = Object.values(data?.query?.pages || {});
    for (const pg of pages) {
      if (saved >= PER) break;
      const ii = pg.imageinfo && pg.imageinfo[0];
      if (!ii || !ii.thumburl) continue;
      if (!/\.(jpe?g|png)$/i.test(ii.url)) continue; // skip svg/tif/etc
      const meta = ii.extmetadata || {};
      const license = strip(meta.LicenseShortName?.value) || 'unknown';
      const artist = strip(meta.Artist?.value);
      const file = `${label}_${saved + 1}.jpg`;
      try {
        await download(ii.thumburl, path.join(OUT, file));
        manifest.push({
          label, file,
          title: pg.title,
          license,
          artist,
          source: ii.descriptionurl,
        });
        console.log(`${label}: ${file}  [${license}]  ${pg.title.replace('File:', '')}`);
        saved++;
      } catch (e) { /* skip */ }
    }
    if (saved === 0) console.log(`${label}: none`);
  }
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`\n${manifest.length} candidates -> ${OUT}`);
})();
