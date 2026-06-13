import { useRef, useEffect } from 'react';

// Deal-animation timing, shared by the flying-card overlay and the static cards
// so the two stay in lockstep.
export const DEAL_STEP = 100;       // ms between consecutive cards in deal order
export const CARD_FLIGHT_MS = 380;  // how long a card spends flying to its seat

// Deal position for each player: 0 = first card off the deck (dealer's LEFT),
// N-1 = the dealer (dealt last). `players` is the table array (dealer-first seat
// order), so the dealer is normally index 0.
export function dealPositions(players, dealerId) {
  const ids = players.map((p) => p.id);
  const N = ids.length || 1;
  const di = ids.indexOf(dealerId);
  const pos = {};
  ids.forEach((id, i) => { pos[id] = di < 0 ? i : (i - di - 1 + N) % N; });
  return pos;
}

/**
 * Returns delayFor(playerId, cardIndex) → ms at which a card should FINISH its
 * flight and settle into the seat (i.e. its launch stagger PLUS the flight time).
 * Only freshly-dealt cards get a positive delay; cards already on the table get 0
 * so later renders (bets, streets) don't re-animate the board. The flying-card
 * overlay independently launches each card CARD_FLIGHT_MS earlier so it lands
 * exactly as the static card appears.
 */
export function useDealDelays(players, dealerId, roundNumber) {
  const prev = useRef({ round: -1, counts: {} });
  const pos = dealPositions(players, dealerId);
  const N = players.length || 1;
  const baseCounts = prev.current.round === roundNumber ? prev.current.counts : {};

  const delayFor = (playerId, cardIndex) => {
    const shown = baseCounts[playerId] || 0;
    if (cardIndex < shown) return 0; // already dealt — don't re-animate
    const dealtRound = cardIndex - shown; // 0-based among this deal's new cards
    return (dealtRound * N + (pos[playerId] ?? 0)) * DEAL_STEP + CARD_FLIGHT_MS;
  };

  useEffect(() => {
    const counts = {};
    for (const p of players) counts[p.id] = (p.hand?.length ?? p.cardCount ?? 0);
    prev.current = { round: roundNumber, counts };
  });

  return delayFor;
}
