const sevenCardStud = require('./sevenCardStud');

/**
 * Follow the Queen — 7-Card Stud with a shifting wild card.
 *
 * Rules:
 *  • Queens are ALWAYS wild.
 *  • The card dealt FACE-UP immediately after a face-up Queen also becomes wild
 *    (its whole rank, for everyone).
 *  • If another Queen turns up face-up, the wild "follows" it: the previous
 *    follower stops being wild and the NEXT face-up card sets the new one.
 *  • Between a Queen and its next up-card (and if a hand ends with a Queen as the
 *    last up-card), only Queens are wild.
 *
 * This reuses 7-stud's deal/streets/showdown wholesale and only adds the dynamic
 * wild via the engine's onCardDealt hook. State is kept on the room:
 *   room._fqPending  — a face-up Queen was just seen; the next up-card is wild
 *   room._fqFollower — the current "follower" wild rank (or null)
 */
module.exports = {
  ...sevenCardStud,
  id: 'follow-the-queen',
  name: 'Follow the Queen',
  staticWildRanks: ['Q'], // engine seeds this at hand start (Queens always wild)

  startHand(room) {
    room._fqPending = false;
    room._fqFollower = null;
    sevenCardStud.startHand(room);
  },

  // Runs (via room.dealTo) for every card as it's dealt.
  onCardDealt(room, player, card) {
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
  },
};
