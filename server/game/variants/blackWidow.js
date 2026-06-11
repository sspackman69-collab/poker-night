const sevenCardStud = require('./sevenCardStud');
const { resetShiftingWild, shiftingWildOnCardDealt } = require('./followTheQueen');

/**
 * Black Widow — 7-Card Stud with the same shifting-wild rule as Follow the Queen,
 * plus two re-deal triggers (both pause for the DEALER to re-deal; the pot
 * carries over and no new ante is taken):
 *   1. The Queen of Spades appears FACE-UP (at any street).
 *   2. After the first up-cards (3rd-street door cards), NO queen is showing.
 *
 * Re-deal reuses 7-stud's deal with { keepPot, ante:false, bumpRound:false }.
 */

// Every face-up card currently on the table (live players only).
function upCards(room) {
  const out = [];
  for (const p of room.livePlayers()) for (const c of p.hand) if (c.faceUp) out.push(c);
  return out;
}

// If a re-deal condition is met, pause the hand (dealer must re-deal) and return
// true. `initial` enables the "no queens showing" check (only after door cards).
function blackWidowCheck(room, initial) {
  const ups = upCards(room);
  const qSpadeUp = ups.some(c => c.rank === 'Q' && c.suit === 'spades');
  if (qSpadeUp) {
    room.enterRedeal('🕷️ Black Widow! The Q♠ turned up — dealer must re-deal (pot carries over).');
    return true;
  }
  if (initial && !ups.some(c => c.rank === 'Q')) {
    room.enterRedeal('No queens showing on the door cards — dealer must re-deal (pot carries over).');
    return true;
  }
  return false;
}

module.exports = {
  ...sevenCardStud,
  id: 'black-widow',
  name: 'Black Widow',
  staticWildRanks: ['Q'],

  startHand(room) {
    resetShiftingWild(room);
    sevenCardStud.startHand(room); // antes + deal 3rd street + bring-in + phase 'betting'
    blackWidowCheck(room, true);   // may override phase to 'redeal'
  },

  // Dealer-triggered re-deal: fresh board, pot carries, NO new ante. A fresh
  // initial deal, so the "no queens" check applies again.
  redeal(room) {
    resetShiftingWild(room);
    sevenCardStud.startHand(room, { keepPot: true, ante: false, bumpRound: false });
    blackWidowCheck(room, true);
  },

  onCardDealt(room, player, card) {
    shiftingWildOnCardDealt(room, card);
  },

  onBettingComplete(room) {
    sevenCardStud.onBettingComplete(room); // deal next street or go to showdown
    if (room.phase === 'betting') blackWidowCheck(room, false); // only Q♠ after 3rd street
  },

  // Exported for tests.
  blackWidowCheck,
  upCards,
};
