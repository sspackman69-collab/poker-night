// Cleveland Museum of Art Open Access — CC0 ancient coins (bronze focus).
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'client', 'public', 'coins', 'candidates_wiki');
const UA = 'PokerNight/1.0 (personal project)';
const API = 'https://openaccess-api.clevelandart.org/api/artworks/';

const TERMS = ['roman coin', 'greek coin bronze', 'sestertius', 'coin bronze ancient'];
const TARGET = 8;

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
    let data;
    try {
      data = await getJSON(`${API}?q=${encodeURIComponent(term)}&has_image=1&cc0=1&limit=40`);
    } catch (e) { console.log(`"${term}" failed ${e.message}`); continue; }
    for (const a of (data.data || [])) {
      if (saved >= TARGET) break;
      const lic = a.share_license_status || '';
      if (lic.toUpperCase() !== 'CC0') continue;
      const img = a.images && (a.images.web?.url || a.images.print?.url);
      if (!img) continue;
      const text = `${a.title} ${a.type} ${a.technique} ${a.culture}`.toLowerCase();
      if (!/coin|bronze|sestertius|as\b/.test(text)) continue;
      const key = `CMA:${a.id}`;
      if (have.has(key)) continue;
      const file = `cma_${saved + 1}.jpg`;
      try {
        await download(img, path.join(OUT, file));
        have.add(key);
        manifest.push({ label: 'cleveland', file, title: key, license: 'CC0', artist: 'Cleveland Museum of Art', source: a.url, desc: `${a.title} — ${a.culture} — ${a.technique}` });
        console.log(`cma: ${file} [CC0] ${a.title} | ${a.culture} | ${a.technique}`);
        saved++;
      } catch { /* skip */ }
    }
  }
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`\nmanifest now has ${manifest.length} candidates`);
})();
