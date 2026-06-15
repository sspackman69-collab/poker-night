const RANK_VALUES = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8,
  '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
};

const HAND_RANKS = {
  FIVE_OF_A_KIND: 10, // only possible with wild cards; beats a straight flush
  ROYAL_FLUSH: 9,
  STRAIGHT_FLUSH: 8,
  FOUR_OF_A_KIND: 7,
  FULL_HOUSE: 6,
  FLUSH: 5,
  STRAIGHT: 4,
  THREE_OF_A_KIND: 3,
  TWO_PAIR: 2,
  ONE_PAIR: 1,
  HIGH_CARD: 0
};

const HAND_NAMES = {
  10: 'Five of a Kind',
  9: 'Royal Flush',
  8: 'Straight Flush',
  7: 'Four of a Kind',
  6: 'Full House',
  5: 'Flush',
  4: 'Straight',
  3: 'Three of a Kind',
  2: 'Two Pair',
  1: 'One Pair',
  0: 'High Card'
};

function getValues(hand) {
  return hand.map(c => RANK_VALUES[c.rank]).sort((a, b) => b - a);
}

function isFlush(hand) {
  return hand.every(c => c.suit === hand[0].suit);
}

function isStraight(values) {
  const sorted = [...values].sort((a, b) => a - b);
  // Ace-low straight: A-2-3-4-5
  if (sorted.join() === '2,3,4,5,14') return true;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] !== sorted[i - 1] + 1) return false;
  }
  return true;
}

function getCounts(values) {
  const counts = {};
  for (const v of values) counts[v] = (counts[v] || 0) + 1;
  return counts;
}

function evaluateHand(cards) {
  const values = getValues(cards);
  const counts = getCounts(values);
  const countValues = Object.values(counts).sort((a, b) => b - a);
  const flush = isFlush(cards);
  const straight = isStraight(values);

  let rank, tiebreakers;

  if (countValues[0] === 5) {
    // Five of a kind (only reachable via wild cards).
    rank = HAND_RANKS.FIVE_OF_A_KIND;
    const five = +Object.keys(counts).find(k => counts[k] === 5);
    tiebreakers = [five];
  } else if (flush && straight) {
    const isRoyal = values.includes(14) && values.includes(13);
    rank = isRoyal ? HAND_RANKS.ROYAL_FLUSH : HAND_RANKS.STRAIGHT_FLUSH;
    tiebreakers = values;
  } else if (countValues[0] === 4) {
    rank = HAND_RANKS.FOUR_OF_A_KIND;
    const quad = +Object.keys(counts).find(k => counts[k] === 4);
    const kicker = +Object.keys(counts).find(k => counts[k] === 1);
    tiebreakers = [quad, kicker];
  } else if (countValues[0] === 3 && countValues[1] === 2) {
    rank = HAND_RANKS.FULL_HOUSE;
    const three = +Object.keys(counts).find(k => counts[k] === 3);
    const two = +Object.keys(counts).find(k => counts[k] === 2);
    tiebreakers = [three, two];
  } else if (flush) {
    rank = HAND_RANKS.FLUSH;
    tiebreakers = values;
  } else if (straight) {
    rank = HAND_RANKS.STRAIGHT;
    tiebreakers = values;
  } else if (countValues[0] === 3) {
    rank = HAND_RANKS.THREE_OF_A_KIND;
    const three = +Object.keys(counts).find(k => counts[k] === 3);
    const kickers = values.filter(v => v !== three);
    tiebreakers = [three, ...kickers];
  } else if (countValues[0] === 2 && countValues[1] === 2) {
    rank = HAND_RANKS.TWO_PAIR;
    const pairs = Object.keys(counts).filter(k => counts[k] === 2).map(Number).sort((a, b) => b - a);
    const kicker = values.find(v => !pairs.includes(v));
    tiebreakers = [...pairs, kicker];
  } else if (countValues[0] === 2) {
    rank = HAND_RANKS.ONE_PAIR;
    const pair = +Object.keys(counts).find(k => counts[k] === 2);
    const kickers = values.filter(v => v !== pair);
    tiebreakers = [pair, ...kickers];
  } else {
    rank = HAND_RANKS.HIGH_CARD;
    tiebreakers = values;
  }

  return { rank, tiebreakers, name: HAND_NAMES[rank] };
}

// Compare two evaluation results (from evaluateHand / bestHand).
function compareEval(a, b) {
  if (a.rank !== b.rank) return a.rank > b.rank ? 1 : -1;
  const n = Math.max(a.tiebreakers.length, b.tiebreakers.length);
  for (let i = 0; i < n; i++) {
    const x = a.tiebreakers[i] || 0;
    const y = b.tiebreakers[i] || 0;
    if (x !== y) return x > y ? 1 : -1;
  }
  return 0;
}

// Rank a set of FACE-UP cards (1–4 of them) for deciding who acts first on
// later streets. Considers pair/trips/quads then high cards (straights/flushes
// showing are ignored for act-order — a fine simplification).
function showingKey(cards) {
  const vals = cards.map(c => RANK_VALUES[c.rank]);
  const counts = {};
  for (const v of vals) counts[v] = (counts[v] || 0) + 1;
  const groups = Object.keys(counts)
    .map(v => ({ v: +v, c: counts[v] }))
    .sort((a, b) => b.c - a.c || b.v - a.v);
  const key = [];
  for (const g of groups) key.push(g.c, g.v);
  return key;
}

function compareShowing(a, b) {
  const ka = showingKey(a);
  const kb = showingKey(b);
  const n = Math.max(ka.length, kb.length);
  for (let i = 0; i < n; i++) {
    const x = ka[i] || 0;
    const y = kb[i] || 0;
    if (x !== y) return x > y ? 1 : -1;
  }
  return 0;
}

// ── Wild-card support ────────────────────────────────────────────────────────
const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];
const RANKS = Object.keys(RANK_VALUES);
const FULL_DECK = [];
for (const suit of SUITS) for (const rank of RANKS) FULL_DECK.push({ suit, rank });

function isWild(card, wildRanks) {
  return !!(wildRanks && wildRanks.has && wildRanks.has(card.rank));
}

function combos(arr, k) {
  const out = [];
  (function pick(start, acc) {
    if (acc.length === k) { out.push(acc.slice()); return; }
    for (let i = start; i < arr.length; i++) { acc.push(arr[i]); pick(i + 1, acc); acc.pop(); }
  })(0, []);
  return out;
}

function combosWithRepl(arr, k) {
  const out = [];
  (function pick(start, acc) {
    if (acc.length === k) { out.push(acc.slice()); return; }
    for (let i = start; i < arr.length; i++) { acc.push(arr[i]); pick(i, acc); acc.pop(); }
  })(0, []);
  return out;
}

// Best 5-card evaluation from N cards (handles 5 or more — e.g. 7-card stud).
function bestOfN(cards) {
  if (cards.length <= 5) return evaluateHand(cards);
  let best = null;
  for (const five of combos(cards, 5)) {
    const ev = evaluateHand(five);
    if (!best || compareEval(ev, best) > 0) best = ev;
  }
  return best;
}

const EMPTY = new Set();

// Best possible hand given a set of wild ranks. Each wild card may stand in for
// any card. With 4+ wilds, five aces is always achievable and is the nuts, so we
// short-circuit; otherwise we brute-force the (bounded) wild substitutions.
function bestHand(cards, wildRanks = EMPTY) {
  const wilds = cards.filter(c => isWild(c, wildRanks));
  const naturals = cards.filter(c => !isWild(c, wildRanks));

  if (wilds.length === 0) return bestOfN(cards);
  if (wilds.length >= 4) {
    return { rank: HAND_RANKS.FIVE_OF_A_KIND, tiebreakers: [14], name: HAND_NAMES[10] };
  }

  let best = null;
  for (const repl of combosWithRepl(FULL_DECK, wilds.length)) {
    const ev = bestOfN(naturals.concat(repl));
    if (!best || compareEval(ev, best) > 0) best = ev;
  }
  return best;
}

// ── Low hand — Ace-to-Five "wheel" ──────────────────────────────────────────
// Ace is low (1); straights & flushes DON'T count; pairs/trips are bad. A LOWER
// hand wins. Low key = { cat, vals }: cat 0 (no pair, best) … 6 (five-of-a-kind,
// worst); vals are the 5 ranks (ace=1) sorted descending. Compare by cat first
// (lower better — a no-pair low always beats any paired low), then vals
// lexicographically (lower better). Best possible low is 5-4-3-2-A.
const LOW_RANK = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 1 };
// Suit is irrelevant to low (flushes don't count), so wilds only need one card per rank.
const ONE_OF_EACH_RANK = RANKS.map(rank => ({ suit: 'spades', rank }));
const LOW_LABEL = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };

function lowCategory(pattern) {
  const a = pattern[0], b = pattern[1];
  if (a === 5) return 6;
  if (a === 4) return 5;
  if (a === 3 && b === 2) return 4;
  if (a === 3) return 3;
  if (a === 2 && b === 2) return 2;
  if (a === 2) return 1;
  return 0;
}

function lowKey5(cards) {
  const vals = cards.map(c => LOW_RANK[c.rank]);
  const counts = {};
  for (const v of vals) counts[v] = (counts[v] || 0) + 1;
  const pattern = Object.values(counts).sort((x, y) => y - x);
  return { cat: lowCategory(pattern), vals: [...vals].sort((x, y) => y - x) };
}

// 1 if a is the BETTER (lower) low, -1 if b is, 0 tie.
function compareLow(a, b) {
  if (!a || !b) return a ? 1 : b ? -1 : 0;
  if (a.cat !== b.cat) return a.cat < b.cat ? 1 : -1;
  const n = Math.max(a.vals.length, b.vals.length);
  for (let i = 0; i < n; i++) {
    const x = a.vals[i] || 0, y = b.vals[i] || 0;
    if (x !== y) return x < y ? 1 : -1;
  }
  return 0;
}

function lowName(key) {
  if (!key) return null;
  return key.vals.map(v => LOW_LABEL[v] || v).join('-') + ' low';
}

function bestOfNLow(cards) {
  if (cards.length < 5) return null;
  let best = null;
  for (const five of combos(cards, 5)) {
    const k = lowKey5(five);
    if (!best || compareLow(k, best) > 0) best = k;
  }
  return best;
}

// Best (lowest) low achievable, wild-aware. Wilds become whatever rank lowers the
// hand most (suit ignored). Returns a low key, or null if <5 cards.
function bestLow(cards, wildRanks = EMPTY) {
  const wilds = cards.filter(c => isWild(c, wildRanks));
  const naturals = cards.filter(c => !isWild(c, wildRanks));
  if (cards.length < 5) return null;
  if (wilds.length === 0) return bestOfNLow(cards);
  if (wilds.length >= 5) return { cat: 0, vals: [5, 4, 3, 2, 1] }; // the wheel
  let best = null;
  for (const repl of combosWithRepl(ONE_OF_EACH_RANK, wilds.length)) {
    const k = bestOfNLow(naturals.concat(repl));
    if (k && (!best || compareLow(k, best) > 0)) best = k;
  }
  return best;
}

// Winners of the LOW half among the given players (cards-speak). No qualifier:
// the lowest hand always wins. Returns [{ ...player, lowName }] (ties included).
function findLowWinners(players, wildRanks = EMPTY) {
  const lows = players.map(p => ({ p, low: bestLow(p.hand, wildRanks) })).filter(x => x.low);
  if (lows.length === 0) return [];
  let best = [lows[0]];
  for (let i = 1; i < lows.length; i++) {
    const cmp = compareLow(lows[i].low, best[0].low);
    if (cmp > 0) best = [lows[i]];
    else if (cmp === 0) best.push(lows[i]);
  }
  return best.map(e => ({ ...e.p, lowName: lowName(e.low) }));
}

function findWinners(players, wildRanks = EMPTY) {
  // players: [{ id, name, hand }]
  const evals = players.map(p => ({ p, ev: bestHand(p.hand, wildRanks) }));
  let best = [evals[0]];
  for (let i = 1; i < evals.length; i++) {
    const cmp = compareEval(evals[i].ev, best[0].ev);
    if (cmp > 0) best = [evals[i]];
    else if (cmp === 0) best.push(evals[i]);
  }
  return best.map(e => ({ ...e.p, handName: e.ev.name }));
}

module.exports = {
  evaluateHand, bestHand, findWinners, compareShowing, RANK_VALUES,
  bestLow, compareLow, findLowWinners, lowName,
};
