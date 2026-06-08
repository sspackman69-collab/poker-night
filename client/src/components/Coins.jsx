// Ancient coin chips mapped to USD denominations. The game's internal unit is
// the As = $0.25, so the server works in whole "As units" (no floating point);
// the UI converts to dollars for display.
//
// value = price in As units (internal); usd = dollar value shown to players.
export const AS_USD = 0.25;
// mm = approximate real coin diameter, used to size coins relative to each other.
export const DENOMINATIONS = [
  { value: 1,   usd: 0.25, coin: 'As',             img: 'as',           mm: 27 }, // bronze
  { value: 4,   usd: 1,    coin: 'Sestertius',     img: 'sestertius',   mm: 34 }, // brass (largest)
  { value: 20,  usd: 5,    coin: 'Denarius',       img: 'denarius',     mm: 18 }, // silver
  { value: 40,  usd: 10,   coin: 'Antoninianus',   img: 'antoninianus', mm: 22 }, // silver (radiate)
  { value: 80,  usd: 20,   coin: 'Gold Quinarius', img: 'quinarius',    mm: 15 }, // gold (smallest)
  { value: 200, usd: 50,   coin: 'Aureus',         img: 'aureus',       mm: 19 }, // gold
  { value: 400, usd: 100,  coin: 'Solidus',        img: 'solidus',      mm: 20 }, // gold
];

const BY_VALUE = Object.fromEntries(DENOMINATIONS.map(d => [d.value, d]));
const DESC = [...DENOMINATIONS].sort((a, b) => b.value - a.value);

// Ante choices (As units → label), shared by the lobby and dealer controls.
export const ANTE_OPTIONS = [
  { units: 1, label: '$0.25' },
  { units: 2, label: '$0.50' },
  { units: 4, label: '$1.00' },
  { units: 8, label: '$2.00' },
  { units: 20, label: '$5.00' },
];

// Scale a base size by a coin's real diameter (22mm ≈ 1.0).
const REF_MM = 22;
export const coinFactor = (value) => (BY_VALUE[value]?.mm ?? REF_MM) / REF_MM;
export const coinPx = (value, base) => Math.round(base * coinFactor(value));

// ── unit conversions ─────────────────────────────────────────────────────────
export const toDollars = (asUnits) => asUnits * AS_USD;
export const toAsUnits = (dollars) => Math.round(dollars / AS_USD);
export const fmtUSD = (asUnits) =>
  '$' + toDollars(asUnits).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function largestDenom(amount) {
  return (DESC.find(d => amount >= d.value) || DENOMINATIONS[0]).value;
}

// A single coin image. `size` is a BASE size; the coin renders proportional to
// its real diameter (so a Sestertius is bigger than a Solidus). Pass
// scale={false} to render exactly at `size`.
export function Coin({ value, size = 20, title, scale = true }) {
  const d = BY_VALUE[value] || DESC.find(x => value >= x.value) || DENOMINATIONS[0];
  const px = scale ? coinPx(d.value, size) : size;
  return (
    <img
      src={`/coins/chips/${d.img}.png`}
      width={px}
      height={px}
      alt={d.coin}
      title={title || `${d.coin} ($${d.usd})`}
      style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,.5))', display: 'block' }}
    />
  );
}

// Greedy breakdown of an amount into coin counts, highest denomination first.
export function coinCounts(amount) {
  let rem = amount;
  const out = [];
  for (const d of DESC) {
    const count = Math.floor(rem / d.value);
    if (count > 0) { out.push({ ...d, count }); rem -= count * d.value; }
  }
  return out;
}

// Deterministic pseudo-random in [0,1) so the pile looks the same each render.
const rnd = (n) => { const x = Math.sin((n + 1) * 99.73) * 10000; return x - Math.floor(x); };

// A scattered pile of the ACTUAL coins in the pot (highest denoms on top).
export function PotPile({ coins = [], size = 40, cap = 60 }) {
  if (!coins.length) return null;
  const sorted = [...coins].sort((a, b) => b - a).slice(0, cap);
  const W = 220, H = 124;
  return (
    <div className="relative" style={{ width: W, height: H }}>
      {sorted.map((val, i) => {
        const px = coinPx(val, size);
        const x = rnd(i) * (W - px);
        const y = rnd(i + 37) * (H - px);
        const rot = rnd(i + 101) * 30 - 15;
        // coins is ordered highest-value first, so give earlier coins a HIGHER
        // z-index — high-value coins sit on top of lower-value ones.
        return (
          <div key={i} className="absolute" style={{ left: x, top: y, zIndex: sorted.length - i, transform: `rotate(${rot}deg)` }}>
            <Coin value={val} size={size} />
          </div>
        );
      })}
    </div>
  );
}

// A vertical stack of `count` coins of one denomination (poker-chip style).
// If onClick is given, the stack is a button (used to add a coin to a bet).
function CoinColumn({ value, count, size = 24, onClick }) {
  const px = coinPx(value, size);
  const shown = Math.min(count, 5);
  const offset = Math.max(4, Math.round(px * 0.16));
  const height = px + (shown - 1) * offset;
  const inner = (
    <>
      <div className="relative" style={{ width: px, height }}>
        {Array.from({ length: shown }).map((_, i) => (
          <div key={i} className="absolute left-0" style={{ bottom: i * offset, zIndex: i }}>
            <Coin value={value} size={size} />
          </div>
        ))}
      </div>
      <span className="text-white/60 text-[10px] mt-0.5 font-mono">×{count}</span>
    </>
  );
  if (onClick) {
    return (
      <button
        type="button"
        onClick={() => onClick(value)}
        title={`Add a ${BY_VALUE[value]?.coin} ($${BY_VALUE[value]?.usd}) to your bet`}
        className="flex flex-col items-center hover:scale-110 active:scale-95 transition-transform cursor-pointer"
      >
        {inner}
      </button>
    );
  }
  return <div className="flex flex-col items-center">{inner}</div>;
}

// The local player's chips, as a row of per-denomination stacks + dollar total.
// When `onCoinClick(value)` is provided, the stacks are clickable to build a bet.
//
// Prefer `purse` — the player's ACTUAL coins as a { [value]: count } map from the
// server — so the panel shows the real coins they hold (after change-making),
// not a greedy reconstruction. Falls back to a numeric `amount` if no purse.
export function MyCoins({ purse, amount, size = 28, onCoinClick }) {
  let counts, total;
  if (purse) {
    counts = DESC
      .filter(d => (purse[d.value] || 0) > 0)
      .map(d => ({ ...d, count: purse[d.value] }));
    total = DESC.reduce((t, d) => t + d.value * (purse[d.value] || 0), 0);
  } else {
    counts = coinCounts(amount || 0);
    total = amount || 0;
  }
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-end gap-2 min-h-[40px]">
        {counts.length === 0
          ? <span className="text-white/40 text-xs">No chips</span>
          : counts.map(c => (
              <CoinColumn key={c.value} value={c.value} count={c.count} size={size} onClick={onCoinClick} />
            ))}
      </div>
      <div className="text-gold font-mono text-sm font-bold">{fmtUSD(total)}</div>
    </div>
  );
}

// A compact cluster of the denominations a stack contains, plus the dollar total.
export function CoinStack({ amount, size = 18 }) {
  if (amount == null) return null;
  // Show the up-to-3 largest denominations present as a tidy overlapping stack,
  // plus the exact dollar total.
  const present = DESC.filter(d => amount >= d.value).slice(0, 3);
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex">
        {present.map((d, i) => (
          <div key={d.value} style={{ marginLeft: i ? -size * 0.4 : 0, zIndex: present.length - i }}>
            <Coin value={d.value} size={size} />
          </div>
        ))}
      </div>
      <span className="text-gold font-mono text-xs font-semibold">{fmtUSD(amount)}</span>
    </div>
  );
}
