// End-to-end: play full hands through the real engine + variant and confirm
// total coin value is conserved across ante, bring-in, betting, showdown, payout.
const assert = require('assert');
const { GameRoom } = require('./game/gameState');
const { purseValue } = require('./game/bank');

function playHand(variantId, buyIns) {
  const r = new GameRoom('SIM', 'p0', 'P0', 's0', variantId, 1, buyIns[0]);
  for (let i = 1; i < buyIns.length; i++) r.addPlayer('p' + i, 'P' + i, 's' + i, false, buyIns[i]);
  const ids = buyIns.map((_, i) => 'p' + i);
  const TOTAL = ids.reduce((a, id) => a + purseValue(r.getPlayer(id).purse), 0);

  r.startRound();
  let guard = 0;
  while (r.phase === 'betting' && guard++ < 500) {
    const actor = r.getCurrentActor();
    if (!actor) break;
    const p = r.getPlayer(actor);
    const owed = r.currentBet - p.bet;
    // Simple bot: call if it can afford, else fold; occasionally raise.
    if (owed > 0 && owed <= p.chips) r.playerAction(actor, 'call');
    else if (owed > 0) r.playerAction(actor, 'fold');
    else r.playerAction(actor, 'check');
    const sum = ids.reduce((a, id) => a + purseValue(r.getPlayer(id).purse), 0) + r.pot;
    assert.strictEqual(sum, TOTAL, `mid-hand conservation broke (${variantId})`);
    assert.strictEqual(r.potCoins.reduce((a, v) => a + v, 0), r.pot, 'potCoins drift');
  }
  // Resolve deferred payout (as the dealer's next deal / reset would).
  r.collectPot();
  const after = ids.reduce((a, id) => a + purseValue(r.getPlayer(id).purse), 0);
  assert.strictEqual(after, TOTAL, `post-payout conservation broke (${variantId})`);
  return { TOTAL, after, phase: r.phase };
}

let pass = 0, fail = 0;
for (const variantId of ['five-card-stud', 'seven-card-stud']) {
  for (let trial = 0; trial < 200; trial++) {
    const n = 2 + Math.floor(Math.random() * 4); // 2–5 players
    const buyIns = Array.from({ length: n }, () => 4 * (5 + Math.floor(Math.random() * 200)));
    try { playHand(variantId, buyIns); pass++; }
    catch (e) { console.log(`  ✗ ${variantId} trial ${trial}: ${e.message}`); fail++; if (fail > 5) break; }
  }
}
console.log(`\n${fail === 0 ? '✅' : '❌'} full-hand sim: ${pass} hands conserved, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
