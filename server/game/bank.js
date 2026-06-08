// The Bank: pure helpers for physical coin handling. All values are in As units
// (1 As = $0.25). A "purse" is a map { [denominationValue]: count }.
const DENOMS = [400, 200, 80, 40, 20, 4, 1]; // Solidus, Aureus, Quinarius, Antoninianus, Denarius, Sestertius, As

function emptyPurse() {
  const p = {};
  for (const v of DENOMS) p[v] = 0;
  return p;
}

function purseValue(purse) {
  let t = 0;
  for (const v of DENOMS) t += v * (purse[v] || 0);
  return t;
}

// Fewest, largest coins that sum to amount (Bank minting / split payouts).
function minCoins(amount) {
  const out = [];
  let r = amount;
  for (const v of DENOMS) while (r >= v) { out.push(v); r -= v; }
  return out;
}

function coinsToPurse(arr) {
  const p = emptyPurse();
  for (const v of arr) p[v] = (p[v] || 0) + 1;
  return p;
}

// A sensible balanced starting purse for a given value (As units), scaled from a
// $100 template, with the remainder paid out in As so the total is exact.
function buyInPurse(units) {
  const f = (units * 0.25) / 100; // scale vs $100
  const template = { 1: 20, 4: 15, 20: 8, 40: 2, 80: 1 }; // the $100 mix
  const purse = emptyPurse();
  let rem = units;
  for (const v of [80, 40, 20, 4]) {
    let c = Math.round((template[v] || 0) * f);
    c = Math.max(0, Math.min(c, Math.floor(rem / v)));
    purse[v] = c;
    rem -= c * v;
  }
  purse[1] = rem; // exact remainder in As
  return purse;
}

// Exact subset of `purse` summing to target, using the FEWEST coins (respecting
// available counts). Returns an array of coin values, or null if impossible.
function exactFromPurse(purse, target) {
  if (target === 0) return [];
  if (target < 0) return null;
  const INF = Infinity;
  const dp = new Array(target + 1).fill(INF);
  const pick = new Array(target + 1).fill(0);
  dp[0] = 0;
  for (const v of DENOMS) {
    const cnt = purse[v] || 0;
    for (let c = 0; c < cnt; c++) {
      for (let s = target; s >= v; s--) {
        if (dp[s - v] + 1 < dp[s]) { dp[s] = dp[s - v] + 1; pick[s] = v; }
      }
    }
  }
  if (dp[target] === INF) return null;
  const coins = [];
  let s = target;
  while (s > 0) { coins.push(pick[s]); s -= pick[s]; }
  return coins;
}

// Smallest subset total >= target reachable from `purse` (minimal overpay).
// Returns { total, coins } or null if the purse can't even cover target.
function coverFromPurse(purse, target) {
  const total = purseValue(purse);
  if (total < target) return null;
  if (target <= 0) return { total: 0, coins: [] };
  const reach = new Array(total + 1).fill(false);
  reach[0] = true;
  for (const v of DENOMS) {
    const cnt = purse[v] || 0;
    for (let c = 0; c < cnt; c++) {
      for (let s = total; s >= v; s--) if (reach[s - v]) reach[s] = true;
    }
  }
  for (let t = target; t <= total; t++) {
    if (reach[t]) return { total: t, coins: exactFromPurse(purse, t) };
  }
  return null;
}

module.exports = {
  DENOMS, emptyPurse, purseValue, minCoins, coinsToPurse, buyInPurse,
  exactFromPurse, coverFromPurse,
};
