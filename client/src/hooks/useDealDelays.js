import { useRef, useEffect } from 'react';

/**
 * Stagger card entrance animations so a deal cascades one card at a time, in the
 * real deal order (dealer's LEFT first, the dealer LAST), ~step ms apart.
 *
 * Returns delayFor(playerId, cardIndex) → milliseconds:
 *   • cards already on the table get 0 (no re-animation on later renders), and
 *   • each freshly-dealt card gets (round * N + dealPosition) * step, where the
 *     "round" is its position among the cards dealt in THIS deal (so the opening
 *     3-card stud deal cascades card-by-card across all seats, and each later
 *     street's single new card cascades around the table).
 *
 * `players` is the table array (Map/seat order: dealer first, then join order).
 */
export function useDealDelays(players, dealerId, roundNumber, step = 100) {
  const prev = useRef({ round: -1, counts: {} });

  const ids = players.map((p) => p.id);
  const N = ids.length || 1;
  const di = ids.indexOf(dealerId);
  // deal position: 0 = first card off the deck (dealer's left), N-1 = the dealer.
  const dealPos = {};
  ids.forEach((id, i) => {
    dealPos[id] = di < 0 ? i : (i - di - 1 + N) % N;
  });

  // A new hand resets the baseline so the whole board cascades; otherwise only
  // cards beyond what was already showing are treated as new.
  const baseCounts = prev.current.round === roundNumber ? prev.current.counts : {};

  const delayFor = (playerId, cardIndex) => {
    const shown = baseCounts[playerId] || 0;
    if (cardIndex < shown) return 0; // already dealt — don't re-animate
    const dealtRound = cardIndex - shown; // 0-based among this deal's new cards
    return (dealtRound * N + (dealPos[playerId] ?? 0)) * step;
  };

  // After each render, remember how many cards each seat is showing so the next
  // deal only staggers the genuinely new ones.
  useEffect(() => {
    const counts = {};
    for (const p of players) counts[p.id] = (p.hand?.length ?? p.cardCount ?? 0);
    prev.current = { round: roundNumber, counts };
  });

  return delayFor;
}
