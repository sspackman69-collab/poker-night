// Find candidates for the antoninianus and the gold quinarius.
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'client', 'public', 'coins', 'candidates_wiki');
const COMMONS = 'https://commons.wikimedia.org/w/api.php';
const CMA = 'https://openaccess-api.clevelandart.org/api/artworks/';
const UA = 'PokerNight/1.0 (personal project)';

const GROUPS = {
  antoninianus:  ['antoninianus', 'antoninianus Gordian', 'antoninianus radiate coin'],
  goldquinarius: ['aureus quinarius', 'gold quinarius Roman', 'quinarius aureus'],
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

  for (const [label, terms] of Object.entries(GROUPS)) {
    let saved = 0;

    // 1) Cleveland Museum (CC0) first
    try {
      const data = await getJSON(`${CMA}?q=${encodeURIComponent(label === 'antoninianus' ? 'antoninianus' : 'quinarius')}&has_image=1&cc0=1&limit=20`);
      for (const a of (data.data || [])) {
        if (saved >= PER) break;
        if ((a.share_license_status || '').toUpperCase() !== 'CC0') continue;
        const img = a.images && (a.images.web?.url || a.images.print?.url);
        if (!img) continue;
        const key = `CMA:${a.id}`;
        if (have.has(key)) continue;
        const file = `${label}_cma_${saved + 1}.jpg`;
        await download(img, path.join(OUT, file));
        have.add(key);
        manifest.push({ label, file, title: key, license: 'CC0', artist: 'Cleveland Museum of Art', source: a.url, desc: `${a.title} — ${a.culture}` });
        console.log(`${label}: ${file} [CC0] ${a.title}`);
        saved++;
      }
    } catch (e) { console.log(`${label} CMA failed: ${e.message}`); }

    // 2) Wikimedia Commons
    for (const term of terms) {
      if (saved >= PER) break;
      const url = `${COMMONS}?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=20`
        + `&gsrsearch=${encodeURIComponent(term)}&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=500`;
      let data;
      try { data = await getJSON(url); } catch { continue; }
      for (const pg of Object.values(data?.query?.pages || {})) {
        if (saved >= PER) break;
        const ii = pg.imageinfo && pg.imageinfo[0];
        if (!ii || !ii.thumburl || !/\.(jpe?g|png)$/i.test(ii.url)) continue;
        if (have.has(pg.title)) continue;
        const lic = strip(ii.extmetadata?.LicenseShortName?.value) || 'unknown';
        const file = `${label}_${saved + 1}.jpg`;
        try {
          await download(ii.thumburl, path.join(OUT, file));
          have.add(pg.title);
          manifest.push({ label, file, title: pg.title, license: lic, artist: strip(ii.extmetadata?.Artist?.value), source: ii.descriptionurl });
          console.log(`${label}: ${file} [${lic}] ${pg.title.replace('File:', '')}`);
          saved++;
        } catch { /* skip */ }
      }
    }
    if (saved === 0) console.log(`${label}: none found`);
  }
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`\nmanifest now has ${manifest.length} candidates`);
})();
