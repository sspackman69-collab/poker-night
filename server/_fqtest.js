// Verify Follow the Queen's shifting wild card + full-hand conservation.
const assert = require('assert');
const ftq = require('./game/variants/followTheQueen');
const { GameRoom } = require('./game/gameState');
const { purseValue } = require('./game/bank');

let pass = 0, fail = 0;
const check = (n, fn) => { try { fn(); console.log(`  ✓ ${n}`); pass++; } catch (e) { console.log(`  ✗ ${n}\n      ${e.message}`); fail++; } };
const wilds = (room) => [...room.wildRanks].sort().join(',');

// Drive onCardDealt with a scripted sequence on a fake room.
function feed(seq) {
  const room = { wildRanks: new Set(['Q']), _fqPending: false, _fqFollower: null };
  for (const [rank, faceUp] of seq) ftq.onCardDealt(room, {}, { rank, suit: 'hearts', faceUp });
  return room;
}

console.log('\n── shifting wild logic ──');
check('Queens are wild from the start', () => {
  assert.strictEqual(wilds(feed([])), 'Q');
});
check('card after a face-up Queen becomes wild', () => {
  assert.strictEqual(wilds(feed([['Q', true], ['7', true]])), '7,Q');
});
check('face-down cards never change the wild', () => {
  assert.strictEqual(wilds(feed([['Q', true], ['7', false]])), 'Q'); // 7 was hidden → not wild yet
});
check('non-Queen up-cards after the follower do not change it', () => {
  assert.strictEqual(wilds(feed([['Q', true], ['7', true], ['K', true]])), '7,Q');
});
check('a new Queen drops the old follower and chases the next card', () => {
  // Q→7 (wild 7,Q), then Q (wild back to just Q), then 3 (wild 3,Q)
  assert.strictEqual(wilds(feed([['Q', true], ['7', true], ['Q', true]])), 'Q');
  assert.strictEqual(wilds(feed([['Q', true], ['7', true], ['Q', true], ['3', true]])), '3,Q');
});
check('Queen immediately following a Queen → wild follows to the next card', () => {
  assert.strictEqual(wilds(feed([['Q', true], ['Q', true], ['5', true]])), '5,Q');
});
check('hand ending on a Queen up-card leaves only Queens wild', () => {
  assert.strictEqual(wilds(feed([['Q', true], ['7', true], ['Q', true]])), 'Q');
});

console.log('\n── engine integration ──');
check('real hands deal without error; Queens always wild; pot conserved', () => {
  for (let t = 0; t < 200; t++) {
    const r = new GameRoom('FTQ', 'd', 'D', 's', 'follow-the-queen', 1, 400);
    const n = 2 + Math.floor(Math.random() * 3);
    const ids = ['d'];
    for (let i = 1; i < n; i++) { r.addPlayer('p' + i, 'P' + i, 's' + i, false, 400); ids.push('p' + i); }
    const TOTAL = ids.reduce((a, id) => a + purseValue(r.getPlayer(id).purse), 0);
    r.startRound();
    assert.ok(r.wildRanks.has('Q'), 'Queens must always be wild');
    let g = 0;
    while (r.phase === 'betting' && g++ < 300) {
      const a = r.getCurrentActor(); if (!a) break;
      const p = r.getPlayer(a); const owed = r.currentBet - p.bet;
      owed > 0 ? r.playerAction(a, 'call') : r.playerAction(a, 'check');
    }
    r.collectPot();
    const after = ids.reduce((a, id) => a + purseValue(r.getPlayer(id).purse), 0);
    assert.strictEqual(after, TOTAL, 'value conserved');
  }
});
check('variant is registered and listed', () => {
  const { getVariant, listVariants } = require('./game/variants');
  assert.strictEqual(getVariant('follow-the-queen').name, 'Follow the Queen');
  assert.ok(listVariants().some(v => v.id === 'follow-the-queen'));
});

console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
