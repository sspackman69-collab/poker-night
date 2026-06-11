const { freshDeck } = require('../deck');
const { findWinners, compareShowing, RANK_VALUES } = require('../handEvaluator');

const BRING_IN = 4; // 4 As units = $1.00 (ante is set per-room by the dealer)
const FINAL_STREET = 5; // 1 hole card + 4 up-cards

// Suit order to break ties for the lowest up-card (bring-in).
const SUIT_LOW = { clubs: 1, diamonds: 2, hearts: 3, spades: 4 };
const SUIT_SYMBOL = { clubs: '♣', diamonds: '♦', hearts: '♥', spades: '♠' };
const cardLabel = (c) => `${c.rank}${SUIT_SYMBOL[c.suit] || ''}`;
function cardIsLower(a, b) {
  const va = RANK_VALUES[a.rank];
  const vb = RANK_VALUES[b.rank];
  if (va !== vb) return va < vb;
  return SUIT_LOW[a.suit] < SUIT_LOW[b.suit];
}

/**
 * A game variant is a plain object of hooks the generic engine (GameRoom) calls.
 * The engine owns players, chips, the pot, betting mechanics, reconnection and
 * card-privacy MECHANISM; the variant decides dealing, streets, betting order
 * and winner selection. Helpers used below (room.dealTo, room.beginBetting,
 * room.livePlayers, room.playerAfter, room.goToShowdown, room.finishHand) are
 * provided by the engine — see gameState.js.
 */
module.exports = {
  id: 'five-card-stud',
  name: '5-Card Stud',
  minPlayers: 2,
  maxPlayers: 8,

  // Set up and deal a new hand, then open the first betting round.
  startHand(room) {
    room.deck = freshDeck();
    room.pot = 0;
    room.roundNumber++;
    room.street = 2;
    room.winners = null;

    for (const player of room.players.values()) {
      player.hand = [];
      player.bet = 0;
      player.folded = false;
      player.allIn = false;
      if (!player.connected) { player.folded = true; continue; } // sit out
      const ante = Math.min(room.ante, player.chips);
      room.payIntoPot(player, ante);
    }

    // One hole card (face down), then one door card (face up). Dealt in deal
    // order (dealer's left first, dealer last).
    for (const p of room.dealOrder()) room.dealTo(p, false);
    for (const p of room.dealOrder()) room.dealTo(p, true);

    // Bring-in: lowest up-card posts a forced bet; action starts to their left,
    // and the bring-in acts last on this opening round.
    const live = room.livePlayers();
    let bringIn = live[0];
    for (const p of live) if (cardIsLower(p.hand[1], bringIn.hand[1])) bringIn = p;

    const pay = Math.min(BRING_IN, bringIn.chips);
    bringIn.bet = pay;
    room.payIntoPot(bringIn, pay);
    if (bringIn.chips === 0) bringIn.allIn = true;
    room.currentBet = pay;

    // Transient message the server relays as a toast so players understand why
    // the action starts where it does.
    room.announce = `${bringIn.name} brings it in with the ${cardLabel(bringIn.hand[1])} and acts first`;

    // The bring-in (lowest up-card) acts first; play then proceeds to their left.
    room.beginBetting(bringIn.id);
    room.phase = 'betting';
  },

  // Called when a betting round completes (engine has already handled the
  // everyone-folded case). Deal the next street or go to showdown.
  onBettingComplete(room) {
    if (room.street >= FINAL_STREET) {
      room.goToShowdown();
      return;
    }

    room.street++;
    for (const p of room.dealOrder()) room.dealTo(p, true);
    for (const p of room.players.values()) p.bet = 0;
    room.currentBet = 0;

    // From the 3rd card on, the best hand SHOWING acts first.
    const contenders = room.livePlayers().filter(p => !p.allIn);
    if (contenders.length === 0) {
      // Everyone remaining is all-in — no betting; keep dealing / showdown.
      room.actionOrder = [];
      room.currentActorIndex = 0;
      room.endBettingRound();
      return;
    }
    let first = contenders[0];
    for (const p of contenders) {
      if (compareShowing(p.hand.slice(1), first.hand.slice(1)) > 0) first = p;
    }
    room.beginBetting(first.id);
  },

  // Decide the winner(s). Returns an array of pot-groups; each group splits an
  // equal share of the pot (one group here; Hi-Lo variants will return two).
  determineWinners(room) {
    const live = room.livePlayers().map(p => ({ id: p.id, name: p.name, hand: p.hand }));
    const winners = findWinners(live, room.wildRanks);
    return [{ winnerIds: winners.map(w => w.id), handName: winners[0].handName }];
  },
};
