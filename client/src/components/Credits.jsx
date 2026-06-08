import { useState } from 'react';

// Attribution for the coin chip images. The CC BY-SA images legally require
// credit; the CC0 / public-domain ones are acknowledged for completeness.
const CREDITS = [
  { coin: 'As — Antoninus Pius', src: 'Cleveland Museum of Art (Open Access)', license: 'CC0',
    url: 'https://www.clevelandart.org/art/collection/search?onview=Open%20Access' },
  { coin: 'Sestertius — Hadrian', src: 'Wikimedia Commons', license: 'CC0',
    url: 'https://commons.wikimedia.org/wiki/File:Sestertius_Hadrianus_Roma_Victory_Cornucopia.jpg' },
  { coin: 'Denarius — Cornelius Cethegus', src: 'Wikimedia Commons', license: 'CC0',
    url: 'https://commons.wikimedia.org/wiki/File:Cornelius_Cethegus,_denarius,_115-114_BC,_RRC_288.png' },
  { coin: 'Antoninianus — Philip I', src: '“AV Antoninianus Phillipus” by Cmx, via Wikimedia Commons', license: 'CC BY-SA 3.0',
    url: 'https://commons.wikimedia.org/wiki/File:AV_Antoninianus_Phillipus.JPG' },
  { coin: 'Gold Quinarius — Gallienus', src: 'International Numismatic Club, via Wikimedia Commons', license: 'CC BY-SA 4.0',
    url: 'https://commons.wikimedia.org/wiki/File:INC-2035-a_%D0%97%D0%BE%D0%BB%D0%BE%D1%82%D0%BE%D0%B9_%D0%BA%D0%B2%D0%B8%D0%BD%D0%B0%D1%80%D0%B8%D0%B9_(%D0%BB%D0%B5%D0%B3%D0%BA%D0%B8%D0%B9_%D0%B0%D1%83%D1%80%D0%B5%D1%83%D1%81)._%D0%93%D0%B0%D0%BB%D0%BB%D0%B8%D0%B5%D0%BD._%D0%9E%D0%BA._260%E2%80%94268_%D0%B3%D0%B3._(%D0%B0%D0%B2%D0%B5%D1%80%D1%81).png' },
  { coin: 'Aureus — Nero', src: 'Wikimedia Commons', license: 'CC0',
    url: 'https://commons.wikimedia.org/wiki/File:Gold_Aureus_of_Nero.png' },
  { coin: 'Solidus — Leontius', src: 'Wikimedia Commons', license: 'Public domain',
    url: 'https://commons.wikimedia.org/wiki/File:Solidus_Leontius_Antioch.jpg' },
];

export default function Credits() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-white/25 text-[10px] hover:text-white/50"
      >
        Coin credits
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div
            className="bg-gray-900 border border-white/10 rounded-2xl max-w-lg w-full p-6 max-h-[80vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-xl text-white font-bold">Coin Image Credits</h2>
              <button onClick={() => setOpen(false)} className="text-white/40 hover:text-white text-xl leading-none">×</button>
            </div>
            <p className="text-white/50 text-xs mb-4">
              Coin photographs are used under the licenses noted below. The coins themselves are ancient;
              the photos are credited to their sources.
            </p>
            <ul className="flex flex-col gap-3">
              {CREDITS.map(c => (
                <li key={c.coin} className="text-sm">
                  <div className="text-white font-semibold">{c.coin}</div>
                  <div className="text-white/60 text-xs">
                    {c.src} — <span className={c.license.includes('BY') ? 'text-amber-400' : 'text-green-400'}>{c.license}</span>
                  </div>
                  {c.url && (
                    <a href={c.url} target="_blank" rel="noreferrer" className="text-blue-400 text-xs hover:underline break-all">
                      source
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
