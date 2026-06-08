// Fetch CC0 (public-domain) Roman coin images from the MET Open Access API.
// Saves a few candidates per "denomination" query so we can review them.
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'client', 'public', 'coins', 'candidates');
fs.mkdirSync(OUT, { recursive: true });

const SEARCH = 'https://collectionapi.metmuseum.org/public/collection/v1/search';
const OBJECT = 'https://collectionapi.metmuseum.org/public/collection/v1/objects';

// query label -> search term (Roman coin denominations)
const QUERIES = {
  as:         'roman coin as',
  sestertius: 'sestertius',
  denarius:   'denarius',
  aureus:     'aureus',
  solidus:    'solidus roman',
};

const PER_QUERY = 3;

async function getJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}

async function download(url, file) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`img ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  fs.writeFileSync(file, buf);
  return buf.length;
}

(async () => {
  const manifest = [];
  for (const [label, term] of Object.entries(QUERIES)) {
    let saved = 0;
    try {
      const res = await getJSON(`${SEARCH}?q=${encodeURIComponent(term)}&hasImages=true`);
      const ids = (res.objectIDs || []).slice(0, 40);
      for (const id of ids) {
        if (saved >= PER_QUERY) break;
        let obj;
        try { obj = await getJSON(`${OBJECT}/${id}`); } catch { continue; }
        const isCoin = /coin|denarius|sestertius|aureus|solidus|as\b/i.test(
          `${obj.title} ${obj.objectName} ${obj.classification}`
        );
        if (!obj.isPublicDomain) continue;          // CC0 only
        if (!obj.primaryImageSmall) continue;
        if (!isCoin) continue;
        const file = path.join(OUT, `${label}_${id}.jpg`);
        try {
          const bytes = await download(obj.primaryImageSmall, file);
          manifest.push({ label, id, title: obj.title, date: obj.objectDate, file: path.basename(file), bytes });
          saved++;
          console.log(`saved ${label}: ${obj.title} (${obj.objectDate}) -> ${path.basename(file)}`);
        } catch (e) { /* skip */ }
      }
    } catch (e) {
      console.log(`query "${term}" failed: ${e.message}`);
    }
    if (saved === 0) console.log(`(no public-domain coin images found for "${term}")`);
  }
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`\nDone. ${manifest.length} images in ${OUT}`);
})();
