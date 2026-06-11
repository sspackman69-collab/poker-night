const sevenCardStud = require('./sevenCardStud');

/**
 * The shifting-wild mechanic shared by Follow the Queen and Black Widow.
 *
 *  • Queens are ALWAYS wild.
 *  • The card dealt FACE-UP immediately after a face-up Queen also becomes wild
 *    (its whole rank, for everyone).
 *  • If another Queen turns up face-up, the wild "follows" it: the previous
 *    follower stops being wild and the NEXT face-up card sets the new one.
 *  • Between a Queen and its next up-card (and if a hand ends with a Queen as the
 *    last up-card), only Queens are wild.
 *
 * State lives on the room: _fqPending (a face-up Queen was just seen; next
 * up-card is wild) and _fqFollower (current follower wild rank, or null).
 */
function resetShiftingWild(room) {
  room._fqPending = false;
  room._fqFollower = null;
  room.wildRanks = new Set(['Q']);
}

function shiftingWildOnCardDealt(room, card) {
  if (!card.faceUp) return; // hidden cards never change the wild

  // The up-card right after a Queen becomes the follower wild.
  if (room._fqPending) {
    room._fqFollower = card.rank;
    room._fqPending = false;
  }
  // A face-up Queen (re)starts the chase: drop the old follower, arm the next.
  if (card.rank === 'Q') {
    room._fqPending = true;
    room._fqFollower = null;
  }

  // Rebuild the wild set: Queens always, plus the current follower (if any).
  room.wildRanks = new Set(['Q']);
  if (room._fqFollower) room.wildRanks.add(room._fqFollower);
}

/**
 * Follow the Queen — 7-Card Stud with the shifting wild above. Reuses 7-stud's
 * deal/streets/showdown wholesale and only adds the dynamic wild via the
 * engine's onCardDealt hook.
 */
module.exports = {
  ...sevenCardStud,
  id: 'follow-the-queen',
  name: 'Follow the Queen',
  staticWildRanks: ['Q'], // engine seeds this at hand start (Queens always wild)

  startHand(room) {
    resetShiftingWild(room);
    sevenCardStud.startHand(room);
  },

  onCardDealt(room, player, card) {
    shiftingWildOnCardDealt(room, card);
  },

  // Exported so Black Widow can reuse the exact same wild mechanic.
  resetShiftingWild,
  shiftingWildOnCardDealt,
};
