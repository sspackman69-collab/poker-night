import PlayerSeat from './PlayerSeat';
import { PotPile, fmtUSD } from './Coins';
import FlyingCoins from './FlyingCoins';

// Seat positions around the oval table (up to 8 players)
// Returns CSS positioning classes for each index
// Fixed anchor points around the oval, as {left%, top%} of the felt.
// Each seat is centered on its point (translate -50%,-50%) so its width can
// never push it into a neighbouring seat, regardless of window size.
// Clockwise from the dealer at 6 o'clock, up the left side, across the top,
// down the right — identical seat order for every viewer.
const SEAT_POSITIONS = [
  { left: 50, top: 90, label: 'bottom' },       // 0 — 6:00  dealer (bottom center)
  { left: 21, top: 80, label: 'bottom-left' },  // 1 — 7:30  bottom left
  { left: 7,  top: 50, label: 'left' },         // 2 — 9:00  left middle
  { left: 21, top: 20, label: 'top-left' },     // 3 — 10:30 top left
  { left: 50, top: 10, label: 'top' },          // 4 — 12:00 top center
  { left: 79, top: 20, label: 'top-right' },    // 5 — 1:30  top right
  { left: 93, top: 50, label: 'right' },        // 6 — 3:00  right middle
  { left: 79, top: 80, label: 'bottom-right' }, // 7 — 4:30  bottom right
];

export default function PokerTable({
  players,
  myId,
  currentActor,
  winners,
  phase,
  pot,
  potCoins,
  roundNumber,
  collecting,
  collectSignal,
}) {
  // Absolute seating: identical for every viewer.
  // Dealer is always seat 0 (6 o'clock); everyone else follows in join order.
  const dealerIdx = players.findIndex(p => p.isDealer);
  const ordered = dealerIdx >= 0
    ? [players[dealerIdx], ...players.filter((_, i) => i !== dealerIdx)]
    : players;

  const winnerIds = new Set((winners || []).map(w => w.id));

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {/* Outer wood border */}
      <div
        className="relative rounded-[50%] shadow-2xl"
        style={{
          width: 'min(90vw, 780px)',
          height: 'min(70vh, 480px)',
          background: 'radial-gradient(ellipse at 30% 30%, #a0703d, #6b4423 60%, #4a2e0f)',
          padding: '16px',
          boxShadow: '0 0 60px rgba(0,0,0,0.8), inset 0 2px 4px rgba(255,255,255,0.1)',
        }}
      >
        {/* Felt surface */}
        <div
          className="felt-texture w-full h-full rounded-[50%] relative overflow-hidden"
          style={{
            boxShadow: 'inset 0 0 40px rgba(0,0,0,0.4)',
          }}
        >
          {/* Table logo / center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 pointer-events-none">
            <div className="text-white/20 font-display text-2xl font-bold tracking-widest select-none">
              POKER NIGHT
            </div>
            {phase !== 'lobby' && (
              <div className="flex flex-col items-center gap-1">
                <div className="text-xs text-white/30 uppercase tracking-wider">Round {roundNumber}</div>
                {/* The pot stays visible at results (winner's coins waiting to
                    be collected); it's hidden only while it's flying off to the
                    winner after the dealer collects. */}
                {(potCoins?.length > 0) && !collecting && (
                  <>
                    <PotPile coins={potCoins || []} size={32} />
                    <span className="text-gold font-mono text-xl font-bold pot-chips">
                      POT: {fmtUSD(pot ?? 0)}
                    </span>
                  </>
                )}
              </div>
            )}
            {phase === 'lobby' && (
              <div className="text-xs text-white/30 uppercase tracking-wider mt-1">Waiting for players…</div>
            )}
          </div>

        </div>

        {/* Player seats live in an overlay OUTSIDE the felt's overflow:hidden,
            so seats and their coin stacks near the rim are never clipped. */}
        <div className="absolute inset-0 pointer-events-none">
          {ordered.map((player, i) => {
            const seat = SEAT_POSITIONS[i];
            if (!seat) return null; // beyond 8 players — shouldn't happen
            return (
              <div
                key={player.id}
                className="absolute"
                style={{
                  left: `${seat.left}%`,
                  top: `${seat.top}%`,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                <PlayerSeat
                  player={player}
                  isMe={player.id === myId}
                  isCurrentActor={player.id === currentActor}
                  isWinner={winnerIds.has(player.id)}
                  phase={phase}
                  position={seat.label}
                />
              </div>
            );
          })}
        </div>

        {/* Animated coins flying between seats and the pot */}
        <FlyingCoins
          ordered={ordered}
          seatPositions={SEAT_POSITIONS}
          potCoins={potCoins || []}
          phase={phase}
          winners={winners}
          roundNumber={roundNumber}
          collectSignal={collectSignal}
        />
      </div>
    </div>
  );
}
