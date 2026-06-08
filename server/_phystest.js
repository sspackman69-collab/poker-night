// Headless verification of the physical-coin engine (run: node _phystest.js).
// Tests buy-in purses, the three payIntoPot paths, collectPot (single + split),
// and value conservation across randomized betting. No UI / sockets involved.
const assert = require('assert');
const {
  DENOMS, emptyPurse, purseValue, minCoins, coinsToPurse, buyInPurse,
  exactFromPurse, coverFromPurse,
} = require('./game/bank');
const { GameRoom } = require('./game/gameState');

let pass = 0, fail = 0;
function check(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); pass++; }
  catch (e) { console.log(`  ✗ ${name}\n      ${e.message}`); fail++; }
}
const coinsValue = (arr) => arr.reduce((a, v) => a + v, 0);

console.log('\n── bank helpers ──');
check('buyInPurse(400) values exactly 400 ($100)', () => {
  assert.strictEqual(purseValue(buyInPurse(400)), 400);
});
check('buyInPurse exact for many amounts', () => {
  for (const u of [4, 7, 13, 100, 137, 400, 401, 999, 4000, 40000]) {
    assert.strictEqual(purseValue(buyInPurse(u)), u, `buyIn ${u}`);
  }
});
check('minCoins sums correctly & is fewest-largest', () => {
  assert.strictEqual(coinsValue(minCoins(0)), 0);
  for (const u of [1, 4, 5, 23, 137, 599, 4000]) {
    assert.strictEqual(coinsValue(minCoins(u)), u, `minCoins ${u}`);
  }
  assert.deepStrictEqual(minCoins(401), [400, 1]); // not 100 As
});
check('exactFromPurse returns exact subset or null', () => {
  const purse = coinsToPurse([1, 1, 4, 20, 40]); // 66
  assert.strictEqual(coinsValue(exactFromPurse(purse, 24)), 24); // 20+4
  assert.strictEqual(coinsValue(exactFromPurse(purse, 66)), 66);
  assert.strictEqual(exactFromPurse(purse, 3), null);   // only coins below 4 are 1,1 => max 2
});
check('exactFromPurse(purse,2) = [1,1]', () => {
  const purse = coinsToPurse([1, 1, 4]);
  assert.strictEqual(coinsValue(exactFromPurse(purse, 2)), 2);
});
check('coverFromPurse minimal overpay', () => {
  const purse = coinsToPurse([4, 20, 40]); // 64, no As
  const c = coverFromPurse(purse, 3);
  assert.strictEqual(c.total, 4); // smallest >= 3
  const c2 = coverFromPurse(purse, 25);
  assert.ok(c2.total >= 25 && coinsValue(c2.coins) === c2.total);
  assert.strictEqual(coverFromPurse(coinsToPurse([1]), 5), null); // can't cover
});

console.log('\n── payIntoPot paths ──');
function room1() {
  // Single-player room so we can control its purse directly.
  return new GameRoom('TEST', 'd', 'Dealer', 's1', undefined, 1, 400);
}
check('PATH A — exact coins from purse', () => {
  const r = room1();
  const p = r.getPlayer('d');
  p.purse = coinsToPurse([1, 1, 4, 20]); p.chips = purseValue(p.purse); // 26
  r.payIntoPot(p, 24); // 20 + 4 exact
  assert.strictEqual(r.pot, 24);
  assert.strictEqual(coinsValue(r.potCoins), 24);
  assert.strictEqual(p.chips, 2);
  assert.strictEqual(purseValue(p.purse), 2);
});
check('PATH B — overpay, take change FROM POT', () => {
  const r = room1();
  const p = r.getPlayer('d');
  // Seed pot with small coins so it can make change.
  r.addCoinsToPot([1, 1, 1, 1, 1, 4]); // pot = 9, can make 1..9
  const potBefore = r.pot;
  p.purse = coinsToPurse([20, 20]); p.chips = 40; // only 20s
  r.payIntoPot(p, 17); // overpay 20, change 3 from pot
  // Net: player paid exactly 17 of value.
  assert.strictEqual(purseValue(p.purse), 40 - 17, 'purse down by 17');
  assert.strictEqual(p.chips, 23);
  assert.strictEqual(r.pot, potBefore + 17, 'pot up by 17');
  assert.strictEqual(coinsValue(r.potCoins), r.pot, 'potCoins match pot');
});
check('PATH C — Bank breaks coin (pot cannot change)', () => {
  const r = room1();
  const p = r.getPlayer('d');
  // Empty pot => no coins to make change with.
  p.purse = coinsToPurse([20]); p.chips = 20; // single 20
  r.payIntoPot(p, 7); // bank breaks: 7 to pot, 13 change to purse
  assert.strictEqual(r.pot, 7);
  assert.strictEqual(coinsValue(r.potCoins), 7);
  assert.strictEqual(purseValue(p.purse), 13, 'change returned');
  assert.strictEqual(p.chips, 13);
});

console.log('\n── collectPot ──');
check('single winner gets the actual pot coins', () => {
  const r = new GameRoom('T2', 'd', 'D', 's', undefined, 1, 400);
  r.addPlayer('p2', 'P2', 's2', false, 400);
  const total = purseValue(r.getPlayer('d').purse) + purseValue(r.getPlayer('p2').purse);
  r.getPlayer('d').purse = coinsToPurse([20, 20]); r._sync(r.getPlayer('d'));
  r.addCoinsToPot([20, 4, 1]); // pot 25
  r.pendingPayouts = [{ id: 'd', amount: 25 }];
  r.collectPot();
  assert.strictEqual(r.pot, 0);
  assert.strictEqual(r.potCoins.length, 0);
  assert.strictEqual(purseValue(r.getPlayer('d').purse), 65); // 40 + 25
});
check('split pot — bank pays each exact share', () => {
  const r = new GameRoom('T3', 'd', 'D', 's', undefined, 1, 400);
  r.addPlayer('p2', 'P2', 's2', false, 400);
  r.getPlayer('d').purse = emptyPurse(); r._sync(r.getPlayer('d'));
  r.getPlayer('p2').purse = emptyPurse(); r._sync(r.getPlayer('p2'));
  r.addCoinsToPot([40, 20]); // 60
  r.pendingPayouts = [{ id: 'd', amount: 30 }, { id: 'p2', amount: 30 }];
  r.collectPot();
  assert.strictEqual(purseValue(r.getPlayer('d').purse), 30);
  assert.strictEqual(purseValue(r.getPlayer('p2').purse), 30);
  assert.strictEqual(r.pot, 0);
});

console.log('\n── conservation fuzz (randomized bets) ──');
check('total value (purses + pot) is conserved over 2000 random bets', () => {
  const r = new GameRoom('FZ', 'd', 'D', 's', undefined, 1, 400);
  r.addPlayer('p2', 'P2', 's2', false, 250);
  r.addPlayer('p3', 'P3', 's3', false, 717);
  const ids = ['d', 'p2', 'p3'];
  const TOTAL = ids.reduce((a, id) => a + purseValue(r.getPlayer(id).purse), 0);
  for (let i = 0; i < 2000; i++) {
    const p = r.getPlayer(ids[i % 3]);
    if (p.chips <= 0) continue;
    const amt = 1 + Math.floor(Math.random() * Math.min(p.chips, 120));
    r.payIntoPot(p, amt);
    // invariant after every move
    const sum = ids.reduce((a, id) => a + purseValue(r.getPlayer(id).purse), 0) + r.pot;
    assert.strictEqual(sum, TOTAL, `conservation broke at i=${i}`);
    assert.strictEqual(coinsValue(r.potCoins), r.pot, `potCoins drift at i=${i}`);
    for (const id of ids) assert.strictEqual(r.getPlayer(id).chips, purseValue(r.getPlayer(id).purse), 'chips cache drift');
  }
  // Now award everything and confirm still conserved.
  r.pendingPayouts = [{ id: 'd', amount: r.pot }];
  r.collectPot();
  const after = ids.reduce((a, id) => a + purseValue(r.getPlayer(id).purse), 0);
  assert.strictEqual(after, TOTAL, 'conservation broke after payout');
});

console.log('\n── no negative coin counts ever ──');
check('purse counts stay non-negative through fuzz', () => {
  const r = new GameRoom('NN', 'd', 'D', 's', undefined, 1, 533);
  r.addPlayer('p2', 'P2', 's2', false, 533);
  const ids = ['d', 'p2'];
  for (let i = 0; i < 1500; i++) {
    const p = r.getPlayer(ids[i % 2]);
    if (p.chips <= 0) continue;
    r.payIntoPot(p, 1 + Math.floor(Math.random() * Math.min(p.chips, 90)));
    for (const id of ids)
      for (const v of DENOMS)
        assert.ok((r.getPlayer(id).purse[v] || 0) >= 0, `negative ${v} count at i=${i}`);
    for (const v of DENOMS) {
      const potCount = r.potCoins.filter(x => x === v).length;
      assert.ok(potCount >= 0);
    }
  }
});

console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
