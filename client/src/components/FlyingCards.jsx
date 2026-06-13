import { useEffect, useRef, useState } from 'react';
import { DEAL_STEP, CARD_FLIGHT_MS, dealPositions } from '../hooks/useDealDelays';

const SPIN_DEG = 1080; // three full turns in flight

let _id = 0;

// One card-back tumbling from the dealer to a seat. Mirrors the coin Flyer: it
// transitions its left/top (and rotation) from `from` to `to`, then removes
// itself right as the static seat card appears in its place.
function CardFlyer({ from, to, delay, onDone }) {
  const [pos, setPos] = useState(from);
  const [rot, setRot] = useState(0);
  const [op, setOp] = useState(0);
  useEffect(() => {
    const t0 = setTimeout(() => { setPos(to); setRot(SPIN_DEG); setOp(1); }, 20 + delay);
    const t1 = setTimeout(onDone, 20 + delay + CARD_FLIGHT_MS); // land = static card appears
    return () => { clearTimeout(t0); clearTimeout(t1); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div
      className="absolute"
      style={{
        left: `${pos.left}%`,
        top: `${pos.top}%`,
        transform: `translate(-50%, -50%) rotate(${rot}deg)`,
        transition: `left ${CARD_FLIGHT_MS}ms ease-out, top ${CARD_FLIGHT_MS}ms ease-out, transform ${CARD_FLIGHT_MS}ms ease-out, opacity 80ms ease-out`,
        opacity: op,
      }}
    >
      <div className="card card-back w-10 h-14 rounded-md border-2" />
    </div>
  );
}

/**
 * Spawns a flying card-back for every newly-dealt card, from the dealer's seat to
 * the recipient's seat, in deal order (dealer's left first, dealer last), so the
 * deal visibly cascades. Timing matches useDealDelays: launch = stagger, land =
 * stagger + CARD_FLIGHT_MS (when the static seat card appears).
 *
 * `ordered` is the seat-ordered player array; `seatPositions[i]` is the {left,top}%
 * of ordered[i]'s seat (same arrays the coin overlay uses).
 */
export default function FlyingCards({ ordered, seatPositions, dealerId, roundNumber }) {
  const [flyers, setFlyers] = useState([]);
  const prev = useRef({ round: -1, counts: {} });

  const remove = (id) => setFlyers((f) => f.filter((x) => x.id !== id));

  useEffect(() => {
    const N = ordered.length || 1;
    const pos = dealPositions(ordered, dealerId);
    const dealerIdx = ordered.findIndex((p) => p.id === dealerId);
    const dealerSeat = seatPositions[dealerIdx >= 0 ? dealerIdx : 0];

    // A new hand (or a fresh mount — this overlay mounts WITH the first deal,
    // since the table only renders once a hand starts) resets the baseline so the
    // opening deal flies. Otherwise only cards beyond what's shown fly (streets).
    const newRound = roundNumber !== prev.current.round;
    const base = newRound ? {} : prev.current.counts;

    const specs = [];
    ordered.forEach((p, i) => {
      const shown = base[p.id] || 0;
      const now = p.hand?.length ?? p.cardCount ?? 0;
      const seat = seatPositions[i];
      if (dealerSeat && seat) {
        for (let c = shown; c < now; c++) {
          const dealtRound = c - shown;
          const delay = (dealtRound * N + (pos[p.id] ?? 0)) * DEAL_STEP;
          specs.push({ id: ++_id, from: dealerSeat, to: seat, delay });
        }
      }
      base[p.id] = now;
    });

    if (specs.length) setFlyers((f) => [...f, ...specs]);
    prev.current = { round: roundNumber, counts: base };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ordered, dealerId, roundNumber]);

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 45 }}>
      {flyers.map((f) => (
        <CardFlyer key={f.id} from={f.from} to={f.to} delay={f.delay} onDone={() => remove(f.id)} />
      ))}
    </div>
  );
}
