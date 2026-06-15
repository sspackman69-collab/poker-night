// Verify Hi-Lo: declaration resolution (split, both-wins-all, both-forfeit,
// no-low) and value conservation.
const assert = require('assert');
const { GameRoom } = require('./game/gameState');
const { purseValue } = require('./game/bank');
const { minCoins } = require('./game/bank');

const C = (s) => s.split(' ').map(t => ({ rank: t.slice(0, -1), suit: { s: 'spades', h: 'hearts', d: 'diamonds', c: 'clubs' }[t.slice(-1)], faceUp: true }));

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { console.log('  ✓ ' + n); pass++; } else { console.log('  ✗ ' + n); fail++; } };

// Build a hi-lo room with given hands, pot, and declarations; resolve; return payouts.
function resolve(hands, decls, potValue = 80) {
  const ids = Object.keys(hands);
  const r = new GameRoom('HL', ids[0], ids[0], 's0', 'five-card-stud', 1, 400);
  for (let i = 1; i < ids.length; i++) r.addPlayer(ids[i], ids[i], 's' + i, false, 400);
  r.hiLo = true;
  for (const id of ids) r.getPlayer(id).hand = C(hands[id]);
  r.addCoinsToPot(minCoins(potValue)); // pot = potValue, real coins
  r.phase = 'declare';
  r.declareIds = ids.slice();
  for (const id of ids) r.declare(id, decls[id]);
  const pay = {};
  for (const { id, amount } of (r.pendingPayouts || [])) pay[id] = (pay[id] || 0) + amount;
  return { r, pay };
}

console.log('\n── resolution ──');
{
  // Basic split: d high (pair Ks), p1 low (6-low). 80 → 40/40.
  const { pay } = resolve(
    { d: 'Ks Kh 7d 2c 9s', p1: 'As 2h 3d 4c 6s' },
    { d: 'hi', p1: 'lo' });
  ok('basic split pays hi=40 / lo=40', pay.d === 40 && pay.p1 === 40);
}
{
  // Both: d has the wheel (A-5 straight high AND best low) → wins both → all 80.
  const { pay } = resolve(
    { d: 'As 2h 3d 4c 5s', p1: 'Kc Qc 2s 7d 9h' },
    { d: 'both', p1: 'hi' });
  ok('both-wins-all takes whole pot (d=80)', pay.d === 80 && !pay.p1);
}
{
  // Both-forfeit: d declares both, has best LOW (6) but loses HI to p1's kings.
  // d forfeits; hi→p1, lo→p2 (7-low). d gets nothing.
  const { pay } = resolve(
    { d: 'As 2h 3d 4c 6s', p1: 'Ks Kh 2c 7d 9s', p2: '2s 3h 4d 5c 7s' },
    { d: 'both', p1: 'hi', p2: 'lo' });
  ok('failed "both" forfeits entirely (d=0)', !pay.d);
  ok('forfeited halves go to p1 (hi) and p2 (lo), 40 each', pay.p1 === 40 && pay.p2 === 40);
}
{
  // Nobody declares low → high takes the whole pot (d kings beat p1 queens).
  const { pay } = resolve(
    { d: 'Ks Kh 2c 7d 9s', p1: 'Qs Qh 3c 8d 10h' },
    { d: 'hi', p1: 'hi' });
  ok('no low declared → high takes whole pot (d=80)', pay.d === 80 && !pay.p1);
}

console.log('\n── conservation through a full hi-lo hand ──');
ok('value conserved across 150 hi-lo hands', (() => {
  for (let t = 0; t < 150; t++) {
    const r = new GameRoom('HLC', 'd', 'D', 's', Math.random() < 0.5 ? 'five-card-stud' : 'seven-card-stud', 1, 400);
    const n = 2 + Math.floor(Math.random() * 3);
    const ids = ['d'];
    for (let i = 1; i < n; i++) { r.addPlayer('p' + i, 'P' + i, 's' + i, false, 400); ids.push('p' + i); }
    r.hiLo = true;
    const TOTAL = ids.reduce((a, id) => a + purseValue(r.getPlayer(id).purse), 0);
    r.startRound();
    let guard = 0;
    while (guard++ < 400) {
      if (r.phase === 'betting') {
        const a = r.getCurrentActor(); if (!a) break;
        const p = r.getPlayer(a); const owed = r.currentBet - p.bet;
        owed > 0 ? r.playerAction(a, 'call') : r.playerAction(a, 'check');
      } else if (r.phase === 'declare') {
        for (const id of r.declareIds) { const c = ['hi', 'lo', 'both'][Math.floor(Math.random() * 3)]; r.declare(id, c); }
      } else break;
    }
    r.collectPot();
    const after = ids.reduce((a, id) => a + purseValue(r.getPlayer(id).purse), 0);
    if (after !== TOTAL) { console.log(`     drift at hand ${t}: ${after} != ${TOTAL}`); return false; }
  }
  return true;
})());

console.log('\n' + (fail === 0 ? '✅' : '❌') + ' ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
