// Verify Black Widow: Q♠ / no-queens re-deal triggers, pot-carry on re-deal,
// shifting wild (inherited), and full-hand value conservation through re-deals.
const assert = require('assert');
const bw = require('./game/variants/blackWidow');
const { GameRoom } = require('./game/gameState');
const { purseValue } = require('./game/bank');

let pass = 0, fail = 0;
const check = (n, fn) => { try { fn(); console.log(`  ✓ ${n}`); pass++; } catch (e) { console.log(`  ✗ ${n}\n      ${e.message}`); fail++; } };

const card = (rank, suit, faceUp = true) => ({ rank, suit, faceUp });
// Build a black-widow room with two live players and given door (up) cards.
function roomWithDoors(doorA, doorB) {
  const r = new GameRoom('BW', 'd', 'D', 's', 'black-widow', 1, 400);
  r.addPlayer('p2', 'P2', 's2', false, 400);
  r.phase = 'betting';
  r.getPlayer('d').hand = [card('2', 'clubs', false), card('3', 'clubs', false), doorA];
  r.getPlayer('p2').hand = [card('4', 'clubs', false), card('5', 'clubs', false), doorB];
  return r;
}

console.log('\n── re-deal triggers (initial door cards) ──');
check('Q♠ face-up on a door card → re-deal pause', () => {
  const r = roomWithDoors(card('Q', 'spades'), card('7', 'hearts'));
  const fired = bw.blackWidowCheck(r, true);
  assert.strictEqual(fired, true);
  assert.strictEqual(r.phase, 'redeal');
  assert.ok(/Q♠/.test(r.redealReason));
});
check('no queens showing on doors → re-deal pause', () => {
  const r = roomWithDoors(card('7', 'hearts'), card('K', 'spades'));
  assert.strictEqual(bw.blackWidowCheck(r, true), true);
  assert.strictEqual(r.phase, 'redeal');
  assert.ok(/queens/i.test(r.redealReason));
});
check('a non-spade Queen on a door → NO re-deal', () => {
  const r = roomWithDoors(card('Q', 'hearts'), card('7', 'clubs'));
  assert.strictEqual(bw.blackWidowCheck(r, true), false);
  assert.strictEqual(r.phase, 'betting');
});

console.log('\n── re-deal triggers (later streets) ──');
check('Q♠ up on a later street → re-deal', () => {
  const r = roomWithDoors(card('Q', 'hearts'), card('7', 'clubs')); // queen present, no spade
  // 4th street: p2 catches the Q♠ up
  r.getPlayer('p2').hand.push(card('Q', 'spades'));
  assert.strictEqual(bw.blackWidowCheck(r, false), true);
  assert.strictEqual(r.phase, 'redeal');
});
check('no-queens check does NOT apply after the door cards', () => {
  const r = roomWithDoors(card('7', 'hearts'), card('8', 'clubs')); // no queens anywhere
  assert.strictEqual(bw.blackWidowCheck(r, false), false); // initial=false → ignored
  assert.strictEqual(r.phase, 'betting');
});

console.log('\n── engine plumbing ──');
check('GameRoom.redeal() rejected unless phase is redeal', () => {
  const r = new GameRoom('BW2', 'd', 'D', 's', 'black-widow', 1, 400);
  r.addPlayer('p2', 'P2', 's2', false, 400);
  assert.ok(r.redeal().error); // phase is 'lobby'
});
check('redeal keeps the pot and does NOT bump the round number', () => {
  const r = roomWithDoors(card('Q', 'spades'), card('7', 'hearts'));
  bw.blackWidowCheck(r, true);            // → redeal phase
  r.roundNumber = 5; r.pot = 40; r.potCoins = [20, 20];
  const potBefore = r.pot;
  r.redeal();
  assert.strictEqual(r.roundNumber, 5, 'round number unchanged');
  assert.ok(r.pot >= potBefore, 'pot carried (may grow by a bring-in, never reset)');
});
check('variant registered and listed', () => {
  const { getVariant, listVariants } = require('./game/variants');
  assert.strictEqual(getVariant('black-widow').name, 'Black Widow');
  assert.ok(listVariants().some(v => v.id === 'black-widow'));
});

console.log('\n── full-hand conservation (incl. re-deals) ──');
check('value conserved across 300 hands; re-deals do occur', () => {
  let redeals = 0, handsWithRedeal = 0;
  for (let t = 0; t < 300; t++) {
    const r = new GameRoom('BWC', 'd', 'D', 's', 'black-widow', 1, 400);
    const n = 2 + Math.floor(Math.random() * 3);
    const ids = ['d'];
    for (let i = 1; i < n; i++) { r.addPlayer('p' + i, 'P' + i, 's' + i, false, 400); ids.push('p' + i); }
    const TOTAL = ids.reduce((a, id) => a + purseValue(r.getPlayer(id).purse), 0);
    r.startRound();
    let guard = 0, sawRedeal = false;
    while (guard++ < 400) {
      if (r.phase === 'redeal') { redeals++; sawRedeal = true; r.redeal(); continue; }
      if (r.phase !== 'betting') break;
      const a = r.getCurrentActor(); if (!a) break;
      const p = r.getPlayer(a); const owed = r.currentBet - p.bet;
      owed > 0 ? r.playerAction(a, 'call') : r.playerAction(a, 'check');
    }
    if (sawRedeal) handsWithRedeal++;
    r.collectPot();
    const after = ids.reduce((a, id) => a + purseValue(r.getPlayer(id).purse), 0);
    assert.strictEqual(after, TOTAL, `value conserved (hand ${t})`);
    assert.ok(r.wildRanks.has('Q'), 'Queens always wild');
  }
  console.log(`     (observed ${redeals} re-deals across ${handsWithRedeal} hands)`);
  assert.ok(redeals > 0, 'expected some re-deals to fire over 300 hands');
});

console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
