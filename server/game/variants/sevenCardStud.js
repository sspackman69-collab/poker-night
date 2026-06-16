const { freshDeck } = require('../deck');
const { findWinners, compareShowing, RANK_VALUES } = require('../handEvaluator');

const BRING_IN = 4; // 4 As units = $1.00 (ante is set per-room by the dealer)
const FINAL_STREET = 7; // 2 down + 4 up + 1 down

const SUIT_LOW = { clubs: 1, diamonds: 2, hearts: 3, spades: 4 };
function cardIsLower(a, b) {
  const va = RANK_VALUES[a.rank];
  const vb = RANK_VALUES[b.rank];
  if (va !== vb) return va < vb;
  return SUIT_LOW[a.suit] < SUIT_LOW[b.suit];
}

const SUIT_SYMBOL = { clubs: '♣', diamonds: '♦', hearts: '♥', spades: '♠' };
const cardLabel = (c) => `${c.rank}${SUIT_SYMBOL[c.suit] || ''}`;

// A player's face-up cards (used for bring-in and "best showing acts first").
const upCards = (p) => p.hand.filter(c => c.faceUp);

/**
 * 7-Card Stud. Reuses the generic engine exactly like 5-card stud; the only
 * differences are the deal (two hole cards + a door card to start, an extra
 * up-card street, and a final DOWN card) and best-5-of-7 evaluation (which
 * bestHand/findWinners already handle).
 */
module.exports = {
  id: 'seven-card-stud',
  name: '7-Card Stud',
  minPlayers: 2,
  maxPlayers: 7, // 7 players * 7 cards = 49 (fits a 52-card deck)

  // opts lets a variant re-use this deal logic for a mid-hand "re-deal" that
  // keeps the pot and skips antes (Black Widow). Defaults preserve normal play.
  startHand(room, opts = {}) {
    const { keepPot = false, ante = true, bumpRound = true } = opts;
    room.deck = freshDeck();
    if (!keepPot) room.pot = 0;
    if (bumpRound) room.roundNumber++;
    room.street = 3; // each player starts with 3 cards on third street
    room.winners = null;

    for (const player of room.players.values()) {
      player.hand = [];
      player.bet = 0;
      player.folded = false;
      player.allIn = false;
      // Sit out the disconnected and the broke ($0): they keep their seat but
      // aren't dealt in and don't ante.
      if (!player.connected || player.chips <= 0) { player.folded = true; player.sittingOut = true; continue; }
      player.sittingOut = false;
      if (ante) {
        const anteAmt = Math.min(room.ante, player.chips);
        room.payIntoPot(player, anteAmt);
      }
    }

    // Third street: two hole cards (face down) + one door card (face up). Dealt
    // in deal order (dealer's left first, dealer last).
    for (const p of room.dealOrder()) room.dealTo(p, false);
    for (const p of room.dealOrder()) room.dealTo(p, false);
    for (const p of room.dealOrder()) room.dealTo(p, true);

    // Bring-in: lowest door (up) card posts and acts first; play to their left.
    const live = room.livePlayers();
    let bringIn = live[0];
    for (const p of live) if (cardIsLower(upCards(p)[0], upCards(bringIn)[0])) bringIn = p;

    const pay = Math.min(BRING_IN, bringIn.chips);
    bringIn.bet = pay;
    room.payIntoPot(bringIn, pay);
    if (bringIn.chips === 0) bringIn.allIn = true;
    room.currentBet = pay;

    room.announce = `${bringIn.name} brings it in with the ${cardLabel(upCards(bringIn)[0])} and acts first`;

    room.beginBetting(bringIn.id);
    room.phase = 'betting';
  },

  onBettingComplete(room) {
    if (room.street >= FINAL_STREET) {
      room.goToShowdown();
      return;
    }

    room.street++;
    // Streets 4–6 are dealt face up; the 7th (river) is dealt face down.
    const faceUp = room.street <= 6;
    for (const p of room.dealOrder()) room.dealTo(p, faceUp);

    for (const p of room.players.values()) p.bet = 0;
    room.currentBet = 0;

    // From 4th street on, the best hand SHOWING (face-up cards) acts first.
    const contenders = room.livePlayers().filter(p => !p.allIn);
    if (contenders.length === 0) {
      room.actionOrder = [];
      room.currentActorIndex = 0;
      room.endBettingRound();
      return;
    }
    let first = contenders[0];
    for (const p of contenders) {
      if (compareShowing(upCards(p), upCards(first)) > 0) first = p;
    }
    room.beginBetting(first.id);
  },

  determineWinners(room) {
    // bestHand (via findWinners) automatically picks the best 5 of 7 cards.
    const live = room.livePlayers().map(p => ({ id: p.id, name: p.name, hand: p.hand }));
    const winners = findWinners(live, room.wildRanks);
    return [{ winnerIds: winners.map(w => w.id), handName: winners[0].handName }];
  },
};
