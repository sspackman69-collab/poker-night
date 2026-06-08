import { useEffect, useRef, useState } from 'react';
import { Coin, coinCounts } from './Coins';

// Where the pot pile sits, as % of the table overlay.
const POT_POS = { left: 50, top: 44 };

// Up to n representative coins for an amount (highest denominations first).
function repCoins(amount, n) {
  const out = [];
  for (const { value, count } of coinCounts(amount)) {
    for (let i = 0; i < count && out.length < n; i++) out.push(value);
  }
  return out;
}

let _id = 0;

// A single coin that animates from `from` to `to` (both {left%,top%}), fading
// in as it launches and out as it lands, then removes itself.
function Flyer({ from, to, value, delay, onDone }) {
  const [pos, setPos] = useState(from);
  const [op, setOp] = useState(0);
  useEffect(() => {
    const t0 = setTimeout(() => { setPos(to); setOp(1); }, 20 + delay);
    const t1 = setTimeout(() => setOp(0), 20 + delay + 470);
    const t2 = setTimeout(onDone, 20 + delay + 700);
    return () => { clearTimeout(t0); clearTimeout(t1); clearTimeout(t2); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div
      className="absolute"
      style={{
        left: `${pos.left}%`,
        top: `${pos.top}%`,
        transform: 'translate(-50%, -50%)',
        transition: 'left .55s cubic-bezier(.35,.1,.25,1), top .55s cubic-bezier(.35,.1,.25,1), opacity .23s ease-out',
        opacity: op,
      }}
    >
      <Coin value={value} size={26} />
    </div>
  );
}

export default function FlyingCoins({ ordered, seatPositions, potCoins, phase, winners, roundNumber, collectSignal }) {
  const [flyers, setFlyers] = useState([]);
  const prevBets = useRef({});
  const prevRound = useRef(roundNumber);
  const initialized = useRef(false);

  const remove = (id) => setFlyers(f => f.filter(x => x.id !== id));
  const spawn = (specs) => { if (specs.length) setFlyers(f => [...f, ...specs]); };

  // Bets flying INTO the pot whenever a player's bet increases.
  useEffect(() => {
    if (roundNumber !== prevRound.current) { prevBets.current = {}; prevRound.current = roundNumber; }
    if (!initialized.current) {
      ordered.forEach(p => { prevBets.current[p.id] = p.bet; });
      initialized.current = true;
      return;
    }
    const specs = [];
    ordered.forEach((p, i) => {
      const prev = prevBets.current[p.id] ?? 0;
      if (phase === 'betting' && p.bet > prev && seatPositions[i]) {
        repCoins(p.bet - prev, 5).forEach((value, k) =>
          specs.push({ id: ++_id, from: seatPositions[i], to: POT_POS, value, delay: k * 70 }));
      }
      prevBets.current[p.id] = p.bet;
    });
    spawn(specs);
  }, [ordered, phase, roundNumber, seatPositions]);

  // Whole pot flying OUT to the winner(s) — triggered explicitly when the dealer
  // collects (clicks Deal Next Hand), not automatically at results. Every actual
  // coin flies off coin-for-coin, so nothing is left on the table.
  useEffect(() => {
    if (!collectSignal) return;
    if (!winners?.length || !potCoins?.length) return;
    // Seats for each winner; distribute coins round-robin (handles split pots).
    const seats = winners
      .map(w => seatPositions[ordered.findIndex(p => p.id === w.id)])
      .filter(Boolean);
    if (!seats.length) return;
    const sorted = [...potCoins].sort((a, b) => b - a).slice(0, 60);
    const specs = sorted.map((value, k) => ({
      id: ++_id, from: POT_POS, to: seats[k % seats.length], value, delay: k * 45,
    }));
    spawn(specs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectSignal]);

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 40 }}>
      {flyers.map(f => (
        <Flyer key={f.id} from={f.from} to={f.to} value={f.value} delay={f.delay} onDone={() => remove(f.id)} />
      ))}
    </div>
  );
}
